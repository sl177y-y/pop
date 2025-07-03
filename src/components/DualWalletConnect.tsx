'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WalletConnect } from './WalletConnect';
import { EVMWalletConnect } from './EVMWalletConnect';
import { useWalletStore } from '@/store/wallet';
import AngularButton from './AngularButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

interface DualWalletConnectProps {
  redirectPath?: string;
  children?: React.ReactNode;
}

export function DualWalletConnect({ redirectPath = '/vault', children }: DualWalletConnectProps) {
  const router = useRouter();
  const { 
    aptosWalletAddress, 
    evmWalletAddress, 
    aptosConnected, 
    evmConnected, 
  } = useWalletStore();
  
  const [activeTab, setActiveTab] = useState<'aptos' | 'ethereum'>('aptos');
  const [isConnectingAptos, setIsConnectingAptos] = useState(false);
  const [isConnectingEvm, setIsConnectingEvm] = useState(false);
  const [evmModalOpen, setEvmModalOpen] = useState(false);
  const { isConnected: evmIsConnected } = useAccount();

  // Handle EVM connection cancellation
  useEffect(() => {
    if (!evmModalOpen && isConnectingEvm && !evmConnected) {
      const timer = setTimeout(() => {
        if (!evmConnected) {
          setIsConnectingEvm(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [evmModalOpen, isConnectingEvm, evmConnected]);

  const hasAnyWalletConnected = aptosConnected || evmConnected;

  const handleProceed = () => {
    if (hasAnyWalletConnected) {
      router.push(redirectPath);
    }
  };

  const handleStartChallengeAptos = () => {
    setIsConnectingAptos(true);
  };

  const handleStartChallengeEvm = () => {
    setIsConnectingEvm(true);
  };

  const handleAptosConnectSuccess = () => {
    setIsConnectingAptos(false);
    // console.log('Aptos wallet connected');
    // No auto redirect - user clicks proceed manually
  };

  const handleAptosConnectError = () => {
    setIsConnectingAptos(false);
    // console.log('Aptos connection failed or cancelled');
  };

  const updateUserWithEvmAddress = useCallback(async (evmAddress: string) => {
    // Avoid API call if aptos wallet is not connected, as it's used as the primary key
    if (!aptosWalletAddress) {
      console.warn('Cannot update EVM address without a connected Aptos wallet.');
      return;
    }
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: aptosWalletAddress,
          evm_wallet_address: evmAddress,
        }),
      });
      if (response.ok) {
        // console.log('User updated with EVM address');
      } else {
        const errorData = await response.json();
        console.error('Failed to update user with EVM address:', errorData);
      }
    } catch (error) {
      console.error('Error updating user with EVM address:', error);
    }
  }, [aptosWalletAddress]); // Dependency on aptosWalletAddress

  const handleEvmConnectSuccess = useCallback((address: string) => {
    setIsConnectingEvm(false);
    // console.log('EVM wallet connected:', address);
    updateUserWithEvmAddress(address);
    // No auto redirect - user clicks proceed manually
  }, [updateUserWithEvmAddress]);

  const isCurrentTabConnected = () => {
    return activeTab === 'aptos' ? aptosConnected : evmConnected;
  };

  const isCurrentTabConnecting = () => {
    return activeTab === 'aptos' ? isConnectingAptos : isConnectingEvm;
  };

  const renderButtonContent = () => {
    if (isCurrentTabConnecting()) {
      return '[CONNECTING...]';
    }
    if (isCurrentTabConnected()) {
      return '[PROCEED]';
    }
    return '[START CHALLENGE]';
  };

  const getButtonColor = () => {
    if (isCurrentTabConnecting()) return "from-yellow-500 to-yellow-600";
    if (isCurrentTabConnected()) return "from-green-500 to-green-600";
    if (activeTab === 'ethereum') return "from-blue-500 to-blue-600";
    return "from-orange-500 to-orange-600";
  };

  const getCurrentTabStartHandler = () => {
    return activeTab === 'aptos' ? handleStartChallengeAptos : handleStartChallengeEvm;
  };
  
  const MainButton = ({ onClick = undefined }: { onClick?: () => void }) => (
    <div className="w-full" style={{ willChange: 'auto' }}>
      <AngularButton
        buttonWidth="350px"
        buttonHeight="65px"
        className="font-bold text-lg transition-none"
        href="#"
        onClick={onClick || (isCurrentTabConnected() ? handleProceed : getCurrentTabStartHandler())}
        bgColor={getButtonColor()}
        disabled={isCurrentTabConnecting()}
      >
        {renderButtonContent()}
      </AngularButton>
    </div>
  );

  return (
    <div className="flex flex-col items-start space-y-1 w-full max-w-md ml-[-30px]" style={{ willChange: 'auto' }}>
      {/* Chain Selector - Always visible */}
      <div className="flex bg-gray-800 rounded-lg p-1 w-full max-w-[350px]">
        <button
          onClick={() => setActiveTab('aptos')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'aptos' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
          }`}
        >
          Aptos Network
        </button>
        <button
          onClick={() => setActiveTab('ethereum')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'ethereum' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'
          }`}
        >
          Ethereum Network
        </button>
      </div>

      {/* Wallet Connection Interface */}
      {isCurrentTabConnected() ? (
        <MainButton />
      ) : (
        activeTab === 'aptos' ? (
          <WalletConnect
            redirectPath=""
            onSuccess={handleAptosConnectSuccess}
            onError={handleAptosConnectError}
            checkExistingUser={true}
          >
            <MainButton />
          </WalletConnect>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal, connectModalOpen }) => {
              // Track modal state for cancellation handling
              React.useEffect(() => {
                setEvmModalOpen(connectModalOpen);
              }, [connectModalOpen]);

              return (
                <MainButton 
                  onClick={() => {
                    handleStartChallengeEvm();
                    openConnectModal();
                  }}
                />
              );
            }}
          </ConnectButton.Custom>
        )
      )}

      {/* Hidden EVM wallet handler */}
      <div style={{ display: 'none' }}>
        <EVMWalletConnect onConnect={handleEvmConnectSuccess} />
      </div>
    </div>
  );
}