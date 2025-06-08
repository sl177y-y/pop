"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { handleWalletConnection } from "@/lib/walletService";
import React from 'react';

// API helpers
async function fetchUserByWallet(walletAddress: string) {
  const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchUserIdFromWallet(walletAddress: string): Promise<number | null> {
  const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

async function fetchUserCredits(walletAddress: string): Promise<number> {
  const res = await fetch(`/api/users/credits?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.credits ?? 0;
}

// Helper to check if user has published APT CoinStore
async function hasAptosCoinStore(walletAddress: string): Promise<boolean> {
  try {
    // Query Aptos mainnet for CoinStore<APT> resource
    const res = await fetch(
      `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${walletAddress}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`
    );
    return res.ok;
  } catch (e) {
    return false;
  }
}

interface WalletConnectProps {
  children: React.ReactNode;
  onSuccess?: () => void;
  redirectPath?: string;
  checkExistingUser?: boolean;
}

export function WalletConnect({ children, onSuccess, redirectPath, checkExistingUser }: WalletConnectProps) {
  const { connect, account, connected, wallets } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const router = useRouter();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [userDataPrefetched, setUserDataPrefetched] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Function to prefetch and cache user details
  const prefetchUserData = async (walletAddress: string) => {
    try {
      // console.log('Prefetching user data for:', walletAddress);
      
      // Get user from database and cache in localStorage
      const user = await fetchUserByWallet(walletAddress);
      if (user) {
        // console.log('User data fetched:', user);
        localStorage.setItem('userData', JSON.stringify(user));
        
        // Also fetch and cache userId separately as it's often needed
        const userId = await fetchUserIdFromWallet(walletAddress);
        if (userId) {
          localStorage.setItem('cachedUserId', userId.toString());
          // console.log('User ID cached:', userId);
        }
        
        // Fetch and cache credit balance
        const credits = await fetchUserCredits(walletAddress);
        localStorage.setItem('cachedUserCredits', credits.toString());
        // console.log('User credits cached:', credits);
      }
      
      setUserDataPrefetched(true);
      return user;
    } catch (error) {
      // console.error('Error prefetching user data:', error);
      return null;
    }
  };

  // Check for wallet in localStorage on page load, before wallet connect
  useEffect(() => {
    const checkLocalWallet = async () => {
      // Only run this once
      if (userDataPrefetched) return;
      
      // Check for wallet address in localStorage
      const storedWalletAddress = localStorage.getItem('userWalletAddress') || 
                                 localStorage.getItem('wallet_address') || 
                                 localStorage.getItem('walletAddress') || 
                                 localStorage.getItem('aptosWalletAddress');
      
      if (storedWalletAddress) {
        // console.log('Found wallet address in localStorage:', storedWalletAddress);
        // Prefetch user data in the background
        await prefetchUserData(storedWalletAddress);
      }
    };
    
    checkLocalWallet();
  }, [userDataPrefetched]);

  // Whenever wallet address is available, check and transfer if needed
  useEffect(() => {
    const tryTransferOcta = async (address: string) => {
      if (!address) return;
      // Only transfer if user has NOT published CoinStore
      const hasStore = await hasAptosCoinStore(address);
      if (!hasStore) {
        try {
          await fetch('/api/register-aptos-coin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address })
          });
          // console.log('Sent 1 Octa to user wallet:', address);
        } catch (err) {
          // console.error('Failed to send 1 Octa to user wallet:', err);
        }
      } else {
        // console.log('User already has APT CoinStore, not sending Octa:', address);
      }
    };

    // Check for wallet address in localStorage or from account
    const walletAddress = account?.address ||
      localStorage.getItem('userWalletAddress') ||
      localStorage.getItem('wallet_address') ||
      localStorage.getItem('walletAddress') ||
      localStorage.getItem('aptosWalletAddress');

    if (walletAddress) {
      tryTransferOcta(walletAddress);
    }
  }, [account?.address]);

  // Check for existing wallet connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      // Skip if we're not checking for existing users or if the initial check is done
      if (!checkExistingUser || initialCheckDone) return;
      
      // If already connected and we have an account
      if (connected && account) {
        try {
          // Ensure wallet address is consistently stored
          if (account.address) {
            localStorage.setItem('userWalletAddress', account.address);
          }
          
          // Check if user exists in database and prefetch data
          const existingUser = await prefetchUserData(account.address);
          
          if (existingUser) {
            // console.log('Existing user with connected wallet found');
            setIsLoggedIn(true);
            return;
          } else {
            // User doesn't exist, register them with 0 credits
            const newUser = await handleWalletConnection(account.address);
            // Cache new user data
            localStorage.setItem('userData', JSON.stringify(newUser));
            setIsLoggedIn(true);
          }
        } catch (error) {
          // console.error('Error checking existing wallet:', error);
        }
      }
      
      setInitialCheckDone(true);
    };
    
    checkExistingConnection();
  }, [connected, account, router, checkExistingUser, initialCheckDone, redirectPath]);

  // Handle successful connection (after button click)
  useEffect(() => {
    const registerUser = async () => {
      if (connected && account && isConnecting) {
        setIsProcessing(true);
        setConnectionError(null);
        
        try {
          // Save wallet address to localStorage with a consistent key
          if (account.address) {
            // console.log('Saving wallet address to localStorage:', account.address);
            localStorage.setItem('userWalletAddress', account.address);
          }
          
          // Create/update user in database
          const user = await handleWalletConnection(account.address);
          // console.log('User registered/updated in database');
          
          // Cache the user data
          localStorage.setItem('userData', JSON.stringify(user));
          
          // Prefetch additional user details
          await prefetchUserData(account.address);
          
          setIsLoggedIn(true);

          // Check if user already exists and determine where to redirect
          if (checkExistingUser) {
            const existingUser = await fetchUserByWallet(account.address);
            if (existingUser) {
              setIsConnecting(false);
              setIsProcessing(false);
              return;
            }
          }
          
          if (onSuccess) {
            onSuccess();
          }
          
          setIsConnecting(false);
          setIsProcessing(false);
        } catch (error) {
          // console.error('Error registering user:', error);
          setConnectionError('Failed to register user. Please try again.');
          setIsConnecting(false);
          setIsProcessing(false);
        }
      }
    };
    
    registerUser();
  }, [connected, account, isConnecting, onSuccess, redirectPath, router, checkExistingUser]);

  const handleConnect = useCallback(async () => {
    try {
      setConnectionError(null);
      
      // If already connected, just perform the success actions without trying to connect again
      if (connected && account) {
        // console.log('Wallet already connected, proceeding with flow');
        
        setIsProcessing(true);
        
        // Save wallet address to localStorage with a consistent key if needed
        if (account.address) {
          // console.log('Ensuring wallet address is saved to localStorage:', account.address);
          localStorage.setItem('userWalletAddress', account.address);
          
          // Prefetch user data for smoother experience
          await prefetchUserData(account.address);
        }
        
        setIsLoggedIn(true);

        // Check if user exists and determine where to redirect
        if (checkExistingUser) {
          try {
            const existingUser = await fetchUserByWallet(account.address);
            if (existingUser) {
              setIsProcessing(false);
              return;
            } else {
              // User doesn't exist, register them
              const newUser = await handleWalletConnection(account.address);
              // Cache the new user data
              localStorage.setItem('userData', JSON.stringify(newUser));
              setIsProcessing(false);
              return;
            }
          } catch (error) {
            // console.error('Error checking existing user:', error);
            setConnectionError('Error checking user account. Please try again.');
            setIsProcessing(false);
          }
        }
        
        // If specific redirect path is provided, use it
        if (redirectPath) {
          router.push(redirectPath);
          setIsProcessing(false);
          return;
        }
        
        // Execute success callback if provided
        if (onSuccess) {
          onSuccess();
        }
        
        setIsProcessing(false);
        return;
      }
      
      // Only set connecting flag if we're actually connecting
      setIsConnecting(true);
      
      // If user has wallets installed, connect to the first available wallet
      if (wallets && wallets.length > 0) {
        await connect(wallets[0].name);
      } else {
        // If no wallet is installed, redirect to wallet installation page or show an error
        window.open("https://petra.app/", "_blank");
        setIsConnecting(false);
        setConnectionError('Please install Petra wallet to continue.');
      }
    } catch (error) {
      // console.error("Failed to connect wallet:", error);
      setIsConnecting(false);
      setIsProcessing(false);
      setConnectionError('Failed to connect wallet. Please try again or refresh the page.');
    }
  }, [connect, wallets, connected, account, router, onSuccess, redirectPath, checkExistingUser]);

  // Clone children with loading state if necessary
  // This is a simpler approach that doesn't rely on component type checking
  const childElement = React.Children.only(children) as React.ReactElement<any>;
  
  // Determine the loading text based on current state
  const getLoadingText = () => {
    if (isConnecting && !isProcessing) {
      return 'CONNECTING';
    } else if (isProcessing) {
      return 'PROCESSING';
    }
    return 'LOADING';
  };
  
  const buttonProps = {
    ...childElement.props,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent default href navigation if it's an anchor
      if (isLoggedIn) {
        if (redirectPath) {
          router.push(redirectPath);
        } else {
          router.push('/vault');
        }
      } else {
        handleConnect();
      }
    },
    isLoading: isConnecting || isProcessing, // Show loading for both connecting and processing states
    loadingText: getLoadingText(), // Pass the appropriate loading text
    ...(isLoggedIn && {
      children: "[ PROCEED ]",
      bgColor: 'from-green-500 to-green-600',
      className: childElement.props.className || '',
    }),
  };

  return React.cloneElement(childElement, buttonProps);
}