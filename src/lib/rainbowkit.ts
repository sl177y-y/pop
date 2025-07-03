'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';

// Define Sepolia chain with single reliable RPC endpoint
const sepoliaChain = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: [
        'https://ethereum-sepolia-rpc.publicnode.com'
      ]
    },
    public: {
      http: [
        'https://ethereum-sepolia-rpc.publicnode.com'
      ]
    }
  }
};

// Singleton pattern to prevent multiple initializations
let configInstance: any = null;

const createConfig = () => {
  if (configInstance) {
    return configInstance;
  }

  configInstance = getDefaultConfig({
    appName: 'CandyShop21',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'default-project-id',
    chains: [sepoliaChain, mainnet],
    ssr: false, // Disable SSR to prevent indexedDB errors
  });

  return configInstance;
};

export const config = createConfig();

export const wagmiConfig = config;