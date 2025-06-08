"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

interface RouteGuardProps {
  children: ReactNode;
}

/**
 * Route guard component to check wallet connection
 * Redirects to home page if wallet is not connected after giving time for wallet to load
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { connected, connecting } = useWallet();
  const router = useRouter();
  // Track initial load to see if user connected before in this session
  const hasConnectedBefore = typeof window !== 'undefined' && sessionStorage.getItem('hasConnected') === 'true';
  const [walletCheckComplete, setWalletCheckComplete] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Check for wallet address in localStorage as additional validation
  const checkLocalWallet = () => {
    if (typeof window === 'undefined') return false;
    
    const walletAddress = localStorage.getItem('userWalletAddress') || 
                         localStorage.getItem('wallet_address') || 
                         localStorage.getItem('walletAddress') || 
                         localStorage.getItem('aptosWalletAddress');
    
    return !!walletAddress;
  };

  // Check immediately if we have a wallet in localStorage to show page right away
  const hasLocalWallet = checkLocalWallet();

  useEffect(() => {
    // Give wallet time to initialize and auto-connect
    const walletCheckTimer = setTimeout(() => {
      setWalletCheckComplete(true);
    }, 2000); // Wait 2 seconds for wallet to load

    return () => clearTimeout(walletCheckTimer);
  }, []);

  useEffect(() => {
    // Don't check until wallet check is complete
    if (!walletCheckComplete) {
      return;
    }

    if (connecting) {
      return;
    }
    
    if (connected) {
      // Save flag so refresh won't redirect
      sessionStorage.setItem('hasConnected', 'true');
      setShouldRedirect(false);
      return;
    }

    // Check if wallet exists in localStorage
    const currentLocalWallet = checkLocalWallet();
    
    // If not connected but has wallet in localStorage or connected before, allow access
    if (currentLocalWallet || hasConnectedBefore) {
      // console.log('Wallet found in localStorage or connected before, allowing access');
      setShouldRedirect(false);
      return;
    }
    
    // If not connected and no wallet found, redirect after delay
    if (!connected && !hasConnectedBefore && !currentLocalWallet) {
      // console.log('No wallet connection found, redirecting to home page');
      setShouldRedirect(true);
      router.push('/');
    }
  }, [connected, connecting, hasConnectedBefore, router, walletCheckComplete]);

  // Only show loading/redirect if wallet check is complete and we should redirect
  if (walletCheckComplete && shouldRedirect) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-yellow-500 text-xl">Redirecting...</div>
      </div>
    );
  }

  // Show the page immediately if we have a wallet in localStorage or if wallet check isn't complete yet
  // This allows the page to render while wallet is loading in the background
  if (hasLocalWallet || hasConnectedBefore || !walletCheckComplete || connected) {
    return <>{children}</>;
  }

  // Fallback loading state (should rarely be reached)
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-yellow-500 text-xl">Loading...</div>
    </div>
  );
}

export default RouteGuard;
