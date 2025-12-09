import { NextRequest, NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";
import { namehash } from "viem/ens";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Known marketplace contract addresses (common ENS marketplaces)
const MARKETPLACE_CONTRACTS: Record<string, string> = {
  // OpenSea - Seaport Protocol (primary protocol since 2022)
  "0x00000000006c3852cbef3e08e8df289169ede581": "OpenSea Seaport",
  "0x00000000006cee72100d161c57ada5bb2be1ca79": "OpenSea Seaport V1",
  "0x00000000006c7676171937c444f6bde3d6282": "OpenSea Seaport V3",
  "0x0000000000000ad24e80fd803c6ac37206a45f15": "OpenSea Seaport V4",
  "0x00000000000001ad428e4906ae43d8f9852d0dd6": "OpenSea Seaport V5",
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": "OpenSea Seaport V6",

  // OpenSea - Wyvern Protocol (legacy)
  "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": "OpenSea Wyvern",
  "0x7f268357a8c2552623316e2562d90e642bb538e5": "OpenSea Wyvern V2",

  // OpenSea - Shared Storefront
  "0x495f947276749ce646f68ac8c248420045cb7b5e": "OpenSea Shared Storefront",

  // Note: Vision.io and Grails.app contract addresses are not publicly documented.
  // Grails.app (https://grails.app) likely uses OpenSea's Seaport protocol, so transactions
  // may already be detected through the OpenSea contracts above.
  // The heuristic detection (rapid intermediate transfers) will also catch marketplace
  // escrow patterns from these platforms if they use escrow contracts.
  // If you obtain specific contract addresses, add them here in the format:
  // "0x...": "Vision.io" or "0x...": "Grails.app"
};

// Helper to detect if an address might be a marketplace contract
const isMarketplaceContract = (address: string): { isMarketplace: boolean; name?: string } => {
  const addrLower = address.toLowerCase();

  // Check against known marketplaces
  if (MARKETPLACE_CONTRACTS[addrLower]) {
    return { isMarketplace: true, name: MARKETPLACE_CONTRACTS[addrLower] };
  }

  // Heuristic: If transfer is very short-lived (rapid transfer back), might be marketplace escrow
  // But we'll mark it based on pattern detection in the processing logic
  return { isMarketplace: false };
};

// The Graph ENS subgraph endpoint
// Using decentralized network gateway (better rate limits with API key)
// Subgraph ID: 5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH
const getSubgraphUrl = () => {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (apiKey) {
    // Use gateway with API key for better rate limits
    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH`;
  }
  // Fallback to hosted service (rate-limited)
  return "https://api.thegraph.com/subgraphs/name/ensdomains/ens";
};

// GraphQL query to get domain information and transfer history
const GET_DOMAIN_HISTORY = `
  query GetDomainHistory($nameHash: String!) {
    domain(id: $nameHash) {
      id
      name
      owner {
        id
      }
      createdAt
      registrations {
        registrationDate
        expiryDate
        registrant {
          id
        }
      }
    }
    transfers(
      where: { domain: $nameHash }
      orderBy: blockNumber
      orderDirection: asc
    ) {
      id
      domain {
        id
        name
      }
      blockNumber
      transactionID
      owner {
        id
      }
    }
  }
`;

// Alternative query using domain name directly
const GET_DOMAIN_BY_NAME = `
  query GetDomainByName($name: String!) {
    domains(where: { name: $name }) {
      id
      name
      owner {
        id
      }
      createdAt
    }
    registrations(where: { domain_: { name: $name } }) {
      registrationDate
      expiryDate
      registrant {
        id
      }
      domain {
        name
      }
    }
    transfers(
      where: { domain_: { name: $name } }
      orderBy: blockNumber
      orderDirection: asc
    ) {
      id
      domain {
        id
        name
      }
      blockNumber
      transactionID
      owner {
        id
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ensName = searchParams.get("name");

  if (!ensName) {
    return NextResponse.json({ error: "ENS name is required" }, { status: 400 });
  }

  try {
    // Normalize ENS name (handles .eth suffix)
    const normalizedName = ensName.endsWith(".eth") ? ensName : `${ensName}.eth`;
    const nameHash = namehash(normalizedName);

    // Create GraphQL client
    // If using gateway URL, API key is in the URL, otherwise use header
    const subgraphUrl = getSubgraphUrl();
    const apiKey = process.env.THE_GRAPH_API_KEY;
    const client = new GraphQLClient(subgraphUrl, {
      // Only add Authorization header if not using gateway URL (gateway has key in URL)
      headers: apiKey && !subgraphUrl.includes('gateway.thegraph.com')
        ? {
          Authorization: `Bearer ${apiKey}`,
        }
        : {},
    });

    // Query The Graph for domain history
    // Try by name first, then fallback to nameHash for subdomains
    let data;
    try {
      data = await client.request<{
        domains?: Array<{
          id: string;
          name: string;
          owner: { id: string };
          createdAt: string;
        }>;
        registrations?: Array<{
          registrationDate: string;
          expiryDate: string;
          registrant: { id: string };
          domain: { name: string };
        }>;
        transfers: Array<{
          id: string;
          domain: { id: string; name: string };
          blockNumber: string;
          transactionID: string;
          owner: { id: string };
        }>;
      }>(GET_DOMAIN_BY_NAME, {
        name: normalizedName.toLowerCase(),
      });
    } catch (error: any) {
      // Handle rate limiting and other GraphQL errors
      if (error.response?.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. The Graph API is rate-limiting requests. Please wait a moment and try again, or check your API key configuration."
          },
          { status: 429 }
        );
      }

      // Re-throw other errors to be caught by outer try-catch
      throw error;
    }

    // If no results by name, try by nameHash (useful for subdomains)
    if (!data.domains || data.domains.length === 0) {
      try {
        const nameHashData = await client.request<{
          domain?: {
            id: string;
            name: string;
            owner: { id: string };
            createdAt: string;
            registrations: Array<{
              registrationDate: string;
              expiryDate: string;
              registrant: { id: string };
            }>;
          };
          transfers: Array<{
            id: string;
            domain: { id: string; name: string };
            blockNumber: string;
            transactionID: string;
            owner: { id: string };
          }>;
        }>(GET_DOMAIN_HISTORY, {
          nameHash: nameHash,
        });

        // Convert nameHash response to match expected format
        if (nameHashData.domain) {
          data = {
            domains: [nameHashData.domain],
            registrations: nameHashData.domain.registrations || [],
            transfers: nameHashData.transfers || [],
          };
        }
      } catch (hashError: any) {
        // If nameHash query also fails, continue with original error handling
        if (hashError.response?.status === 429) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded. The Graph API is rate-limiting requests. Please wait a moment and try again, or check your API key configuration."
            },
            { status: 429 }
          );
        }
      }
    }

    // Check if domain exists
    if (!data.domains || data.domains.length === 0) {
      return NextResponse.json(
        { error: `ENS domain "${normalizedName}" does not exist` },
        { status: 404 }
      );
    }

    const domain = data.domains[0];

    // If no owner, domain doesn't exist
    if (!domain.owner || domain.owner.id === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: `Sorry, we are unsure of this error. "${normalizedName}" may not exist or may have no owner` },
        { status: 404 }
      );
    }

    // Process transfers to get ownership history
    let owners: Array<{
      address: string;
      startDate: Date;
      endDate?: Date;
      transactionHash: string;
      blockNumber: bigint;
      isMarketplace?: boolean;
      marketplaceName?: string;
    }> = [];

    // Get accurate block timestamps from blockchain
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (rpcUrl) {
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl),
      });

      // Fetch block timestamps for all transfers
      const blockPromises = data.transfers.map((transfer) =>
        publicClient.getBlock({ blockNumber: BigInt(transfer.blockNumber) }).catch(() => null)
      );
      const blocks = await Promise.all(blockPromises);

      // Helper function to estimate timestamp from block number if block fetch fails
      const estimateTimestampFromBlock = (blockNumber: string): Date => {
        // Ethereum mainnet genesis was July 30, 2015, block 0
        const genesisDate = new Date('2015-07-30T00:00:00Z');
        // Average block time is ~12 seconds
        const blockNum = BigInt(blockNumber);
        return new Date(genesisDate.getTime() + Number(blockNum) * 12 * 1000);
      };

      // Process transfers with accurate timestamps
      // Handle marketplace/auction scenarios where ownership might transfer through escrow contracts
      for (let i = 0; i < data.transfers.length; i++) {
        const transfer = data.transfers[i];
        const block = blocks[i];

        const timestamp = block
          ? new Date(Number(block.timestamp) * 1000)
          : estimateTimestampFromBlock(transfer.blockNumber); // Estimate from block number if fetch fails

        // Skip duplicate transfers: same owner in same block (duplicate events)
        if (i > 0) {
          const prevTransfer = data.transfers[i - 1];
          const prevBlock = blocks[i - 1];

          // If same block and same owner, skip (duplicate event)
          if (prevBlock && block &&
            prevTransfer.blockNumber === transfer.blockNumber &&
            prevTransfer.owner.id.toLowerCase() === transfer.owner.id.toLowerCase()) {
            continue;
          }
        }

        // Detect marketplace contracts
        // Check if this transfer is to/from a known marketplace or looks like marketplace escrow
        const marketplaceCheck = isMarketplaceContract(transfer.owner.id);
        let isMarketplace = marketplaceCheck.isMarketplace;
        let marketplaceName = marketplaceCheck.name;

        // Heuristic: If this is a rapid intermediate transfer, it might be a marketplace escrow
        if (!isMarketplace && i > 0 && i < data.transfers.length - 1) {
          const prevTransfer = data.transfers[i - 1];
          const nextTransfer = data.transfers[i + 1];
          const prevBlock = blocks[i - 1];
          const nextBlock = blocks[i + 1];

          if (prevBlock && nextBlock && block) {
            const blockDiff = Number(transfer.blockNumber) - Number(prevTransfer.blockNumber);
            const nextBlockDiff = Number(nextTransfer.blockNumber) - Number(transfer.blockNumber);

            // If transfers happen within 10 blocks of each other, might be marketplace escrow
            if (blockDiff <= 10 && nextBlockDiff <= 10) {
              // If this is an intermediate transfer (different from both prev and next), likely marketplace
              const isIntermediate =
                transfer.owner.id.toLowerCase() !== prevTransfer.owner.id.toLowerCase() &&
                transfer.owner.id.toLowerCase() !== nextTransfer.owner.id.toLowerCase();

              if (isIntermediate) {
                isMarketplace = true;
                marketplaceName = "Marketplace"; // Generic name if we can't identify specific marketplace
              }
            }
          }
        }

        // Get end date from next transfer
        // Always set end date to the next transfer's timestamp, even if same block
        // (we'll handle same-block transfers separately if needed)
        let endDate: Date | undefined;
        if (i < data.transfers.length - 1) {
          const nextTransfer = data.transfers[i + 1];
          const nextBlock = blocks[i + 1];

          // Set end date to next transfer's timestamp
          // Even if same block, this represents when ownership changed
          if (nextBlock) {
            endDate = new Date(Number(nextBlock.timestamp) * 1000);
          } else {
            // Estimate from block number if block fetch failed
            endDate = estimateTimestampFromBlock(nextTransfer.blockNumber);
          }
        }
        // If this is the last transfer, endDate stays undefined (will be set to expiry date if current owner)

        owners.push({
          address: transfer.owner.id,
          startDate: timestamp,
          endDate,
          transactionHash: transfer.transactionID,
          blockNumber: BigInt(transfer.blockNumber),
          isMarketplace: isMarketplace || undefined,
          marketplaceName: marketplaceName || undefined,
        });
      }
    } else {
      // Fallback: use registration date and estimate based on block numbers
      // Find the earliest block number to use as reference
      let earliestBlock = data.transfers.length > 0
        ? BigInt(data.transfers[0].blockNumber)
        : BigInt(0);

      // Try to get registration date from registrations first
      let registrationDate: Date | null = null;
      if (data.registrations && data.registrations.length > 0) {
        const regTimestamp = parseInt(data.registrations[0].registrationDate);
        if (!isNaN(regTimestamp) && regTimestamp > 0) {
          const regDate = new Date(regTimestamp * 1000);
          // Validate date is reasonable
          if (regDate.getFullYear() >= 2015 && regDate.getFullYear() <= new Date().getFullYear() + 1) {
            registrationDate = regDate;
          }
        }
      }

      // Fallback to createdAt if no registration date
      if (!registrationDate && domain.createdAt) {
        const createdAtTimestamp = parseInt(domain.createdAt);
        if (!isNaN(createdAtTimestamp) && createdAtTimestamp > 0) {
          const createdAtDate = new Date(createdAtTimestamp * 1000);
          // Validate date is reasonable
          if (createdAtDate.getFullYear() >= 2015 && createdAtDate.getFullYear() <= new Date().getFullYear() + 1) {
            registrationDate = createdAtDate;
          }
        }
      }

      // If still no valid date, estimate from block number (Ethereum mainnet started ~block 0 in 2015)
      if (!registrationDate) {
        // Ethereum mainnet genesis was July 30, 2015, block 0
        const genesisDate = new Date('2015-07-30T00:00:00Z');
        // Average block time is ~12 seconds, so estimate from genesis
        registrationDate = new Date(genesisDate.getTime() + Number(earliestBlock) * 12 * 1000);
      }

      for (let i = 0; i < data.transfers.length; i++) {
        const transfer = data.transfers[i];
        // Calculate time difference based on block number difference
        const blockDiff = BigInt(transfer.blockNumber) - earliestBlock;
        const estimatedDate = new Date(registrationDate.getTime() + Number(blockDiff) * 12 * 1000);

        let endDate: Date | undefined;
        if (i < data.transfers.length - 1) {
          const nextTransfer = data.transfers[i + 1];
          const blocksDiff = BigInt(nextTransfer.blockNumber) - BigInt(transfer.blockNumber);
          endDate = new Date(estimatedDate.getTime() + Number(blocksDiff) * 12 * 1000);
        }

        owners.push({
          address: transfer.owner.id,
          startDate: estimatedDate,
          endDate,
          transactionHash: transfer.transactionID,
          blockNumber: BigInt(transfer.blockNumber),
        });
      }
    }

    // If we have registration info, use it to set the accurate registration date
    // and consolidate with first transfer if they're the same owner on the same day
    if (data.registrations && data.registrations.length > 0) {
      const registration = data.registrations[0];
      // Parse registration date - The Graph returns Unix timestamp in seconds
      const regTimestamp = parseInt(registration.registrationDate);
      if (!isNaN(regTimestamp) && regTimestamp > 0) {
        const regDate = new Date(regTimestamp * 1000);

        // Validate date is reasonable (after 2015 when Ethereum/ENS launched)
        if (regDate.getFullYear() >= 2015 && regDate.getFullYear() <= new Date().getFullYear() + 1) {
          const registrantAddress = registration.registrant.id.toLowerCase();

          // Check if first owner is the registrant and on the same day
          if (owners.length > 0) {
            const firstOwner = owners[0];
            const firstOwnerDate = firstOwner.startDate instanceof Date
              ? firstOwner.startDate
              : new Date(firstOwner.startDate);

            // If first transfer is by the registrant on the same day, use registration date instead
            // (registration date is more accurate than block timestamp)
            const sameDay =
              firstOwnerDate.getFullYear() === regDate.getFullYear() &&
              firstOwnerDate.getMonth() === regDate.getMonth() &&
              firstOwnerDate.getDate() === regDate.getDate();

            if (firstOwner.address.toLowerCase() === registrantAddress && sameDay) {
              // Replace first transfer date with accurate registration date
              owners[0].startDate = regDate;
            } else if (firstOwnerDate > regDate) {
              // First transfer is after registration, add registration entry
              const registrantIsCurrentOwner = registrantAddress === domain.owner.id.toLowerCase();
              if (!registrantIsCurrentOwner) {
                owners.unshift({
                  address: registration.registrant.id,
                  startDate: regDate,
                  endDate: firstOwner.startDate,
                  transactionHash: "",
                  blockNumber: BigInt(0),
                });
              }
            }
          } else {
            // No transfers, domain still owned by registrant
            const registrantIsCurrentOwner = registrantAddress === domain.owner.id.toLowerCase();
            if (registrantIsCurrentOwner) {
              // Current owner is the registrant, add as first entry
              owners.unshift({
                address: registration.registrant.id,
                startDate: regDate,
                endDate: undefined,
                transactionHash: "",
                blockNumber: BigInt(0),
              });
            }
          }
        }
      }
    }

    // Sort by date (oldest first)
    owners.sort((a, b) => {
      const dateA = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
      const dateB = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
      return dateA.getTime() - dateB.getTime();
    });

    // Consolidate consecutive ownership periods by the same address
    // This handles cases where the same owner appears multiple times (e.g., rapid transfers)
    const consolidatedOwners: typeof owners = [];
    for (let i = 0; i < owners.length; i++) {
      const current = owners[i];

      if (consolidatedOwners.length === 0) {
        consolidatedOwners.push(current);
        continue;
      }

      const lastConsolidated = consolidatedOwners[consolidatedOwners.length - 1];
      const currentStart = current.startDate instanceof Date ? current.startDate : new Date(current.startDate);
      const lastEnd = lastConsolidated.endDate
        ? (lastConsolidated.endDate instanceof Date ? lastConsolidated.endDate : new Date(lastConsolidated.endDate))
        : null;

      // If same owner, merge them
      if (lastConsolidated.address.toLowerCase() === current.address.toLowerCase()) {
        // Same owner - extend the last period to current's end date
        // Use the later end date if both have end dates
        if (current.endDate) {
          const currentEnd = current.endDate instanceof Date ? current.endDate : new Date(current.endDate);
          if (!lastConsolidated.endDate || (lastEnd && currentEnd > lastEnd)) {
            lastConsolidated.endDate = current.endDate;
          }
        } else {
          // Current has no end date, remove end date from last (it's ongoing)
          lastConsolidated.endDate = undefined;
        }
        // Keep the earlier start date
        continue;
      }

      // Different owner - add as new entry
      consolidatedOwners.push(current);
    }

    // Replace owners with consolidated list
    owners.length = 0;
    owners.push(...consolidatedOwners);

    // Filter out entries with zero or negative duration (after consolidation)
    owners = owners.filter((owner) => {
      const startDate = owner.startDate instanceof Date ? owner.startDate : new Date(owner.startDate);
      if (!owner.endDate) {
        return true; // Keep entries without end date (ongoing)
      }
      const endDate = owner.endDate instanceof Date ? owner.endDate : new Date(owner.endDate);
      const duration = endDate.getTime() - startDate.getTime();
      return duration > 0; // Only keep entries with positive duration
    });

    // Convert Date objects to ISO strings and BigInt to strings for JSON serialization
    // Also filter out entries with zero or negative duration (same start/end date)
    const ownersWithISOStrings = owners
      .map((owner) => {
        let startDate: Date;
        if (owner.startDate instanceof Date) {
          startDate = owner.startDate;
        } else if (typeof owner.startDate === "string") {
          const parsed = new Date(owner.startDate);
          // Validate parsed date - if invalid, skip this entry
          if (isNaN(parsed.getTime())) {
            return null;
          }
          startDate = parsed;
        } else {
          // Invalid date format - skip this entry
          return null;
        }

        let endDate: Date | undefined;
        if (owner.endDate) {
          if (owner.endDate instanceof Date) {
            endDate = owner.endDate;
          } else if (typeof owner.endDate === "string") {
            const parsed = new Date(owner.endDate);
            // Validate parsed date - if invalid, skip this entry
            if (isNaN(parsed.getTime())) {
              return null;
            }
            endDate = parsed;
          } else {
            // Invalid date format - skip this entry
            return null;
          }
        }

        // Filter out entries with zero or negative duration (unless it's the current owner)
        if (endDate) {
          const duration = endDate.getTime() - startDate.getTime();
          // If duration is 0 or negative, skip this entry (it's a duplicate or invalid)
          if (duration <= 0) {
            return null;
          }
        }

        return {
          ...owner,
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : undefined,
          blockNumber: typeof owner.blockNumber === "bigint"
            ? owner.blockNumber.toString()
            : owner.blockNumber,
          // Preserve marketplace fields
          isMarketplace: owner.isMarketplace,
          marketplaceName: owner.marketplaceName,
        };
      })
      .filter((owner): owner is NonNullable<typeof owner> => owner !== null);

    // Get expiry date from the most recent registration if available
    let expiryDate: Date | undefined;
    if (data.registrations && data.registrations.length > 0) {
      // Sort registrations by registrationDate descending to get the most recent
      const sortedRegistrations = [...data.registrations].sort((a, b) => {
        const dateA = parseInt(a.registrationDate);
        const dateB = parseInt(b.registrationDate);
        return dateB - dateA; // Descending order
      });
      const latestRegistration = sortedRegistrations[0];
      const expiryTimestamp = parseInt(latestRegistration.expiryDate);
      if (!isNaN(expiryTimestamp) && expiryTimestamp > 0) {
        const expiry = new Date(expiryTimestamp * 1000);
        // Validate expiry date is reasonable (after 2015 and not too far in the past)
        if (expiry.getFullYear() >= 2015 && expiry.getTime() > Date.now() - 86400000) { // At least 1 day in the past
          expiryDate = expiry;
        }
      }
    }

    // Separate current owner from history
    let currentOwnerData: {
      address: string;
      startDate: string;
      endDate?: string;
      transactionHash: string;
      avatar?: string;
    };
    let historicalOwners = ownersWithISOStrings;

    // Get the most recent registration date if available (for newly purchased domains)
    // Only use it if the registrant matches the current owner (to handle new purchases)
    let mostRecentRegistrationDate: Date | null = null;
    if (data.registrations && data.registrations.length > 0) {
      // Sort registrations by date descending to get the most recent
      const sortedRegistrations = [...data.registrations].sort((a, b) => {
        const dateA = parseInt(a.registrationDate);
        const dateB = parseInt(b.registrationDate);
        return dateB - dateA; // Descending order
      });
      const latestReg = sortedRegistrations[0];
      const regTimestamp = parseInt(latestReg.registrationDate);
      if (!isNaN(regTimestamp) && regTimestamp > 0) {
        const regDate = new Date(regTimestamp * 1000);
        // Only use registration date if it's valid and the registrant matches current owner
        // This ensures we're using the correct registration for newly purchased domains
        const registrantMatchesCurrent = latestReg.registrant.id.toLowerCase() === domain.owner.id.toLowerCase();
        if (regDate.getFullYear() >= 2015 && regDate.getFullYear() <= new Date().getFullYear() + 1 && registrantMatchesCurrent) {
          mostRecentRegistrationDate = regDate;
        }
      }
    }

    if (ownersWithISOStrings.length > 0) {
      // Current owner is the domain owner from the contract
      const lastOwner = ownersWithISOStrings[ownersWithISOStrings.length - 1];

      // Check if the last owner matches the current domain owner
      const lastOwnerMatchesCurrent = lastOwner.address.toLowerCase() === domain.owner.id.toLowerCase();

      if (lastOwnerMatchesCurrent) {
        // Last owner IS the current owner - use it and exclude from history
        // Use expiry date as the end date for current owner if available

        // Determine start date: use most recent registration date if it's more recent than last transfer
        // This handles cases where The Graph hasn't indexed the new purchase yet
        let startDate = lastOwner.startDate;
        if (mostRecentRegistrationDate) {
          const lastOwnerDate = new Date(lastOwner.startDate);
          // If registration date is more recent than the last transfer, use registration date
          // This handles newly purchased domains that haven't been indexed yet
          if (mostRecentRegistrationDate > lastOwnerDate) {
            startDate = mostRecentRegistrationDate.toISOString();
          }
        }

        currentOwnerData = {
          address: domain.owner.id,
          startDate: startDate,
          endDate: expiryDate ? expiryDate.toISOString() : undefined, // Use expiry date instead of undefined
          transactionHash: lastOwner.transactionHash || "",
        };
        historicalOwners = ownersWithISOStrings.slice(0, -1);


        // Ensure all historical owners have end dates
        // Historical owners should end when the next owner took over
        historicalOwners = historicalOwners.map((owner, index) => {
          // If owner already has an end date, keep it (but verify it's correct)
          if (owner.endDate) {
            // Verify the end date makes sense - it should be before or equal to next owner's start
            if (index < historicalOwners.length - 1) {
              const nextOwner = historicalOwners[index + 1];
              const ownerEndDate = typeof owner.endDate === "string" ? new Date(owner.endDate) : new Date(owner.endDate);
              const nextStartDate = typeof nextOwner.startDate === "string" ? new Date(nextOwner.startDate) : new Date(nextOwner.startDate);
              // If end date is after next owner's start, fix it
              if (ownerEndDate > nextStartDate) {
                return {
                  ...owner,
                  endDate: nextOwner.startDate,
                };
              }
            }
            return owner;
          }

          // Each historical owner's end date should be the next owner's start date
          if (index < historicalOwners.length - 1) {
            const nextOwner = historicalOwners[index + 1];
            return {
              ...owner,
              endDate: nextOwner.startDate,
            };
          }
          // Last historical owner's end date should be the current owner's start date
          // Use the current owner's start date, not today's date
          return {
            ...owner,
            endDate: currentOwnerData.startDate,
          };
        });
      } else {
        // Last owner is NOT the current owner - domain owner changed after last transfer
        // Use the domain owner as current, and keep all transfers as historical
        // Find when current owner took over (should be after last transfer)
        const lastTransferDate = lastOwner.endDate || lastOwner.startDate;

        // Use most recent registration date if it's more recent than last transfer
        // This handles newly purchased domains that haven't been indexed yet
        let startDate = lastTransferDate;
        if (mostRecentRegistrationDate) {
          const lastTransferDateObj = new Date(lastTransferDate);
          if (mostRecentRegistrationDate > lastTransferDateObj) {
            startDate = mostRecentRegistrationDate.toISOString();
          }
        }

        currentOwnerData = {
          address: domain.owner.id,
          startDate: startDate,
          endDate: expiryDate ? expiryDate.toISOString() : undefined,
          transactionHash: "",
        };
        // All owners in the list are historical
        historicalOwners = ownersWithISOStrings;


        // Ensure the last historical owner has an end date (when current owner took over)
        // Use the current owner's start date, not today's date
        if (historicalOwners.length > 0) {
          const lastHistorical = historicalOwners[historicalOwners.length - 1];
          if (!lastHistorical.endDate) {
            historicalOwners[historicalOwners.length - 1] = {
              ...lastHistorical,
              endDate: currentOwnerData.startDate, // Use current owner's start date, not today
            };
          }
        }
      }
    } else {
      // No transfers found, use current owner from domain
      let registrationDate: Date;

      // Try to get registration date from registrations first
      if (data.registrations && data.registrations.length > 0) {
        const regTimestamp = parseInt(data.registrations[0].registrationDate);
        if (!isNaN(regTimestamp) && regTimestamp > 0) {
          const regDate = new Date(regTimestamp * 1000);
          // Validate date is reasonable (after 2015 when Ethereum/ENS launched)
          if (regDate.getFullYear() >= 2015 && regDate.getFullYear() <= new Date().getFullYear() + 1) {
            registrationDate = regDate;
          } else {
            registrationDate = new Date(); // Fallback to now if invalid
          }
        } else {
          registrationDate = new Date();
        }
      } else if (domain.createdAt) {
        const parsed = parseInt(domain.createdAt);
        if (!isNaN(parsed) && parsed > 0) {
          const createdAtDate = new Date(parsed * 1000);
          // Validate date is reasonable
          if (createdAtDate.getFullYear() >= 2015 && createdAtDate.getFullYear() <= new Date().getFullYear() + 1) {
            registrationDate = createdAtDate;
          } else {
            registrationDate = new Date(); // Fallback to now if invalid
          }
        } else {
          registrationDate = new Date();
        }
      } else {
        registrationDate = new Date();
      }

      // Ensure date is valid
      if (isNaN(registrationDate.getTime()) || registrationDate.getFullYear() < 2015) {
        registrationDate = new Date();
      }

      currentOwnerData = {
        address: domain.owner.id,
        startDate: registrationDate.toISOString(),
        endDate: expiryDate ? expiryDate.toISOString() : undefined, // Use expiry date for current owner
        transactionHash: "",
      };
    }

    // Fetch avatar for current owner from ensdata.net
    if (currentOwnerData) {
      try {
        const ensDataResponse = await fetch(
          `https://api.ensdata.net/${currentOwnerData.address}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (ensDataResponse.ok) {
          const ensData = await ensDataResponse.json();
          if (ensData.avatar_small) {
            currentOwnerData.avatar = ensData.avatar_small;
          }
        }
      } catch (error) {
        // Silently fail if avatar fetch fails - avatar will remain undefined
        console.error("Error fetching avatar:", error);
      }
    }

    return NextResponse.json({
      name: normalizedName,
      owners: historicalOwners,
      currentOwner: currentOwnerData,
      expiryDate: expiryDate ? expiryDate.toISOString() : undefined, // Include expiry date in response
    });
  } catch (error: any) {
    console.error("Error fetching ENS history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch ENS history" },
      { status: 500 }
    );
  }
}
