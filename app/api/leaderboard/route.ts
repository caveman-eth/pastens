import { NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";

// The Graph ENS subgraph endpoint
const getSubgraphUrl = () => {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (apiKey) {
    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH`;
  }
  return "https://api.thegraph.com/subgraphs/name/ensdomains/ens";
};

// GraphQL query to get transfers with domain information
// We'll fetch a large number of transfers and aggregate by domain
const GET_TRANSFERS_WITH_DOMAINS = `
  query GetTransfersWithDomains($first: Int!, $skip: Int!, $orderDirection: String!) {
    transfers(
      first: $first
      skip: $skip
      orderBy: blockNumber
      orderDirection: $orderDirection
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

interface Transfer {
  id: string;
  domain: {
    id: string;
    name: string;
  };
  blockNumber: string;
  transactionID: string;
  owner: {
    id: string;
  };
}

interface DomainTransferCount {
  name: string;
  transferCount: number;
}

// In-memory cache for leaderboard data
// Cache expires after 30 minutes (1800000 ms)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cachedData: {
  data: {
    leaderboard: DomainTransferCount[];
    totalTransfersAnalyzed: number;
  };
  timestamp: number;
} | null = null;

export async function GET() {
  try {
    const subgraphUrl = getSubgraphUrl();
    const apiKey = process.env.THE_GRAPH_API_KEY;
    const client = new GraphQLClient(subgraphUrl, {
      headers: apiKey && !subgraphUrl.includes('gateway.thegraph.com')
        ? {
          Authorization: `Bearer ${apiKey}`,
        }
        : {},
    });

    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cachedData.timestamp) < CACHE_TTL) {
      // Return cached data with cache headers
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600', // 30 min cache, 1 hour stale
        },
      });
    }

    // Fetch transfers in batches to get a good sample
    // We'll fetch from both ends (recent and old) to get better coverage
    const batchSize = 1000;
    const batchesPerDirection = 5; // Fetch 5000 transfers from each direction = 10000 total
    const allTransfers: Transfer[] = [];

    // Helper function to fetch batches
    const fetchBatches = async (orderDirection: "asc" | "desc", label: string) => {
      for (let i = 0; i < batchesPerDirection; i++) {
        try {
          const data = await client.request<{
            transfers: Transfer[];
          }>(GET_TRANSFERS_WITH_DOMAINS, {
            first: batchSize,
            skip: i * batchSize,
            orderDirection,
          });

          if (!data.transfers || data.transfers.length === 0) {
            break; // No more transfers
          }

          allTransfers.push(...data.transfers);

          // If we got fewer than batchSize, we've reached the end
          if (data.transfers.length < batchSize) {
            break;
          }
        } catch (error: any) {
          // Handle rate limiting
          if (error.response?.status === 429) {
            throw error; // Re-throw to be handled by outer catch
          }
          // For other errors, continue with what we have
          console.error(`Error fetching ${label} batch ${i}:`, error);
          break;
        }
      }
    };

    try {
      // Fetch recent transfers (descending order)
      await fetchBatches("desc", "recent");
      
      // Fetch older transfers (ascending order) for better coverage
      await fetchBatches("asc", "old");
    } catch (error: any) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. The Graph API is rate-limiting requests. Please wait a moment and try again."
          },
          { status: 429 }
        );
      }
      // If we have some transfers, continue with what we have
      if (allTransfers.length === 0) {
        throw error;
      }
    }

    // Group transfers by domain and count actual ownership changes
    // Similar to how the main API processes transfers - count unique owner transitions
    const domainTransfers = new Map<string, Transfer[]>();

    // First, group transfers by domain
    for (const transfer of allTransfers) {
      if (transfer.domain && transfer.domain.name) {
        const domainName = transfer.domain.name.toLowerCase();
        if (!domainTransfers.has(domainName)) {
          domainTransfers.set(domainName, []);
        }
        domainTransfers.get(domainName)!.push(transfer);
      }
    }

    // Count actual ownership changes per domain
    // Count transitions between different owners (not the initial owner)
    const domainCounts = new Map<string, number>();

    for (const [domainName, transfers] of domainTransfers.entries()) {
      // Sort transfers by block number
      const sortedTransfers = [...transfers].sort((a, b) => 
        Number(a.blockNumber) - Number(b.blockNumber)
      );

      // Count ownership changes (transitions between different owners)
      let ownershipChangeCount = 0;
      let previousOwner: string | null = null;

      for (const transfer of sortedTransfers) {
        const currentOwner = transfer.owner.id.toLowerCase();
        
        // Skip if same owner as previous (consolidate consecutive ownership)
        if (previousOwner !== null && currentOwner === previousOwner) {
          continue;
        }

        // If we have a previous owner and it's different, count as ownership change
        if (previousOwner !== null && currentOwner !== previousOwner) {
          ownershipChangeCount++;
        }

        previousOwner = currentOwner;
      }

      // Only count if there were actual ownership changes
      if (ownershipChangeCount > 0) {
        domainCounts.set(domainName, ownershipChangeCount);
      }
    }

    // Convert to array and sort by count
    const domainTransferCounts: DomainTransferCount[] = Array.from(
      domainCounts.entries()
    )
      .map(([name, transferCount]) => ({
        name,
        transferCount,
      }))
      .sort((a, b) => b.transferCount - a.transferCount)
      .slice(0, 10); // Top 10

    const responseData = {
      leaderboard: domainTransferCounts,
      totalTransfersAnalyzed: allTransfers.length,
    };

    // Update cache
    cachedData = {
      data: responseData,
      timestamp: now,
    };

    // Return response with cache headers
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600', // 30 min cache, 1 hour stale
      },
    });
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

