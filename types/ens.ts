export interface ENSOwner {
  address: string;
  ensName?: string;
  startDate: Date;
  endDate?: Date;
  transactionHash: string;
  isMarketplace?: boolean;
  marketplaceName?: string;
  isBurned?: boolean;
}

export interface ENSDomain {
  name: string;
  node: string;
  owner: string;
  resolver?: string;
  registrationDate?: Date;
  expiryDate?: Date;
}

