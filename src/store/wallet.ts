'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  // Aptos wallet
  aptosWalletAddress: string | null;
  aptosConnected: boolean;
  
  // EVM wallet
  evmWalletAddress: string | null;
  evmConnected: boolean;
  
  // Selected chain for vault interaction
  selectedChain: 'aptos' | 'ethereum' | null;
  
  // User credits and data
  credits: number;
  userId: number | null;
  
  // Actions
  setAptosWallet: (address: string | null, connected: boolean) => void;
  setEvmWallet: (address: string | null, connected: boolean) => void;
  setSelectedChain: (chain: 'aptos' | 'ethereum' | null) => void;
  setCredits: (credits: number) => void;
  setUserId: (userId: number | null) => void;
  clearWallets: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      aptosWalletAddress: null,
      aptosConnected: false,
      evmWalletAddress: null,
      evmConnected: false,
      selectedChain: null,
      credits: 0,
      userId: null,

      // Actions
      setAptosWallet: (address, connected) => {
        console.log('🔄 Updating Aptos wallet store:', { address, connected });
        set({ aptosWalletAddress: address, aptosConnected: connected });
      },
      
      setEvmWallet: (address, connected) => {
        console.log('🔄 Updating EVM wallet store:', { address, connected });
        set({ evmWalletAddress: address, evmConnected: connected });
      },
      
      setSelectedChain: (chain) =>
        set({ selectedChain: chain }),
      
      setCredits: (credits) =>
        set({ credits }),
      
      setUserId: (userId) =>
        set({ userId }),
      
      clearWallets: () =>
        set({
          aptosWalletAddress: null,
          aptosConnected: false,
          evmWalletAddress: null,
          evmConnected: false,
          selectedChain: null,
          credits: 0,
          userId: null,
        }),
    }),
    {
      name: 'wallet-storage',
      partialize: (state) => ({
        aptosWalletAddress: state.aptosWalletAddress,
        aptosConnected: state.aptosConnected,
        evmWalletAddress: state.evmWalletAddress,
        evmConnected: state.evmConnected,
        selectedChain: state.selectedChain,
        credits: state.credits,
        userId: state.userId,
      }),
    }
  )
);