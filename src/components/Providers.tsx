'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { useEffect } from 'react';

// Singleton pattern for QueryClient to prevent multiple WalletConnect initializations
let queryClientInstance: QueryClient | null = null;

const getQueryClient = () => {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            // Don't retry WalletConnect related errors
            if (error?.message?.includes('indexedDB') || error?.message?.includes('WalletConnect')) {
              return false;
            }
            return failureCount < 3;
          },
        },
      },
    });
  }
  return queryClientInstance;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // Handle unhandled promise rejections related to WalletConnect
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes('indexedDB') ||
        event.reason?.message?.includes('WalletConnect') ||
        event.reason?.message?.includes('keyvaluestorage')
      ) {
        // Silently handle WalletConnect SSR-related errors
        event.preventDefault();
        console.warn('WalletConnect SSR warning (non-critical):', event.reason?.message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}