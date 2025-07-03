'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import BorderFrame from '@/components/BorderFrame';
import StartButton from '@/components/StartButton';
import { useMobileDetect } from '@/lib/mobileDetectStore';
import { convertAndFormatAptToUsd } from '@/lib/priceUtils';
import { useVerifyPrefetch } from '@/hooks/useVerifyPrefetch';
import { prefetchVerifyAssets, prefetchChatAssets } from '@/utils/prefetch';
import { getVerificationStatus } from '@/lib/indexedDBUtils';
import { useWalletStore } from '@/store/wallet';
import { useBalance, useChainId, useSwitchChain } from 'wagmi';

export type Vault = {
  id?: number;
  name: string;
  total_prize: number;
  available_prize: number;
  vault_sponsor?: string;
  sponsor_links?: any;
  ai_prompt?: string;
  created_at?: string;
  freecreditawarded?: string[];
  // EVM support fields
  blockchain?: 'aptos' | 'ethereum';
  required_token_address?: string;
  required_token_type?: 'native' | 'erc20' | 'erc721' | 'aptos_coin';
  required_amount?: number;
  required_token_id?: string;
};

async function fetchVaultsAPI(): Promise<Vault[]> {
  const res = await fetch('/api/vaults');
  if (!res.ok) throw new Error('Failed to fetch vaults');
  return res.json();
}

export default function Vault() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [processingVaultId, setProcessingVaultId] = useState<number | null>(null);
  const { isMobile } = useMobileDetect();
  const router = useRouter();
  
  // Get wallet connection states and addresses from Zustand store
  const { 
    aptosWalletAddress, 
    evmWalletAddress, 
    aptosConnected, 
    evmConnected 
  } = useWalletStore();

  // Get current chain and add chain switching capability
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  // Debug wallet states on load
  useEffect(() => {
    // console.log('🏛️ Vault Page - Wallet States:');
    // console.log('  - Aptos connected:', aptosConnected, 'Address:', aptosWalletAddress);
    // console.log('  - EVM connected:', evmConnected, 'Address:', evmWalletAddress);
    // console.log('  - Chain ID:', chainId);
  }, [aptosConnected, evmConnected, aptosWalletAddress, evmWalletAddress, chainId]);
  
  // Fetch EVM balance using the correct address from Zustand store
  const { data: balanceData, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address: evmWalletAddress as `0x${string}` | undefined,
    chainId: 11155111, // Sepolia testnet chain ID
    query: {
      enabled: !!evmWalletAddress && evmConnected,
      refetchInterval: 60000, // Refetch every 60 seconds to reduce API calls
      retry: 2, // Allow 2 retries for balance fetch
      staleTime: 30000, // Cache the result for 30 seconds
      retryDelay: 3000, // 3 second delay between retries
    },
  });

  // Initialize prefetching hook
  const {
    prefetchVaultData,
    isPrefetching,
    prefetchError,
    getPrefetchedVault,
    isDataFresh
  } = useVerifyPrefetch();

  // Function to add preload links to document head
  const addPreloadLinks = () => {
    const imagesToPreload = [
      '/vaultborder.png',
      '/3.png',
      '/vault-1.png',
      '/go-5.png',  // Changed this line
      '/lock.png',
      '/vaultstart.png',
      '/start-vault-2.png'
    ];

    imagesToPreload.forEach(src => {
      // Check if preload link already exists
      if (!document.querySelector(`link[href="${src}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      }
    });
  };

  // Function to preload images
  const preloadImages = async () => {
    const imagesToPreload = [
      '/vaultborder.png',
      '/3.png',
      '/vault-1.png',
      '/go-5.png',  // Changed this line
      '/lock.webp',
      // StartButton component image
      '/vaultstart.png',
      // BorderFrame component images
      '/border2.png',
      '/borderbg.png',
      '/borderbgmobile.png',
      '/mobileborder.png',
      '/yellowcurve.png',
      '/start-vault-2.png'
    ];

    // // console.log('Starting to preload images...');

    const imagePromises = imagesToPreload.map((src, index) => {
      return new Promise<void>((resolve, reject) => {
        const img = document.createElement('img');

        // Set crossOrigin to handle potential CORS issues
        img.crossOrigin = 'anonymous';

        // Force the image to be cached
        img.style.position = 'absolute';
        img.style.left = '-9999px';
        img.style.top = '-9999px';
        img.style.width = '1px';
        img.style.height = '1px';
        document.body.appendChild(img);

        // Set up event handlers
        img.onload = () => {
          // // console.log(`✓ Loaded: ${src}`);
          document.body.removeChild(img);
          resolve();
        };

        img.onerror = () => {
          // console.warn(`✗ Failed to load: ${src}`);
          document.body.removeChild(img);
          reject(new Error(`Failed to load image: ${src}`));
        };

        // Start loading
        img.src = src;
      });
    });

    try {
      await Promise.all(imagePromises);
      // // console.log('✓ All vault images preloaded successfully');

      // Add a small delay to ensure images are fully cached
      await new Promise(resolve => setTimeout(resolve, 100));

      setAssetsLoaded(true);
    } catch (error) {
      // console.error('Error preloading images:', error);
      // Still set assets loaded to true to prevent infinite loading
      setAssetsLoaded(true);
    }
  };

  // Fetch vaults on component mount (wallet validation is handled by RouteGuard)
  useEffect(() => {
    async function fetchVaults() {
      try {
        // Add preload links to document head immediately
        addPreloadLinks();

        // Start preloading images immediately
        const imageLoadPromise = preloadImages();

        // Fetch vault data
        const vaultData = await fetchVaultsAPI();

        // Custom vault ordering: PAI (114) first, dfusion (113) second, candy third, aegis fourth, Demo Sepolia Vault
        const reorderedVaults = [];
        
        // Find specific vaults by ID and name
        const dfusVault = vaultData.find(v => v.id === 113); // DFUS vault
        const vault114 = vaultData.find(v => v.id === 114);  // PAI vault
        const candyVault = vaultData.find(v => v.id === 111 || v.name.toLowerCase().includes('candy')); // Candy vault
        const aegisVault = vaultData.find(v => v.id === 112 || v.name.toLowerCase().includes('aegis')); // Aegis vault
        const demoSepoliaVault = vaultData.find(v => v.name === 'Demo Sepolia Vault' || v.blockchain === 'ethereum'); // Demo EVM vault
        const otherVaults = vaultData.filter(v => 
          v.id !== 113 && 
          v.id !== 114 && 
          v.id !== 111 && 
          v.id !== 112 && 
          !v.name.toLowerCase().includes('candy') && 
          !v.name.toLowerCase().includes('aegis') &&
          v.name !== 'Demo Sepolia Vault' &&
          v.blockchain !== 'ethereum'
        );
        
        // Add in specific order
        if (vault114) reorderedVaults.push(vault114);           // Position 1: PAI
        if (dfusVault) reorderedVaults.push(dfusVault);         // Position 2: DFUS
        if (candyVault) reorderedVaults.push(candyVault);       // Position 3: Candy
        if (aegisVault) reorderedVaults.push(aegisVault);       // Position 4: Aegis
        if (demoSepoliaVault) reorderedVaults.push(demoSepoliaVault); // Position 5: Demo Sepolia Vault
        
        // Add remaining vaults in reverse order (newest first)
        const reversedOthers = [...otherVaults].reverse();
        reorderedVaults.push(...reversedOthers);

        setVaults(reorderedVaults);

        // Wait for images to load before proceeding
        await imageLoadPromise;

        // Start prefetching data for all vaults once we have the vault list
        if (reorderedVaults.length > 0) {
          const vaultIds = reorderedVaults.map(vault => vault.id).filter(id => id !== undefined) as number[];
          // // console.log('Starting prefetch for vault IDs:', vaultIds);

          // Prefetch data for all vaults in the background
          prefetchVaultData(vaultIds);

          // Also prefetch assets for verify and chat pages
          prefetchVerifyAssets();
          prefetchChatAssets();
        }
      } catch (error) {
        // console.error('Failed to fetch vaults:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVaults();
  }, [prefetchVaultData]);

  // Prefetch data when user hovers over a vault card (additional optimization)
  const handleVaultHover = (vaultId: number | undefined) => {
    if (vaultId && !isPrefetching) {
      // Check if we already have fresh data for this vault
      const cachedVault = getPrefetchedVault(vaultId);
      if (!cachedVault || !isDataFresh()) {
        // // console.log('Prefetching data for hovered vault:', vaultId);
        prefetchVaultData([vaultId]);
      }
    }
  };

  const handleStartClick = async (vaultId: number | undefined) => {
    try {
      // Don't allow starting multiple vaults at once
      if (processingVaultId !== null) {
        // // console.log('Already processing a vault start');
        return;
      }

      // Mark this vault as being processed
      if (vaultId) {
        setProcessingVaultId(vaultId);
      }

      // Save vault ID to local storage
      if (vaultId) {
        // // console.log('Selecting vault with ID:', vaultId);
        const vaultIdString = vaultId.toString();
        localStorage.setItem('selectedVaultId', vaultIdString);

        // Store vault data in sessionStorage as backup for OAuth flow
        try {
          const selectedVault = vaults.find(v => v.id === vaultId);
          if (selectedVault) {
            sessionStorage.setItem(`vaultData_${vaultIdString}`, JSON.stringify(selectedVault));
            // // console.log('Backed up vault data to sessionStorage for OAuth persistence');
          }
        } catch (error) {
          // console.warn('Failed to backup vault data to sessionStorage:', error);
        }

        // Make sure we have a consistent wallet address in localStorage
        const walletAddress = localStorage.getItem('userWalletAddress') ||
          localStorage.getItem('wallet_address') ||
          localStorage.getItem('walletAddress') ||
          localStorage.getItem('aptosWalletAddress');

        if (walletAddress) {
          // // console.log('Using existing wallet address:', walletAddress);
          // Ensure the wallet address is saved with a consistent key
          localStorage.setItem('userWalletAddress', walletAddress);

          // Check verification status from IndexedDB instead of conversations
          try {
            // // console.log('Checking verification status in IndexedDB for vaultId:', vaultId);
            const verificationStatus = await getVerificationStatus(vaultIdString);
            // // console.log('IndexedDB verificationStatus result:', verificationStatus);

            if (verificationStatus && verificationStatus.allStepsVerified) {
              // User has completed verification, redirect to chat
              // // console.log('User has completed verification, redirecting to chat');
              await router.push('/chat');
            } else {
              // User hasn't completed verification, redirect to verify
              // // console.log('User needs to complete verification first');
              await router.push('/verify');
            }
          } catch (error) {
            // console.error('Error checking verification status:', error);
            // Default to verify page on error
            await router.push('/verify');
          }
        } else {
          // // console.log('No wallet address found, using guest mode');
          // Create a temporary guest wallet ID if needed
          const guestId = localStorage.getItem('guestId') || `guest-${Date.now()}`;
          localStorage.setItem('guestId', guestId);

          // Guests should always go through verification
          await router.push('/verify');
        }
      } else {
        // console.error('No vault ID available');
        throw new Error('Invalid vault ID');
      }
    } catch (error) {
      // console.error('Error starting vault challenge:', error);
      throw error; // Re-throw to be handled by StartButton
    } finally {
      // Clear the processing state
      setProcessingVaultId(null);
    }
  };

  // Function to determine if a vault should be blurred based on index
  const shouldBlurVault = (index: number) => {
    // This function can be adjusted to change how many vaults are shown initially
    return index >= 5;
  };

  // Function to check if user can access a vault based on wallet connections (memoized to reduce console spam)
  const getVaultAccessMessage = useMemo(() => {
    const cachedMessages = new Map();
    
    return (vault: Vault, isBlurred: boolean) => {
      if (isBlurred) return null; // No messages for blurred vaults

      const cacheKey = `${vault.id}-${vault.blockchain}-${aptosConnected}-${evmConnected}-${chainId}-${isBalanceLoading}-${balanceData?.value?.toString()}-${balanceError?.message}`;
      
      if (cachedMessages.has(cacheKey)) {
        return cachedMessages.get(cacheKey);
      }

      let result = null;

      // Only log for the Ethereum vault to reduce spam
      const shouldLog = vault.blockchain === 'ethereum' && vault.id === 126;
      
      if (shouldLog) {
        // console.log(`[Vault Access Check] EVM Vault ${vault.id}:`);
        // console.log(`  - Wallet: ${evmConnected ? evmWalletAddress : 'Not connected'}`);
        // console.log(`  - Chain: ${chainId} (need: 11155111)`);
        // console.log(`  - Balance loading: ${isBalanceLoading}`);
        // console.log(`  - Balance: ${balanceData?.value ? (parseFloat(balanceData.value.toString()) / 1e18).toFixed(4) : '0'} ETH`);
        // console.log(`  - Required: ${vault.required_amount} ${vault.required_token_type === 'native' ? 'ETH' : vault.required_token_type || 'tokens'}`);
        // console.log(`  - Balance fetch address: ${evmWalletAddress}`);
        if (balanceError) {
          console.error(`Balance error:`, balanceError);
        }
      }
      
      if (vault.blockchain === 'ethereum') {
        if (!evmConnected) {
          result = "Connect Ethereum wallet to access";
        } else if (chainId !== 11155111) {
          result = `Switch to Sepolia network (chain ID: 11155111)`;
        } else if (isBalanceLoading) {
          result = null; // Allow access while loading
        } else if (balanceError) {
          result = `Network error - try refreshing`;
        } else {
          // Dynamic EVM requirements from Supabase
          const requiredAmount = vault.required_amount ?? 0;
          const requiredAmountWei = BigInt(Math.floor(requiredAmount * 1e18));
          const userBalanceWei = balanceData?.value ?? 0n;
          const userBalanceEth = parseFloat(userBalanceWei.toString()) / 1e18;
          
          if (requiredAmountWei > 0 && userBalanceWei < requiredAmountWei) {
            // Use dynamic token display based on vault data
            const tokenDisplay = vault.required_token_type === 'native' 
              ? `${requiredAmount} Sepolia ETH`
              : vault.required_token_type === 'erc20'
                ? `${requiredAmount} ${vault.required_token_address || 'ERC20 tokens'}`
                : `${vault.required_token_address || 'NFT'}`;
            
            result = `Insufficient balance (Need: ${tokenDisplay}, Have: ${userBalanceEth.toFixed(4)} ETH)`;
          } else {
            result = null; // Access allowed
          }
        }
      } else if (!vault.blockchain || vault.blockchain === 'aptos') {
        if (!aptosConnected) {
          result = null; // Don't show error message for Aptos - just disable button
        } else {
          result = null; // Access allowed
        }
      }
      
      cachedMessages.set(cacheKey, result);
      return result;
    };
  }, [aptosConnected, aptosWalletAddress, evmConnected, evmWalletAddress, chainId, isBalanceLoading, balanceData, balanceError]);

  const canAccessVault = (vault: Vault, isBlurred: boolean) => {
    if (isBlurred) return false;
    
    // Check wallet connection requirements first
    if (vault.blockchain === 'ethereum') {
      if (!evmConnected) return false;
      if (chainId !== 11155111) return false;
      if (isBalanceLoading) return true; // Allow access while loading
      if (balanceError) return false;
      
      // Check balance requirements
      const requiredAmount = vault.required_amount ?? 0;
      if (requiredAmount > 0) {
        const requiredAmountWei = BigInt(Math.floor(requiredAmount * 1e18));
        const userBalanceWei = balanceData?.value ?? 0n;
        return userBalanceWei >= requiredAmountWei;
      }
      return true;
    } else if (!vault.blockchain || vault.blockchain === 'aptos') {
      // For Aptos vaults, check if Aptos wallet is connected
      return aptosConnected;
    }
    
    return false;
  };

  // Function to get the correct styling based on vault ID and position
  const getVaultStyling = (index: number, vault: any) => {
    if (vault.id === 113) {
      // DFUS vault (blue theme) - now at position 0
      return {
        backgroundImage: 'url("/go-5.png")',
        isBlueTheme: true,
        isVault114: false,
        backgroundSize: !isMobile ? '114% 105%' : '119% 101%',
      };
    } else if (vault.id === 114) {
      // PAI vault (green theme with custom background) - now at position 3
      return {
        backgroundImage: 'url("/PAI/vault.png")',
        isBlueTheme: false,
        isVault114: true,
        backgroundSize: !isMobile ? '120% 115%' : '121% 105%',
      };
    } else {
      // Regular vaults (yellow theme) - candy, aegis, and others
      return {
        backgroundImage: 'url("/vaultborder.png")',
        isBlueTheme: false,
        isVault114: false,
        backgroundSize: !isMobile ? '98% 106%' : '112% 100%'
      };
    }
  };

  const isDfusionVault = (id: number | undefined) => {
    return id === 113;
  };

  // Function to render blockchain and token requirements - now with vault-specific positioning
  const renderVaultRequirements = (vault: Vault, styling: any, isBlurred: boolean) => {
    // Do not render requirements for blurred "Coming Soon" vaults
    if (isBlurred) return null;

    // Define position based on vault type
    const getPositionClass = () => {
      if (isMobile) return 'top-19 right-7'; // Consistent for all mobile vaults
      if (styling.isVault114) return 'top-13 right-12'; // PAI vault
      if (styling.isBlueTheme) return 'top-16 right-15'; // DFUSION vault
      return 'top-14 right-19'; // Default for other vaults
    };
    
    if (vault.blockchain === 'ethereum') {
      // Show Ethereum indicator for all Ethereum vaults
      const showRequirement = vault.required_token_type && vault.required_amount && vault.required_amount > 0;
      
      let tokenDisplay = '';
      if (showRequirement) {
        tokenDisplay = vault.required_token_type === 'native' 
          ? `${vault.required_amount} Sepolia ETH`
          : vault.required_token_type === 'erc20'
            ? `${vault.required_amount} ${vault.required_token_address || 'ERC20'}`
            : vault.required_token_type === 'erc721'
              ? `${vault.required_token_address || 'NFT'} #${vault.required_token_id || 'Any'}`
              : `${vault.required_amount} tokens`;
      }
      
      return (
        <div className={`absolute z-30 text-right ${getPositionClass()}`}>
          <div className="bg-blue-600 bg-opacity-90 px-2 py-1 rounded text-xs text-white font-bold flex items-center gap-1 ml-auto w-fit shadow-lg">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>Ethereum</span>
          </div>
          {showRequirement && (
            <div className="bg-gray-800 bg-opacity-90 px-2 py-1 rounded text-xs text-white mt-1 shadow-lg">
              Requires: {tokenDisplay}
            </div>
          )}
        </div>
      );
    } else if (vault.blockchain === 'aptos' || !vault.blockchain) {
      return (
        <div className={`absolute z-30 text-right ${getPositionClass()}`}>
          <div className="bg-orange-600 bg-opacity-90 px-2 py-1 rounded text-xs text-white font-bold flex items-center gap-1 ml-auto w-fit shadow-lg">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span>Aptos</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <BorderFrame>
      <div className="flex-1 flex flex-col items-center  px-8 py-6 lg:px-16 relative  gap-8">
        <h1
          className={`text-yellow-500 text-3xl md:text-5xl lg:text-6xl font-bold text-center tracking-wide mt-2 md:mt-4 ${isMobile ? 'mobile-heading' : ''}`}
          style={{
            fontFamily: 'vt323',
            textShadow: '0 0 10px rgba(255, 193, 7, 0.5)',
            fontSize: isMobile ? '2rem' : undefined,
            lineHeight: isMobile ? '1.2' : undefined,
            padding: isMobile ? '0 10px' : undefined,
            maxWidth: isMobile ? '95vw' : undefined,
            whiteSpace: isMobile ? 'normal' : undefined,
          }}
        >
          CHOOSE YOUR AI VAULT
        </h1>

        {loading || !assetsLoaded ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-yellow-500 text-xl">Loading vaults...</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-t-2 border-yellow-500 rounded-full animate-spin"></div>
              <span className="text-gray-400 text-sm">
                {!assetsLoaded ? 'Preparing images...' : 'Loading data...'}
              </span>
            </div>
          </div>
        ) : vaults.length === 0 ? (
          <div className="text-yellow-500 text-xl">No vaults available</div>
        ) : (
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-6 px-2' : 'grid-cols-1 md:grid-cols-2 gap-8'} max-w-6xl w-full max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-350px)] overflow-y-auto mt-8 justify-items-center`}>
            {vaults.map((vault, index) => {
              const styling = getVaultStyling(index, vault);

              return (
                <div
                  key={vault.id || index}
                                      className={`vault-card-container relative ${
                                            isMobile 
                        ? 'w-full max-w-[340px]' // Consistent container width for all mobile cards
                        : styling.isVault114 
                          ? 'w-full max-w-[505px] mt-4' // PAI vault - now position 1
                          : styling.isBlueTheme 
                            ? 'w-full max-w-[525px] mt-0' // DFUSION vault: add spacing after PAI
                            : vault.name.toLowerCase().includes('candy')
                              ? 'w-full mt-4' // Candy vault: independent positioning
                              : vault.name.toLowerCase().includes('aegis')
                                ? 'w-full mt-4' // Aegis vault: independent positioning
                                : 'w-full'
                    }`}
                  onMouseEnter={() => handleVaultHover(vault.id)}
                >
                  {/* Vault border background */}
                  <div
                    className={`p-6 rounded-[18px] relative ${
                      isMobile 
                        ? styling.isVault114 
                          ? 'h-[220px]' // PAI vault mobile height
                          : 'h-[240px]' // Standard height for other mobile cards
                        : styling.isBlueTheme 
                          ? 'h-[360px] p-8' // DFUSION vault desktop height
                          : styling.isVault114 
                            ? 'h-[320px] p-8' // PAI vault desktop height
                            : vault.name.toLowerCase().includes('candy')
                              ? 'h-[340px] p-8' // Candy vault: independent height
                              : vault.name.toLowerCase().includes('aegis')
                                ? 'h-[340px] p-8' // Aegis vault: independent height
                                : 'h-[340px] p-8' // Default height for other vaults
                    } ${shouldBlurVault(index) ? 'blurred-vault' : ''}`}
                    style={{
                      backgroundImage: styling.backgroundImage,
                      backgroundSize: styling.backgroundSize,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center'
                    }}
                  >
                    {/* Blockchain and token requirements */}
                    {renderVaultRequirements(vault, styling, shouldBlurVault(index))}

                    {/* Content container with absolute positioning */}
                    <div className={`absolute inset-0 ${isMobile ? 'p-6' : 'p-8'}`}>
                                              {/* Header - Image and title */}
                        <div className={`flex items-center ${
                          isMobile 
                            ? 'mb-2 mt-1' // Reduced spacing for mobile
                            : styling.isVault114 
                              ? 'ml-6 mb-8 mt-[-24px]' 
                              : 'ml-4 mb-4'
                        } relative z-10`}>
                        <div className={`flex-shrink-0 ${styling.isBlueTheme ? 'mt-3' : ''}`}>
                          <Image
                            src={
                              styling.isBlueTheme 
                                ? "/vault-1.png" 
                                : styling.isVault114 
                                  ? "/PAI/greenhead.png" 
                                  : "/3.png"
                            }
                            alt={vault.name}
                            width={styling.isVault114 ? (isMobile ? 60 : 160) : (isMobile ? 60 : 180)}
                            height={styling.isVault114 ? (isMobile ? 60 : 160) : (isMobile ? 60 : 180)}
                            priority
                            loading="eager"
                            className={styling.isVault114 ? "object-contain" : ""}
                          />
                        </div>
                        <div className={`flex-grow ${
                          isMobile 
                            ? styling.isVault114
                              ? 'ml-3' // Special margin for vault 114
                              : styling.isBlueTheme
                                ? 'ml-3' // Special margin for vault 113
                                : 'ml-3' // Standard margin for all mobile cards
                            : styling.isBlueTheme 
                              ? 'ml-4' 
                              : styling.isVault114 
                                ? 'ml-16' 
                                : 'ml-2'
                        } overflow-hidden ${styling.isVault114 ? 'flex flex-col justify-center' : ''}`}>
                                                     <h3 className={`text-yellow-500 ${
                              isMobile 
                                ? 'text-lg' // Reduced font size for mobile
                                : styling.isVault114 
                                  ? 'text-4xl' 
                                  : 'text-4xl'
                            } font-bold whitespace-nowrap overflow-ellipsis overflow-hidden ${
                              isMobile 
                                ? 'max-w-[180px]' // Reduced max width for mobile
                                : styling.isVault114 
                                  ? 'max-w-[280px]' 
                                  : 'max-w-[230px]'
                            }`}>
                            {vault.name}
                          </h3>
                          <p className="text-gray-400 text-sm truncate">VAULT by
                            <span className="text-white mx-1">
                              {vault.vault_sponsor || 'Unknown'}
                            </span>
                          </p>
                        </div>
                      </div>

                                              {/* Prize info - positioned independently */}
                        <div className={`absolute z-10 ${
                          isMobile 
                            ? styling.isVault114
                              ? 'top-[140px] left-9' // Adjusted for reduced vault 114 height
                              : styling.isBlueTheme 
                                ? 'top-[150px] left-9' // Special positioning for vault 113
                                : 'top-[150px] left-9' // Adjusted positioning for other cards
                            : styling.isVault114
                              ? 'top-[217px] left-11'
                              : styling.isBlueTheme
                                ? 'top-[240px] left-14'
                                : 'top-[215px] left-18'
                        }`}>
                                                  <div
                            className={`text-yellow-500 font-bold ${
                              isMobile 
                                ? 'text-lg' // Reduced font size for mobile
                                : styling.isBlueTheme
                                  ? 'text-4xl md:text-5xl'
                                  : styling.isVault114
                                    ? 'text-3xl md:text-5xl ml-0'
                                    : 'text-3xl md:text-4xl ml-3'
                            }`}
                        >
                          {vault.id === 113 ? (
                            <>
                              ${parseInt(convertAndFormatAptToUsd(vault.total_prize)) + (vault.available_prize <= 0 ? 0 : 500)}
                              <span className={`${isMobile ? 'text-sm' : 'text-2xl'} font-normal`}>
                                {isMobile 
                                  ? ` ($${vault.available_prize <= 0 ? 0 : 500}+$${convertAndFormatAptToUsd(vault.total_prize)})` 
                                  : `($${convertAndFormatAptToUsd(vault.total_prize)}+$${vault.available_prize <= 0 ? 0 : 500} nodes)`
                                }
                              </span>
                            </>
                          ) : vault.id === 114 ? (
                            <>
                              ${parseInt(convertAndFormatAptToUsd(vault.total_prize)) + (vault.available_prize <= 0 ? 0 : 942)}
                              <span className={`${isMobile ? 'text-sm' : 'text-2xl'} font-normal`}>
                                {isMobile 
                                  ? ` ($${vault.available_prize <= 0 ? 0 : 942}+$${convertAndFormatAptToUsd(vault.total_prize)})` 
                                  : `($${convertAndFormatAptToUsd(vault.total_prize)}+$${vault.available_prize <= 0 ? 0 : 942} nodes)`
                                }
                              </span>
                            </>
                          ) : (
                            `$${convertAndFormatAptToUsd(vault.total_prize)}`
                          )}
                        </div>
                        <p className={`${
                          styling.isBlueTheme 
                            ? ' text-gray-300' 
                            : styling.isVault114 
                              ? 'text-white' 
                              : 'text-gray-400'
                        } -mt-1 ${
                          isMobile 
                            ? '' // No margin adjustments for mobile - keep it clean
                            : styling.isVault114 
                              ? 'ml-0' 
                              : 'ml-3'
                        } text-sm`}>in total</p>
                      </div>

                                              {/* Button - positioned at bottom */}
                        <div
                          className={`absolute ${
                            isMobile
                              ? styling.isVault114
                                ? 'bottom-4 right-1'
                                : styling.isBlueTheme
                                  ? 'bottom-8 right-0'
                                  : 'bottom-13 right-4'
                              : styling.isVault114
                                ? 'top-[204px] left-68'
                                : 'bottom-15 left-10 md:left-73'
                          } flex justify-center z-10`}
                        >
                          <StartButton
                            onClick={() => handleStartClick(vault.id)}
                            href="#"
                            disabled={!canAccessVault(vault, shouldBlurVault(index))}
                            imageSrc={
                              styling.isBlueTheme
                                ? "/start-vault-2.png"
                                : styling.isVault114
                                  ? "/PAI/startbutton.png"
                                  : "/vaultstart.png"
                            }
                            imageClassName={
                              styling.isBlueTheme
                                ? isMobile
                                  ? "scale-[1.2]"
                                  : "scale-[1.9] ml-2"
                                : styling.isVault114
                                  ? isMobile
                                    ? "scale-[1.0]"
                                    : "scale-[1.5] ml-1"
                                  : isMobile
                                    ? "scale-[1.0]"
                                    : ""
                            }
                            vaultType={
                              vault.id === 113
                                ? 'vault113'
                                : vault.id === 114
                                  ? 'vault114'
                                  : 'others'
                            }
                          >
                            <span
                              className={`text-black ${
                                isMobile
                                  ? 'text-xs ml-6'
                                  : styling.isVault114
                                    ? 'text-2xl md:text-3xl ml-8 md:ml-12'
                                    : 'text-xl md:text-3xl ml-10 md:ml-14'
                              } font-bold`}
                            >
                              {!canAccessVault(vault, shouldBlurVault(index)) ? 'LOCKED' : 'START'}
                            </span>
                          </StartButton>
                        </div>

                        {/* Wallet access indicator - Only show for EVM errors, not Aptos */}
                        {(() => {
                          const message = getVaultAccessMessage(vault, shouldBlurVault(index));
                          // Don't show Aptos connection messages, only EVM-related errors
                          if (message && !message.includes('Connect Aptos')) {
                            const isNetworkError = message.includes('Switch to Sepolia');
                            return (
                              <div className="absolute bottom-2 left-2 right-2 z-20">
                                <div className={`${isNetworkError ? 'bg-yellow-600' : 'bg-red-600'} bg-opacity-80 px-2 py-1 rounded text-xs text-white text-center`}>
                                  {message}
                                  {isNetworkError && (
                                    <button
                                      onClick={() => switchChain({ chainId: 11155111 })}
                                      className="ml-2 underline hover:no-underline"
                                    >
                                      Switch Now
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                    </div>

                    {/* Optional glow overlay */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-24 h-48 bg-yellow-400 opacity-20 blur-2xl rounded-full pointer-events-none z-0" />



                    {/* Coming soon indicator for vaults after the first 3 */}
                    {shouldBlurVault(index) && (
                      <>
                        {/* Blurred overlay for coming soon vaults */}
                        <div className=" inset-1 absolute inset-0 z-20  bg-opacity-50 backdrop-blur-xl rounded-[18px]"></div>

                        {/* Coming Soon badge in top right */}

          
                        <div className="absolute top-4 right-4 bg-black bg-opacity-80 px-3 py-2 rounded-lg text-yellow-500 text-center shadow-lg z-30">
                          <div className="flex items-center">
                            <Image src="/lock.webp" alt="Locked" width={24} height={24} className="mr-2" priority loading="eager" />
                            <p className="font-bold">Coming Soon</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        .vault-card-container {
          perspective: 1000px;
          transition: transform 0.3s;
        }

        .vault-card {
          backdrop-filter: blur(5px);
          transform-style: preserve-3d;
          transition: all 0.3s;
        }

        .vault-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 25px 5px rgba(255, 193, 7, 0.4),
            inset 0 0 15px rgba(255, 193, 7, 0.2);
        }
        
        .blurred-vault {
          opacity: 1;
          position: relative;
        }
        
        .vault-card-container:hover .blurred-vault {
          filter: brightness(1.1);
        }
      `}</style>
    </BorderFrame>
  );
}
