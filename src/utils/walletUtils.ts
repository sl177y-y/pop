'use client';

import { useWalletStore } from '@/store/wallet';

// Utility to check if user has the required wallet for a vault
export function useWalletValidation() {
  const { aptosWalletAddress, evmWalletAddress, aptosConnected, evmConnected } = useWalletStore();

  const validateWalletForVault = (vault: any) => {
    if (vault.blockchain === 'ethereum') {
      return {
        hasRequiredWallet: evmConnected && evmWalletAddress,
        requiredWalletType: 'Ethereum',
        currentAddress: evmWalletAddress,
        missingWalletMessage: 'Please connect your Ethereum wallet (MetaMask) to access this vault.'
      };
    } else {
      // Aptos or default
      return {
        hasRequiredWallet: aptosConnected && aptosWalletAddress,
        requiredWalletType: 'Aptos',
        currentAddress: aptosWalletAddress,
        missingWalletMessage: 'Please connect your Aptos wallet (Petra) to access this vault.'
      };
    }
  };

  const getActiveWalletForChain = (blockchain: 'aptos' | 'ethereum') => {
    if (blockchain === 'ethereum') {
      return evmConnected ? evmWalletAddress : null;
    } else {
      return aptosConnected ? aptosWalletAddress : null;
    }
  };

  return {
    validateWalletForVault,
    getActiveWalletForChain,
    hasAnyWallet: aptosConnected || evmConnected,
    aptosWallet: { address: aptosWalletAddress, connected: aptosConnected },
    evmWallet: { address: evmWalletAddress, connected: evmConnected }
  };
}

// Function to format wallet address for display
export function formatWalletAddress(address: string | null, chars: number = 6): string {
  if (!address) return 'Not connected';
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

// Function to get blockchain display name
export function getBlockchainDisplayName(blockchain: string | undefined): string {
  switch (blockchain) {
    case 'ethereum':
      return 'Ethereum';
    case 'aptos':
      return 'Aptos';
    default:
      return 'Aptos'; // Default fallback
  }
}

// Function to get blockchain color
export function getBlockchainColor(blockchain: string | undefined): string {
  switch (blockchain) {
    case 'ethereum':
      return 'text-blue-400';
    case 'aptos':
      return 'text-orange-400';
    default:
      return 'text-orange-400'; // Default fallback
  }
}

// Function to get token display name
export function getTokenDisplayName(tokenType: string | undefined, tokenAddress: string | undefined, amount: number | undefined): string {
  if (!tokenType || !amount) return '';
  
  switch (tokenType) {
    case 'native':
      return `${amount} ETH`;
    case 'erc20':
      return `${amount} ${tokenAddress ? 'ERC20' : 'tokens'}`;
    case 'erc721':
      return tokenAddress ? 'NFT' : 'NFT required';
    case 'aptos_coin':
      return `${amount} APT`;
    default:
      return `${amount} tokens`;
  }
}

// Function to check if a vault has token requirements
export function hasTokenRequirements(vault: any): boolean {
  return !!(vault.required_token_type && vault.required_amount);
}