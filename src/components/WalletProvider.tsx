"use client";

import { PetraWallet } from "petra-plugin-wallet-adapter";
// @ts-ignore
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { ReactNode } from "react";

// Initialize all the wallets you want to support
const wallets = [
  new PetraWallet(),
  
];

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      plugins={wallets}
      autoConnect={true}
      dappConfig={{
        network: "mainnet",
        aptosConnectDappId: "candyshop2"
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}