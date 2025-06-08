declare module '@aptos-labs/wallet-adapter-react' {
  export interface AccountInfo {
    address: string;
    publicKey?: string;
    minKeysRequired?: number;
    ansName?: string;
  }

  export interface WalletInfo {
    account?: AccountInfo;
    connected: boolean;
    connecting: boolean;
    wallet?: any;
    wallets: any[];
    disconnect: () => Promise<void>;
    connect: (walletName: string) => Promise<void>;
    select: (walletName: string) => void;
    signAndSubmitTransaction: (transaction: any, options?: any) => Promise<any>;
    signTransaction: (transaction: any, options?: any) => Promise<any>;
    signMessage: (message: any) => Promise<any>;
  }

  export function useWallet(): WalletInfo;
} 