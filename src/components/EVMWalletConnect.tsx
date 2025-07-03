'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { useWalletStore } from '@/store/wallet';
import { useEffect } from 'react';
import AngularButton from './AngularButton';

interface EVMWalletConnectProps {
  children?: React.ReactNode;
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function EVMWalletConnect({ children, onConnect, onDisconnect }: EVMWalletConnectProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { setEvmWallet, evmWalletAddress, evmConnected } = useWalletStore();

  useEffect(() => {
    if (isConnected && address && (!evmConnected || evmWalletAddress !== address)) {
      // console.log('✅ Setting EVM wallet as connected:', address);
      setEvmWallet(address, true);
      if (onConnect) onConnect(address);
    } else if (!isConnected && (evmConnected || evmWalletAddress !== null)) {
      // console.log('❌ Setting EVM wallet as disconnected');
      setEvmWallet(null, false);
      if (onDisconnect) onDisconnect();
    }
  }, [isConnected, address, evmConnected, evmWalletAddress, setEvmWallet, onConnect, onDisconnect]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <AngularButton
                    buttonWidth="280px"
                    buttonHeight="50px"
                    className="font-bold"
                    onClick={openConnectModal}
                    href="#"
                    bgColor="from-blue-500 to-blue-600"
                  >
                    Connect Ethereum Wallet
                  </AngularButton>
                );
              }

              if (chain.unsupported) {
                return (
                  <AngularButton
                    buttonWidth="280px"
                    buttonHeight="50px"
                    className="font-bold"
                    onClick={openChainModal}
                    href="#"
                    bgColor="from-red-500 to-red-600"
                  >
                    Wrong network
                  </AngularButton>
                );
              }

              return (
                <div className="flex gap-2">
                  <AngularButton
                    buttonWidth="200px"
                    buttonHeight="50px"
                    className="font-bold text-sm"
                    onClick={openChainModal}
                    href="#"
                    bgColor="from-blue-500 to-blue-600"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          overflow: 'hidden',
                          marginRight: 4,
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 12, height: 12 }}
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </AngularButton>

                  <AngularButton
                    buttonWidth="150px"
                    buttonHeight="50px"
                    className="font-bold text-xs"
                    onClick={openAccountModal}
                    href="#"
                    bgColor="from-green-500 to-green-600"
                  >
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
                  </AngularButton>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}