import { useState, useEffect, useCallback } from 'react';

// Types for the data we'll prefetch
export interface VaultData {
  id?: number;
  name: string;
  total_prize: number;
  available_prize: number;
  vault_sponsor?: string;
  sponsor_links?: any;
  ai_prompt?: string;
  created_at?: string;
  freecreditawarded?: string[];
  tweetContent?: string;
  discord_link?: string;
  linkedin_link?: string;
  whitepaper_link?: string;
  retweet_content?: string;
}

export interface UserData {
  id: number;
  wallet_address: string;
  credits: number;
}

export interface ConversationData {
  id: number;
  user_id: number;
  vault_id: number;
  created_at: string;
}

export interface PrefetchedData {
  vaults: Record<number, VaultData>;
  userData: UserData | null;
  conversations: Record<string, ConversationData[]>; // key: `${userId}_${vaultId}`
  userCredits: number;
  lastPrefetchTime: number;
}

// API helper functions
async function fetchVaultById(vaultId: number): Promise<VaultData | null> {
  try {
    const res = await fetch(`/api/vaults?id=${vaultId}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    // console.error('Error fetching vault:', error);
    return null;
  }
}

async function fetchUserIdFromWallet(walletAddress: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ?? null;
  } catch (error) {
    // console.error('Error fetching user ID:', error);
    return null;
  }
}

async function fetchUserByWallet(walletAddress: string): Promise<UserData | null> {
  try {
    const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    // console.error('Error fetching user data:', error);
    return null;
  }
}

async function fetchConversations(userId: number, vaultId?: number): Promise<ConversationData[]> {
  try {
    let url = `/api/conversations?user_id=${userId}`;
    if (vaultId) url += `&vault_id=${vaultId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    // console.error('Error fetching conversations:', error);
    return [];
  }
}

async function fetchUserCredits(walletAddress: string): Promise<number> {
  try {
    const res = await fetch(`/api/users/credits?wallet_address=${encodeURIComponent(walletAddress)}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.credits || 0;
  } catch (error) {
    // console.error('Error fetching user credits:', error);
    return 0;
  }
}

export function useVerifyPrefetch() {
  const [prefetchedData, setPrefetchedData] = useState<PrefetchedData>({
    vaults: {},
    userData: null,
    conversations: {},
    userCredits: 0,
    lastPrefetchTime: 0
  });
  
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);

  // Load cached data from localStorage on mount
  useEffect(() => {
    const loadCachedData = () => {
      try {
        const cached = localStorage.getItem('verifyPrefetchData');
        if (cached) {
          const parsedData = JSON.parse(cached);
          // Only use cached data if it's less than 5 minutes old
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          if (parsedData.lastPrefetchTime > fiveMinutesAgo) {
            setPrefetchedData(parsedData);
            // console.log('Loaded cached prefetch data');
          }
        }
      } catch (error) {
        // console.error('Error loading cached prefetch data:', error);
      }
    };

    loadCachedData();
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (prefetchedData.lastPrefetchTime > 0) {
      try {
        localStorage.setItem('verifyPrefetchData', JSON.stringify(prefetchedData));
      } catch (error) {
        // console.error('Error saving prefetch data to cache:', error);
      }
    }
  }, [prefetchedData]);

  const prefetchVaultData = useCallback(async (vaultIds: number[]) => {
    if (isPrefetching) return;
    
    // console.log('Starting vault data prefetch for vaults:', vaultIds);
    
    try {
      setIsPrefetching(true);
      setPrefetchError(null);
      
      // Get wallet address for user-specific data
      const walletAddress = localStorage.getItem('userWalletAddress') || 
                           localStorage.getItem('wallet_address') || 
                           localStorage.getItem('walletAddress') || 
                           localStorage.getItem('aptosWalletAddress');
      
      let userData: UserData | null = null;
      let userCredits = 0;
      let userId: number | null = null;

      // Fetch user data if wallet address is available
      if (walletAddress) {
        // console.log('Prefetching user data for wallet:', walletAddress);
        
        // Fetch user data and credits in parallel
        const [userDataResult, userCreditsResult, userIdResult] = await Promise.all([
          fetchUserByWallet(walletAddress),
          fetchUserCredits(walletAddress),
          fetchUserIdFromWallet(walletAddress)
        ]);

        userData = userDataResult;
        userCredits = userCreditsResult;
        userId = userIdResult;

        // console.log('User data prefetched:', { userData, userCredits, userId });
      }

      // Fetch vault data for all vaults in parallel
      // console.log('Prefetching vault data...');
      const vaultPromises = vaultIds.map(async (vaultId) => {
        const vault = await fetchVaultById(vaultId);
        return { vaultId, vault };
      });
      
      const vaultResults = await Promise.all(vaultPromises);
      const vaults: Record<number, VaultData> = {};
      
      vaultResults.forEach(({ vaultId, vault }) => {
        if (vault) {
          vaults[vaultId] = vault;
        }
      });
      
      // console.log('Vault data prefetched:', Object.keys(vaults).length, 'vaults');

      // Fetch conversations for each vault if we have a user ID
      const conversations: Record<string, ConversationData[]> = {};
      if (userId) {
        // console.log('Prefetching conversations for user:', userId);
        
        const conversationPromises = vaultIds.map(async (vaultId) => {
          const convos = await fetchConversations(userId, vaultId);
          const key = `${userId}_${vaultId}`;
          return { key, convos };
        });

        const conversationResults = await Promise.all(conversationPromises);
        conversationResults.forEach(({ key, convos }) => {
          conversations[key] = convos;
        });

        // console.log('Conversations prefetched for', Object.keys(conversations).length, 'vault-user combinations');
      }

      // Update prefetched data
      setPrefetchedData(prev => ({
        ...prev,
        vaults: { ...prev.vaults, ...vaults },
        userData,
        conversations: { ...prev.conversations, ...conversations },
        userCredits,
        lastPrefetchTime: Date.now()
      }));

      // console.log('Prefetch completed successfully');

    } catch (error) {
      // console.error('Error during prefetch:', error);
      setPrefetchError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPrefetching(false);
    }
  }, [isPrefetching]);

  // Function to get prefetched vault data
  const getPrefetchedVault = useCallback((vaultId: number): VaultData | null => {
    return prefetchedData.vaults[vaultId] || null;
  }, [prefetchedData.vaults]);

  // Function to get prefetched conversations
  const getPrefetchedConversations = useCallback((userId: number, vaultId: number): ConversationData[] => {
    const key = `${userId}_${vaultId}`;
    return prefetchedData.conversations[key] || [];
  }, [prefetchedData.conversations]);

  // Function to check if data is fresh (less than 5 minutes old)
  const isDataFresh = useCallback((): boolean => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return prefetchedData.lastPrefetchTime > fiveMinutesAgo;
  }, [prefetchedData.lastPrefetchTime]);

  // Function to clear cached data
  const clearPrefetchedData = useCallback(() => {
    setPrefetchedData({
      vaults: {},
      userData: null,
      conversations: {},
      userCredits: 0,
      lastPrefetchTime: 0
    });
    localStorage.removeItem('verifyPrefetchData');
  }, []);

  return {
    prefetchedData,
    isPrefetching,
    prefetchError,
    prefetchVaultData,
    getPrefetchedVault,
    getPrefetchedConversations,
    isDataFresh,
    clearPrefetchedData
  };
} 