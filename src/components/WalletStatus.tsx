"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";

export function WalletStatus() {
  const { account, connected, disconnect } = useWallet();

  if (!connected || !account) {
    return null;
  }

  // Format wallet address to show only the first and last few characters
  const formatAddress = (address: string) => {
    if (!address) return "";
    const start = address.slice(0, 6);
    const end = address.slice(-4);
    return `${start}...${end}`;
  };

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center bg-black bg-opacity-70 px-4 py-2 rounded-lg border border-yellow-500">
      <div className="mr-2 bg-yellow-500 w-2 h-2 rounded-full animate-pulse"></div>
      <span className="text-yellow-500 mr-2 font-bold">{formatAddress(account.address)}</span>
      <button 
        onClick={disconnect} 
        className="text-red-500 bg-transparent border-none hover:text-red-300"
      >
        Disconnect
      </button>
    </div>
  );
} 