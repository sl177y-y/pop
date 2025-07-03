"use client";

import { useWalletStore } from "@/store/wallet";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

interface RouteGuardProps {
  children: ReactNode;
}

/**
 * Route guard component to check wallet connection for Aptos or EVM
 * Redirects to home page if no wallet is connected after a brief loading period
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { aptosConnected, evmConnected } = useWalletStore();
  const router = useRouter();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give wallets a moment to initialize from localStorage/sessionStorage
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000); // 1-second delay to check for existing connections

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return; // Wait until check is complete
    }

    // console.log('🛡️ RouteGuard: Checking wallet connections', { aptosConnected, evmConnected });

    // If check is complete and neither wallet is connected, redirect to home
    if (!aptosConnected && !evmConnected) {
      // console.log('❌ No Aptos or EVM wallet connection found, redirecting to home page.');
      router.push('/');
    } else {
      // console.log('✅ At least one wallet is connected, allowing access');
    }
  }, [isReady, aptosConnected, evmConnected, router]);

  // If either wallet is connected, or if we are still waiting for the check, show the content
  if (aptosConnected || evmConnected || !isReady) {
    return <>{children}</>;
  }

  // Fallback loading/redirecting state
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-yellow-500 text-xl flex items-center gap-2">
        <div className="w-4 h-4 border-t-2 border-yellow-500 rounded-full animate-spin"></div>
        <span>Loading...</span>
      </div>
    </div>
  );
}

export default RouteGuard;
