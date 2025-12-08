# pastens

**pastens** (pronounced /pæst tɛns/) - A tool for exploring the ownership history of Ethereum Name Service (ENS) domains, showing past and current owners with detailed timeline information.

## Overview

pastens is a Next.js web application that allows users to search for any ENS domain and view its ownership history. The application displays:

- Historical ownership timeline with dates and transaction hashes
- Current owner information with avatar support

## Features

- 📅 View ownership history with timestamps
- 🏪 Detect marketplace transactions and escrow contracts (wip)

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Blockchain**: 
  - `@ensdomains/ensjs` - ENS domain resolution
  - `viem` - Ethereum interaction library
- **Data**: 
  - The Graph (ENS subgraph) - ENS domain and transfer data
  - GraphQL with `graphql-request`
- **UI**: React 19, Lucide React icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/FranzQ/pastens.git
cd pastens
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:

```bash
# Required: Ethereum RPC endpoint for fetching block timestamps
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optional: The Graph API key for better rate limits
THE_GRAPH_API_KEY=your_graph_api_key
```

**Note**: You can get an RPC endpoint from:
- [Alchemy](https://www.alchemy.com/)
- [Infura](https://www.infura.io/)
- [QuickNode](https://www.quicknode.com/)

The Graph API key is optional but recommended to avoid rate limiting. You can get one from [The Graph Studio](https://thegraph.com/studio/).

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
pastens/
├── app/
│   ├── api/
│   │   └── ens/
│   │       └── route.ts          # API route for fetching ENS history
│   ├── components/
│   │   └── ENSHistory.tsx        # Component for displaying ownership history
│   ├── page.tsx                   # Main page with search interface
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Global styles
├── types/
│   └── ens.ts                     # TypeScript types for ENS data
├── package.json
└── README.md
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## How It Works

1. **Search**: User enters an ENS domain name
2. **Query The Graph**: The application queries The Graph's ENS subgraph to fetch:
   - Domain registration information
   - All ownership transfers
   - Block numbers and transaction hashes
3. **Fetch Block Timestamps**: Uses the RPC endpoint to get accurate timestamps for each transfer
4. **Process History**: 
   - Consolidates consecutive ownership periods
   - Detects marketplace transactions
   - Separates current owner from historical owners
5. **Display**: Shows a timeline with all ownership changes

## API Endpoints

### GET `/api/ens?name=<domain>`

Fetches the ownership history for an ENS domain.

**Parameters:**
- `name` (required): ENS domain name (e.g., `ens.eth` or `vitalik`)

**Response:**
```json
{
  "name": "ens.eth",
  "owners": [
    {
      "address": "0x...",
      "startDate": "2023-01-01T00:00:00.000Z",
      "endDate": "2023-06-15T00:00:00.000Z",
      "transactionHash": "0x...",
      "blockNumber": "12345678"
    }
  ],
  "currentOwner": {
    "address": "0x...",
    "startDate": "2023-06-15T00:00:00.000Z",
    "endDate": "2024-06-15T00:00:00.000Z",
    "transactionHash": "0x...",
    "avatar": "https://..."
  },
  "expiryDate": "2024-06-15T00:00:00.000Z"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_RPC_URL` | Yes | Ethereum RPC endpoint URL |
| `THE_GRAPH_API_KEY` | No | The Graph API key for better rate limits |

## License

MIT

## Links

- **Homepage**: [https://pastens.com](https://pastens.com)
- **Repository**: [https://github.com/FranzQ/pastens](https://github.com/FranzQ/pastens)
- **ENS Domains**: [https://ens.domains](https://ens.domains)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
