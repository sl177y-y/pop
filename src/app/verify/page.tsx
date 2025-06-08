"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import Image from "next/image";
// import Link from "next/link"; // No longer used with Supabase direct redirect
import { useRouter } from "next/navigation";
// import { signIn, signOut, useSession } from "next-auth/react"; // Replaced with Supabase
import { createClient } from '@/utils/supabase/client'; // Supabase client
import BorderFrame from "@/components/BorderFrame";
import AngularButton from "@/components/AngularButton";
import { useTwitterLike } from "@/hooks/useTwitterLike";
import { useMobileDetect } from '@/lib/mobileDetectStore';
import { convertAndFormatAptToUsd } from '@/lib/priceUtils';
import { User } from '@supabase/supabase-js'; // Import User type
import { useVerifyPrefetch } from '@/hooks/useVerifyPrefetch';
import { 
  getVerificationStatus, 
  updateVerificationStatus, 
  deleteVerificationStatus,
  VerificationStatus // Import the interface
} from '@/lib/indexedDBUtils'; // Import IndexedDB utils

// API helpers for backend DB access
async function fetchVaultById(vaultId: number) {
  const res = await fetch(`/api/vaults?id=${vaultId}`);
  if (!res.ok) return null;
  return res.json();
}

async function updateUserCreditsAPI(walletAddress: string, amount: number, operation: 'add' | 'subtract') {
  const res = await fetch('/api/users/credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress, amount, operation })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

// Updated to handle new API response with better error handling
async function awardFreeCreditIfEligibleAPI(vaultId: number, walletAddress: string): Promise<{ eligible: boolean, creditsGained: number, error?: string }> {
  try {
    // console.log(`[FRONTEND] Requesting free credits for vault ${vaultId}, wallet ${walletAddress}`);
    
    const res = await fetch('/api/vaults/award-free-credit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId, walletAddress, completedTasks: 8 })
    });
    
    const data = await res.json();
    // console.log(`[FRONTEND] Free credit API response:`, data);
    
    if (!res.ok) {
      // Handle specific error cases
      if (res.status === 409 && data.error?.includes('already awarded')) {
        // Already awarded - this is not really an error for the user
        return { eligible: false, creditsGained: 0, error: 'Already claimed' };
      }
      
      return { 
        eligible: false, 
        creditsGained: 0, 
        error: data.error || `Request failed with status ${res.status}` 
      };
    }
    
    // Success case
    return { 
      eligible: data.awarded || false, 
      creditsGained: data.creditsAwarded || 0 
    };
    
  } catch (error) {
    // console.error('[FRONTEND] Error in awardFreeCreditIfEligibleAPI:', error);
    return { 
      eligible: false, 
      creditsGained: 0, 
      error: 'Network error - please try again' 
    };
  }
}

export default function Verify() {
  // const { data: session, status } = useSession(); // Replaced with Supabase
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();
  const { isMobile } = useMobileDetect();

  // Add state for client-side selectedVaultId to prevent SSR issues
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Vault and loading states
  const [vaultData, setVaultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [routeValidationError, setRouteValidationError] = useState<string | null>(null);

  const { hasLikedTweet, isLoading: isCheckingLike, error: likeError, errorType: likeErrorType, retryAfter, checkLikeStatus, mockLikeAction, clearError: clearLikeError, lastChecked, pendingMockLike, setPendingMockLike, showingLiked, isVerifiedAndPersisted } = useTwitterLike();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingCluster, setIsFollowingCluster] = useState(false); // New state for Cluster Protocol follow
  const [followError, setFollowError] = useState<string | null>(null);
  const [clusterFollowError, setClusterFollowError] = useState<string | null>(null); // New error state
  const [creditsGranted, setCreditsGranted] = useState(false);
  const [clusterCreditsGranted, setClusterCreditsGranted] = useState(false); // New state
  const [twitterCoinsGranted, setTwitterCoinsGranted] = useState(false);
  const [clusterCoinsGranted, setClusterCoinsGranted] = useState(false); // New state
  const [isCheckingFollows, setIsCheckingFollows] = useState(false);
  const [isCheckingClusterFollow, setIsCheckingClusterFollow] = useState(false); // New state
  const [telegramCreditsGranted, setTelegramCreditsGranted] = useState(false);
  const [telegramCoinsGranted, setTelegramCoinsGranted] = useState(false);
  const [telegramProcessing, setTelegramProcessing] = useState(false);
  const [discordCreditsGranted, setDiscordCreditsGranted] = useState(false); // New state
  const [discordCoinsGranted, setDiscordCoinsGranted] = useState(false); // New state
  const [discordProcessing, setDiscordProcessing] = useState(false); // New state
  const [linkedinCreditsGranted, setLinkedinCreditsGranted] = useState(false); // New state
  const [linkedinCoinsGranted, setLinkedinCoinsGranted] = useState(false); // New state
  const [linkedinProcessing, setLinkedinProcessing] = useState(false); // New state
  const [extraLinkCreditsGranted, setExtraLinkCreditsGranted] = useState(false); // New state
  const [extraLinkCoinsGranted, setExtraLinkCoinsGranted] = useState(false); // New state
  const [extraLinkProcessing, setExtraLinkProcessing] = useState(false); // New state
  const [isTweetVerified, setIsTweetVerified] = useState(false);
  const [isCheckingTweet, setIsCheckingTweet] = useState(false);
  const [tweetError, setTweetError] = useState<string | null>(null);
  const [isRetweetVerified, setIsRetweetVerified] = useState(false);
  const [isCheckingRetweet, setIsCheckingRetweet] = useState(false);
  const [retweetError, setRetweetError] = useState<string | null>(null);
  const [isSecondRetweetVerified, setIsSecondRetweetVerified] = useState(false);
  const [isCheckingSecondRetweet, setIsCheckingSecondRetweet] = useState(false);
  const [secondRetweetError, setSecondRetweetError] = useState<string | null>(null);

  // Second tweet like hook for vault 113
  const { 
    hasLikedTweet: hasLikedSecondTweet, 
    isLoading: isCheckingSecondLike, 
    error: secondLikeError, 
    errorType: secondLikeErrorType, 
    retryAfter: secondRetryAfter, 
    checkLikeStatus: checkSecondLikeStatus, 
    mockLikeAction: mockSecondLikeAction, 
    clearError: clearSecondLikeError, 
    lastChecked: secondLastChecked, 
    pendingMockLike: pendingSecondMockLike, 
    setPendingMockLike: setPendingSecondMockLike, 
    showingLiked: showingSecondLiked, 
    isVerifiedAndPersisted: isSecondVerifiedAndPersisted 
  } = useTwitterLike();

  // Get retweet content from vault data, fallback to hardcoded
  const getRetweetContent = () => {
    // Special content for vault 113
    if (selectedVaultId === '113') {
      return "RT @ClusterProtocol: NEW AI VAULT LIVE $750 Candy Machine Pool by @dFusionAI dFusion AI is building a peer-to-peer data network for AI,…";
    } else if (selectedVaultId === '114') {
      // ClusterProtocol vault announcement content for vault 114 - matches tweet ID 1927678140626751807
      return "RT @ClusterProtocol: Introducing Candy Machine 🍭🤖 An AI-powered vault that doesn't open with keys, it opens with prompts. To open it?…";
    }
    return vaultData?.retweet_content || "RT @ClusterProtocol: Introducing Candy Machine 🍭🤖 An AI-powered vault that doesn't open with keys, it opens with prompts. To open it?…";
  };

  // Get second retweet content for vault 113 and 114
  const getSecondRetweetContent = () => {
    if (selectedVaultId === '113') {
      return "RT @dFusionAI: dFusion Subnet Slots Distribution goes live June 6th at 8 AM UTC! 🔸5,000 Total Slots 🔸Starting Price: 0.1 ETH (Increase Eve…";
    } else if (selectedVaultId === '114') {
      // PAI3 announcement tweet content - matches tweet ID 1897363722651279671
      return "RT @Pai3Ai: Run nodes. Earn big. Power decentralized AI.";
    }
    return "";
  };

  // Get the appropriate tweet ID based on vault
  const getRequiredTweetId = () => {
    if (selectedVaultId === '113') {
      return "1929936477904892290"; // New ClusterProtocol tweet ID for vault 113
    } else if (selectedVaultId === '114') {
      return "1927678140626751807"; // ClusterProtocol pool announcement for vault 114
    }
    return "1927678140626751807"; // Default tweet ID
  };

  // Get the second required tweet ID based on vault
  const getSecondRequiredTweetId = () => {
    if (selectedVaultId === '113') {
      return "1929270231085490538"; // dFusion tweet ID for vault 113
    } else if (selectedVaultId === '114') {
      return "1897363722651279671"; // Pai3Ai announcement tweet ID for vault 114
    }
    return "1929270231085490538"; // Default second tweet ID
  };

  const requiredTweetId = getRequiredTweetId();
  const requiredRetweetUrl = `https://x.com/intent/retweet?tweet_id=${requiredTweetId}`;
  const secondRequiredTweetId = getSecondRequiredTweetId();
  const secondRequiredRetweetUrl = `https://x.com/intent/retweet?tweet_id=${secondRequiredTweetId}`;

  const router = useRouter();

  // Initialize prefetch hook to use cached data
  const { 
    getPrefetchedVault, 
    isDataFresh,
    prefetchedData 
  } = useVerifyPrefetch();

  // Initialize client-side state to prevent SSR issues
  useEffect(() => {
    setIsClient(true);
    const vaultId = localStorage.getItem('selectedVaultId');
    setSelectedVaultId(vaultId);
  }, []);

  // Helper function to safely get localStorage values (only on client)
  const getFromLocalStorage = (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  };

  // Helper to check if vault should skip Cluster Protocol follow verification
  const shouldSkipClusterFollow = () => {
    return selectedVaultId === '111' || selectedVaultId === '112';
  };

  // Helper to get sponsor Twitter ID from vaultData
  const getSponsorTwitterId = () => {
    // Assuming sponsor_links.twitterId is the X (Twitter) user ID (numeric string)
    // If it's a screen name, this part might need adjustment or an API call to get the ID
    return vaultData?.sponsor_links?.twitterId || null;
  };

  // Validate that the user came from a valid route
  useEffect(() => {
    if (!isClient) return; // Only run on client side

    const validateRoute = async () => {
      try {
        if (!selectedVaultId) {
          // console.error('No vault selected - redirecting to vault selection page');
          setRouteValidationError('Please select a vault first');
          
          // Wait 2 seconds before redirecting to give time to read the error
          setTimeout(() => {
            router.push('/vault');
          }, 2000);
          return;
        }
        
        // Try to use prefetched data first for faster validation
        const vaultId = parseInt(selectedVaultId); // [ ]
        let vault = null;
        
        if (isDataFresh()) { // [ ]
          vault = getPrefetchedVault(vaultId);
          // console.log('Using prefetched vault data for validation:', vault);
        }
        
        // If no prefetched data or data is stale, fetch fresh data
        if (!vault) {
          // console.log('Fetching fresh vault data for validation');
          vault = await fetchVaultById(vaultId);
        }
        
        if (!vault) {
          // console.error('Invalid vault ID - redirecting to vault selection page');
          setRouteValidationError('Invalid vault selected');
          
          setTimeout(() => {
            router.push('/vault');
          }, 2000);
          return;
        }
      } catch (error) {
        // console.error('Error validating route:', error);
        setRouteValidationError('Error validating route');
        
        setTimeout(() => {
          router.push('/vault');
        }, 2000);
      }
    };
    
    validateRoute();
  }, [router, getPrefetchedVault, isDataFresh, isClient, selectedVaultId]);
  
  // Load vault data on component mount
  useEffect(() => { // TODO move this to index db
    // Skip vault data fetch if we have a validation error or not on client
    if (routeValidationError || !isClient) return;
    
    const fetchVaultData = async () => {
      try {
        if (selectedVaultId) {
          const vaultId = parseInt(selectedVaultId);
          let vault = null;
          
          // Try to use prefetched data first for instant loading
          if (isDataFresh()) {
            vault = getPrefetchedVault(vaultId);
            if (vault) {
              // console.log("Using prefetched vault data:", vault);
              setVaultData(vault);
              setLoading(false);
              return;
            }
          }
          
          // Fallback to fresh fetch if no prefetched data
          // console.log("Fetching fresh vault data");
          vault = await fetchVaultById(vaultId);
          if (vault) {
            // console.log("Loaded fresh vault data:", vault);
            // console.log("Vault sponsor_links:", vault.sponsor_links);
            // console.log("Twitter URL from vault:", vault.sponsor_links?.twitter || "Not available");
            setVaultData(vault);
          } else {
            // console.warn("Failed to load vault data for ID:", selectedVaultId);
          }
        } else {
          // console.warn("No vault ID found");
        }
      } catch (error) {
        // console.error("Error fetching vault data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVaultData();
  }, [routeValidationError, getPrefetchedVault, isDataFresh, isClient, selectedVaultId]);

  // Check for stored telegram verification on component mount
  useEffect(() => {
    if (loading || routeValidationError || !isClient) return;
    
    const checkStoredVerification = async () => {
      if (selectedVaultId) {
        try {
          const status = await getVerificationStatus(selectedVaultId);
          
          // Check Telegram verification
          if (status?.telegramVerified) {
            console.log('[UI LOG - TelegramCheck] Telegram already verified in IndexedDB for vault:', selectedVaultId);
            setTelegramCreditsGranted(true);
            setTelegramCoinsGranted(true);
          } else {
            console.log('[UI LOG - TelegramCheck] Telegram not verified in IndexedDB for vault:', selectedVaultId);
            setTelegramCreditsGranted(false);
            setTelegramCoinsGranted(false);
          }

          // Check Discord verification
          if (status?.discordVerified) {
            console.log('[UI LOG - DiscordCheck] Discord already verified in IndexedDB for vault:', selectedVaultId);
            setDiscordCreditsGranted(true);
            setDiscordCoinsGranted(true);
          } else {
            console.log('[UI LOG - DiscordCheck] Discord not verified in IndexedDB for vault:', selectedVaultId);
            setDiscordCreditsGranted(false);
            setDiscordCoinsGranted(false);
          }

          // Check LinkedIn verification
          if (status?.linkedinVerified) {
            console.log('[UI LOG - LinkedInCheck] LinkedIn already verified in IndexedDB for vault:', selectedVaultId);
            setLinkedinCreditsGranted(true);
            setLinkedinCoinsGranted(true);
          } else {
            console.log('[UI LOG - LinkedInCheck] LinkedIn not verified in IndexedDB for vault:', selectedVaultId);
            setLinkedinCreditsGranted(false);
            setLinkedinCoinsGranted(false);
          }

          // Check Extra Link verification
          if (status?.extraLinkVerified) {
            console.log('[UI LOG - ExtraLinkCheck] Extra Link already verified in IndexedDB for vault:', selectedVaultId);
            setExtraLinkCreditsGranted(true);
            setExtraLinkCoinsGranted(true);
          } else {
            console.log('[UI LOG - ExtraLinkCheck] Extra Link not verified in IndexedDB for vault:', selectedVaultId);
            setExtraLinkCreditsGranted(false);
            setExtraLinkCoinsGranted(false);
          }

          // Check Cluster Protocol Twitter follow verification
          if (status?.twitterFollowClusterVerified) {
            console.log('[UI LOG - ClusterFollowCheck] Cluster follow already verified in IndexedDB for vault:', selectedVaultId);
            setIsFollowingCluster(true);
            setClusterCreditsGranted(true);
            setClusterCoinsGranted(true);
          } else {
            console.log('[UI LOG - ClusterFollowCheck] Cluster follow not verified in IndexedDB for vault:', selectedVaultId);
            setIsFollowingCluster(false);
            setClusterCreditsGranted(false);
            setClusterCoinsGranted(false);
          }

          // Auto-verify Cluster Protocol follow for specific vault IDs
          if (shouldSkipClusterFollow() && !status?.twitterFollowClusterVerified) {
            console.log('[UI LOG - ClusterFollowCheck] Auto-verifying Cluster follow for vault:', selectedVaultId);
            await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: true });
            setIsFollowingCluster(true);
            setClusterCreditsGranted(true);
            setClusterCoinsGranted(true);
          }
        } catch (dbError) {
          console.error('[VerificationCheck] Error reading verification status from IndexedDB:', dbError);
          console.log('[UI LOG - VerificationCheck] Error reading verification status from IndexedDB for vault:', selectedVaultId);
          // Reset all states to false on error
          setTelegramCreditsGranted(false);
          setTelegramCoinsGranted(false);
          setDiscordCreditsGranted(false);
          setDiscordCoinsGranted(false);
          setLinkedinCreditsGranted(false);
          setLinkedinCoinsGranted(false);
          setExtraLinkCreditsGranted(false);
          setExtraLinkCoinsGranted(false);
          setIsFollowingCluster(false);
          setClusterCreditsGranted(false);
          setClusterCoinsGranted(false);
        }
      }
    };
    
    checkStoredVerification();
  }, [loading, routeValidationError, isClient, selectedVaultId]);

  // Supabase: Get user session
  useEffect(() => {
    const getUser = async () => { 
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        // Store Twitter ID if available from provider data
        // Supabase stores provider-specific user ID in user.identities[0].id if available
        // or user.user_metadata.provider_id for some providers like twitter
        const twitterId = session.user.user_metadata?.provider_id || session.user.identities?.find(id => id.provider === 'twitter')?.id;
        if (twitterId) {
          localStorage.setItem('twitterUserId', twitterId); // TODO move this to index db
          // console.log("Supabase Twitter User ID stored:", twitterId);
        }
      }
      setAuthLoading(false);
    };
    getUser();

    // update twitter user id on auth state change
    // TODO make it update the button for follow check too 
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const twitterId = session.user.user_metadata?.provider_id || session.user.identities?.find(id => id.provider === 'twitter')?.id;
        if (twitterId) {
          localStorage.setItem('twitterUserId', twitterId); // TODO move this to index db
          // console.log("Supabase Twitter User ID stored (onAuthStateChange):", twitterId);
        }
      }
      setAuthLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  // Check Twitter follow status when session changes
  useEffect(() => {
    // Only run if not loading and no route validation error
    if (loading || routeValidationError || authLoading || !user) return; // Ensure user is present

    const checkFollowStatus = async () => {
      setIsCheckingFollows(true);
      setFollowError(null);

      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (!selectedVaultId) {
        // console.warn("[FollowCheck] No selectedVaultId found.");
        setIsCheckingFollows(false);
        return;
      }

      // 1. Check IndexedDB first for twitterFollowVerified status
      try {
        const storedStatus = await getVerificationStatus(selectedVaultId);
        if (storedStatus?.twitterFollowVerified === true) {
          console.log('[UI LOG - FollowCheck] Twitter follow already verified in IndexedDB for vault:', selectedVaultId);
          setIsFollowing(true);
          setTwitterCoinsGranted(true); // Update UI for coins
          setIsCheckingFollows(false);
          return; // Exit early, no need to call API
        } else {
          console.log('[UI LOG - FollowCheck] Twitter follow not verified in IndexedDB (or status is false) for vault:', selectedVaultId, '. Proceeding to API check.');
        }
      } catch (dbError) {
        console.error('[FollowCheck] Error reading twitterFollowVerified from IndexedDB:', dbError);
        console.log('[UI LOG - FollowCheck] Error reading from IndexedDB for vault:', selectedVaultId, '. Proceeding to API check.');
        // Optionally, handle DB error (e.g., by forcing API check or showing a message)
        // For now, we'll  to API check if DB read fails, similar to cache-miss.
      }
      
      // console.log('[FollowCheck] Not verified in IndexedDB or DB error, proceeding to API check.');
      // 2. If not verified in DB (or DB error), proceed to API
      const twitterUserId = localStorage.getItem('twitterUserId');
      const sponsorTwitterId = getSponsorTwitterId(); // Relies on vaultData

      if (sponsorTwitterId) {
        // Case: Sponsor exists, an API call is needed if we have the user's Twitter ID.
        if (!twitterUserId) {
          // console.warn("[FollowCheck] Twitter User ID not found, but sponsor exists. Cannot verify follow.");
          setFollowError("X (Twitter) User ID not found. Please connect X first.");
          setIsFollowing(false);
          // We might not want to set twitterFollowVerified to false in DB here,
          // as it's a prerequisite issue (missing twitterUserId), not a failed verification.
          setIsCheckingFollows(false);
          return;
        }

        // Proceed with API call since sponsorTwitterId and twitterUserId are available
        try {
          const walletAddress = localStorage.getItem('userWalletAddress');
          const selectedVaultId = localStorage.getItem('selectedVaultId');

          const followCheckResponse = await fetch('/api/rapidfollowingcheck', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // TODO: Consider adding cache-control headers if appropriate for this API
            },
            body: JSON.stringify({ twitterUserId, sponsorTwitterId, walletAddress }),
          });
          const followData = await followCheckResponse.json();

          if (followData.success) {
            setIsFollowing(followData.isFollowing);

            if (followData.isFollowing) {
              // Check if credits have already been awarded before attempting to award
              const currentStatus = await getVerificationStatus(selectedVaultId);
              if (!currentStatus?.creditsAwarded && walletAddress && selectedVaultId) {
                console.log(`[FollowCheck] User is following. Attempting to award credits for vault ${selectedVaultId}`);
                const creditResult = await awardFreeCreditIfEligibleAPI(Number(selectedVaultId), walletAddress);
                if (creditResult.eligible) {
                  setCreditsGranted(true); // Update state based on awardFreeCreditIfEligibleAPI call
                  await updateVerificationStatus(selectedVaultId, { creditsAwarded: true }); // Mark credits as awarded
                  console.log(`[FollowCheck] Successfully awarded ${creditResult.creditsGained} credits for vault ${selectedVaultId}.`);
                } else {
                  setCreditsGranted(false);
                  console.warn(`[FollowCheck] Credits not awarded for vault ${selectedVaultId}: ${creditResult.error || 'Not eligible (e.g., already claimed)'}`);
                  // Optionally, set a user-facing message if credit award specifically fails,
                  // distinct from followError which is about the follow action itself.
                }
              } else if (currentStatus?.creditsAwarded) {
                console.log(`[FollowCheck] Credits already awarded for vault ${selectedVaultId}, skipping credit award API call`);
                setCreditsGranted(true); // Set UI state to show credits already granted
              } else {
                console.warn("[FollowCheck] Missing walletAddress or selectedVaultId for awarding credits.");
                setCreditsGranted(false); // Ensure credits are not granted if data is missing
              }
              // Now update IndexedDB for the follow verification status
              await updateVerificationStatus(selectedVaultId, { twitterFollowVerified: true });
              setTwitterCoinsGranted(true); // UI update for the follow button coin state
            } else {
              // User is NOT following
              setFollowError('Please follow the sponsor account to continue.');
              await updateVerificationStatus(selectedVaultId, { twitterFollowVerified: false });
              setCreditsGranted(false); // Ensure credits are not granted if not following
              setTwitterCoinsGranted(false); // Reset coin state for follow button
            }
          } else {
            // Handle specific API errors (e.g., duplicate Twitter ID from rapidfollowingcheck)
            if (followCheckResponse.status === 409 && followData.error?.includes('already linked')) {
              setFollowError(followData.error);
              alert(`Error: ${followData.error}\n\nPlease use a different X (Twitter) account or wallet.`);
            } else {
              setFollowError(followData.error || 'Error checking follow status via API.');
            }
            setIsFollowing(false); // Ensure UI reflects non-verified status on API error
            if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterFollowVerified: false });
            setCreditsGranted(false); // Ensure credits are not granted on API error
            setTwitterCoinsGranted(false); // Reset coin state for follow button
          }
        } catch (apiError) {
          // console.error('[FollowCheck] API call to /api/rapidfollowingcheck failed:', apiError);
          setFollowError('Failed to connect to X verification service. Please try again.');
          setIsFollowing(false);
          // Ensure DB reflects failure if API call itself fails
          const selectedVaultId = localStorage.getItem('selectedVaultId'); // Get it again in catch block
          if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterFollowVerified: false });
          setCreditsGranted(false); // Ensure credits are not granted on catch
          setTwitterCoinsGranted(false); // Reset coin state for follow button
        }
      } else {
        // Case: No sponsorTwitterId (e.g., vault doesn't require following a specific sponsor)
        // In this scenario, this step is considered automatically verified.
        // console.log('[FollowCheck] No sponsor Twitter ID for this vault. Auto-verifying follow step.');
        setIsFollowing(true);
        await updateVerificationStatus(selectedVaultId, { twitterFollowVerified: true });
        setTwitterCoinsGranted(true);
        // TODO: Review credit logic if applicable when no specific sponsor follow is needed.
      }
      setIsCheckingFollows(false);
    };

    checkFollowStatus();
  }, [user, authLoading, loading, routeValidationError, vaultData]); // Key dependencies

  // Check Cluster Protocol Twitter follow status when session changes
  useEffect(() => {
    // Only run if not loading and no route validation error
    if (loading || routeValidationError || authLoading || !user) return; // Ensure user is present

    // Skip Cluster Protocol follow check for specific vault IDs
    if (shouldSkipClusterFollow()) {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      console.log('[UI LOG - ClusterFollowCheck] Skipping Cluster follow check for vault:', selectedVaultId);
      setIsFollowingCluster(true);
      setClusterCreditsGranted(true);
      setClusterCoinsGranted(true);
      return;
    }

    const checkClusterFollowStatus = async () => {
      setIsCheckingClusterFollow(true);
      setClusterFollowError(null);

      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (!selectedVaultId) {
        // console.warn("[ClusterFollowCheck] No selectedVaultId found.");
        setIsCheckingClusterFollow(false);
        return;
      }

      // 1. Check IndexedDB first for twitterFollowClusterVerified status
      try {
        const storedStatus = await getVerificationStatus(selectedVaultId);
        if (storedStatus?.twitterFollowClusterVerified === true) {
          console.log('[UI LOG - ClusterFollowCheck] Cluster follow already verified in IndexedDB for vault:', selectedVaultId);
          setIsFollowingCluster(true);
          setClusterCoinsGranted(true); // Update UI for coins
          setIsCheckingClusterFollow(false);
          return; // Exit early, no need to call API
        } else {
          console.log('[UI LOG - ClusterFollowCheck] Cluster follow not verified in IndexedDB for vault:', selectedVaultId, '. Proceeding to API check.');
        }
      } catch (dbError) {
        console.error('[ClusterFollowCheck] Error reading twitterFollowClusterVerified from IndexedDB:', dbError);
        console.log('[UI LOG - ClusterFollowCheck] Error reading from IndexedDB for vault:', selectedVaultId, '. Proceeding to API check.');
      }
      
      // 2. Proceed to API check - hardcoded Cluster Protocol Twitter ID
      const twitterUserId = localStorage.getItem('twitterUserId');
      const clusterTwitterId = "1581344622390829056"; // Hardcoded Cluster Protocol Twitter ID

      if (!twitterUserId) {
        // console.warn("[ClusterFollowCheck] Twitter User ID not found. Cannot verify Cluster follow.");
        setClusterFollowError("X (Twitter) User ID not found. Please connect X first.");
        setIsFollowingCluster(false);
        setIsCheckingClusterFollow(false);
        return;
      }

      // Proceed with API call
      try {
        const walletAddress = localStorage.getItem('userWalletAddress');

        const followCheckResponse = await fetch('/api/rapidfollowingcheck', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ twitterUserId, sponsorTwitterId: clusterTwitterId, walletAddress }),
        });
        const followData = await followCheckResponse.json();

        if (followData.success) {
          setIsFollowingCluster(followData.isFollowing);

          if (followData.isFollowing) {
            // User is following Cluster Protocol
            console.log('[ClusterFollowCheck] User is following Cluster Protocol.');
            await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: true });
            setClusterCoinsGranted(true); // UI update for the follow button coin state
            setClusterCreditsGranted(true); // UI update for button state
          } else {
            // User is NOT following Cluster Protocol
            setClusterFollowError('Please follow @ClusterProtocol to continue.');
            await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: false });
            setClusterCoinsGranted(false); // Reset coin state for follow button
            setClusterCreditsGranted(false); // Reset credits granted state
          }
        } else {
          // Handle specific API errors
          if (followCheckResponse.status === 409 && followData.error?.includes('already linked')) {
            setClusterFollowError(followData.error);
            alert(`Error: ${followData.error}\n\nPlease use a different X (Twitter) account or wallet.`);
          } else {
            setClusterFollowError(followData.error || 'Error checking Cluster follow status via API.');
          }
          setIsFollowingCluster(false); // Ensure UI reflects non-verified status on API error
          if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: false });
          setClusterCoinsGranted(false); // Reset coin state for follow button
          setClusterCreditsGranted(false); // Reset credits granted state
        }
      } catch (apiError) {
        // console.error('[ClusterFollowCheck] API call to /api/rapidfollowingcheck failed:', apiError);
        setClusterFollowError('Failed to connect to X verification service. Please try again.');
        setIsFollowingCluster(false);
        if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: false });
        setClusterCoinsGranted(false); // Reset coin state for follow button
        setClusterCreditsGranted(false); // Reset credits granted state
      }
      
      setIsCheckingClusterFollow(false);
    };

    checkClusterFollowStatus();
  }, [user, authLoading, loading, routeValidationError, vaultData]); // Key dependencies

  // Check Twitter verification on component mount
  useEffect(() => {
    if (loading || routeValidationError) return;
    
    const checkStoredTwitterVerification = async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (selectedVaultId) {
        try {
          const status = await getVerificationStatus(selectedVaultId);
          if (status?.twitterFollowVerified) {
            console.log('[UI LOG - TwitterFollowInitialCheck] Twitter follow already verified in IndexedDB on mount for vault:', selectedVaultId);
            setIsFollowing(true); // Update UI state
            setTwitterCoinsGranted(true); // Update UI state for coin text
          } else {
            console.log('[UI LOG - TwitterFollowInitialCheck] Twitter follow not verified in IndexedDB on mount for vault:', selectedVaultId, '. Main check will run if needed.');
            setIsFollowing(false); // Ensure it's false if not verified initially
          }
        } catch (dbError) {
          console.error('[TwitterFollowInitialCheck] Error reading twitterFollowVerified from IndexedDB on mount:', dbError);
          console.log('[UI LOG - TwitterFollowInitialCheck] Error reading Twitter follow status from IndexedDB on mount for vault:', selectedVaultId);
          setIsFollowing(false);
        }
      }
    };
    
    checkStoredTwitterVerification();
  }, [loading, routeValidationError]);

  // Load all verification states from IndexedDB on component mount or when vaultId/user changes
  useEffect(() => {
    if (loading || routeValidationError || !user) return;

    const loadStatesFromDB = async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (selectedVaultId) {
        try {
          console.log('[UI LOG - LoadAllStates] Attempting to load all verification states from IndexedDB for vault:', selectedVaultId);
          const status = await getVerificationStatus(selectedVaultId);
          if (status) {
            console.log('[UI LOG - LoadAllStates] Found states in IndexedDB:', status);
            setIsFollowing(status.twitterFollowVerified || false);
            setTelegramCreditsGranted(status.telegramVerified || false);
            setIsTweetVerified(status.tweetPostedVerified || false);
            setIsRetweetVerified(status.retweetVerified || false);
            // hasLikedTweet is managed by its own hook and synced separately
            
            // Update UI coin states based on DB
            if (status.twitterFollowVerified) setTwitterCoinsGranted(true);
            else setTwitterCoinsGranted(false); // Ensure coins are reset if not verified
            if (status.telegramVerified) setTelegramCoinsGranted(true);
            else setTelegramCoinsGranted(false); // Ensure coins are reset
            if (status.discordVerified) setDiscordCoinsGranted(true);
            else setDiscordCoinsGranted(false); // Ensure coins are reset
            if (status.linkedinVerified) setLinkedinCoinsGranted(true);
            else setLinkedinCoinsGranted(false); // Ensure coins are reset
            if (status.extraLinkVerified) setExtraLinkCoinsGranted(true);
            else setExtraLinkCoinsGranted(false); // Ensure coins are reset
            // Add similar for retweet/like coins if they have separate coin states

            // Check if credits were already awarded and set the state accordingly
            if (status.creditsAwarded) {
              setCreditsGranted(true);
              console.log(`[UI LOG - LoadAllStates] Credits already awarded for vault: ${selectedVaultId}`);
            } else {
              setCreditsGranted(false);
            }

            // Log individual statuses found
            console.log(`[UI LOG - LoadAllStates] From DB - TwitterFollow: ${status.twitterFollowVerified}, Telegram: ${status.telegramVerified}, TweetPosted: ${status.tweetPostedVerified}, Retweet: ${status.retweetVerified}, TwitterLike: ${status.twitterLikeVerified}, Discord: ${status.discordVerified}, LinkedIn: ${status.linkedinVerified}, ExtraLink: ${status.extraLinkVerified}, CreditsAwarded: ${status.creditsAwarded}`);

            // Auto-verify Cluster Protocol follow for specific vault IDs if not already verified
            if (shouldSkipClusterFollow() && !status.twitterFollowClusterVerified) {
              console.log('[UI LOG - LoadAllStates] Auto-verifying Cluster follow for vault:', selectedVaultId);
              await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: true });
              setIsFollowingCluster(true);
              setClusterCreditsGranted(true);
              setClusterCoinsGranted(true);
            } else if (shouldSkipClusterFollow()) {
              // Already verified, just set UI states
              setIsFollowingCluster(true);
              setClusterCreditsGranted(true);
              setClusterCoinsGranted(true);
            }

          } else {
            console.log('[UI LOG - LoadAllStates] No states found in IndexedDB for vault:', selectedVaultId, '. Resetting UI states.');
            // If no status in DB, reset all relevant UI states to false
            setIsFollowing(false);
            setTelegramCreditsGranted(false);
            setDiscordCreditsGranted(false);
            setLinkedinCreditsGranted(false);
            setExtraLinkCreditsGranted(false);
            setIsTweetVerified(false);
            setIsRetweetVerified(false);
            setTwitterCoinsGranted(false);
            setTelegramCoinsGranted(false);
            setDiscordCoinsGranted(false);
            setLinkedinCoinsGranted(false);
            setExtraLinkCoinsGranted(false);

            // Auto-verify Cluster Protocol follow for specific vault IDs even when no states exist
            if (shouldSkipClusterFollow()) {
              console.log('[UI LOG - LoadAllStates] Auto-verifying Cluster follow for vault (no existing states):', selectedVaultId);
              await updateVerificationStatus(selectedVaultId, { twitterFollowClusterVerified: true });
              setIsFollowingCluster(true);
              setClusterCreditsGranted(true);
              setClusterCoinsGranted(true);
            } else {
              setIsFollowingCluster(false);
              setClusterCreditsGranted(false);
              setClusterCoinsGranted(false);
            }
          }
        } catch (dbError) {
          console.error('[LoadAllStates] Error loading states from IndexedDB:', dbError);
          console.log('[UI LOG - LoadAllStates] Error loading states from IndexedDB for vault:', selectedVaultId, '. UI states may not be accurate.');
          // Potentially reset states here as well if DB is crucial and fails
          setIsFollowing(false);
          setTelegramCreditsGranted(false);
          setDiscordCreditsGranted(false);
          setLinkedinCreditsGranted(false);
          setExtraLinkCreditsGranted(false);
          setIsTweetVerified(false);
          setIsRetweetVerified(false);
          setTwitterCoinsGranted(false);
          setTelegramCoinsGranted(false);
          setDiscordCoinsGranted(false);
          setLinkedinCoinsGranted(false);
          setExtraLinkCoinsGranted(false);

          // Auto-verify Cluster Protocol follow for specific vault IDs even on DB error
          if (shouldSkipClusterFollow()) {
            console.log('[UI LOG - LoadAllStates] Auto-verifying Cluster follow for vault (DB error):', selectedVaultId);
            setIsFollowingCluster(true);
            setClusterCreditsGranted(true);
            setClusterCoinsGranted(true);
          } else {
            setIsFollowingCluster(false);
            setClusterCreditsGranted(false);
            setClusterCoinsGranted(false);
          }
        }
      }
    };

    loadStatesFromDB();
  }, [loading, routeValidationError, user, vaultData]); // vaultData dependency in case vaultId changes and we need to reload.

  // Check tweet content status when session changes (only if vault has tweetContent)
  useEffect(() => {
    if (loading || routeValidationError || !vaultData?.tweetContent || authLoading || !user) return;
    const checkTweetStatus = async () => {
      setIsCheckingTweet(true);
      setTweetError(null);
      const walletAddress = localStorage.getItem('userWalletAddress');
      const userId = localStorage.getItem('twitterUserId');
      const selectedVaultId = localStorage.getItem('selectedVaultId');

      if (!selectedVaultId) {
        // console.warn("[TweetCheck] No selectedVaultId found.");
        setIsCheckingTweet(false);
        return;
      }
      if (!userId) {
        // console.warn("[TweetCheck] No userId for tweet check.");
        setIsCheckingTweet(false);
        return;
      }

      // 1. Check IndexedDB first
      try {
        const storedStatus = await getVerificationStatus(selectedVaultId);
        if (storedStatus?.tweetPostedVerified === true) {
          console.log('[UI LOG - TweetCheck] Tweet already verified in IndexedDB for vault:', selectedVaultId);
          setIsTweetVerified(true);
          setIsCheckingTweet(false);
          return; // Exit early
        } else {
          console.log('[UI LOG - TweetCheck] Tweet not verified in IndexedDB for vault:', selectedVaultId, '. Proceeding to API check.');
        }
      } catch (dbError) {
        console.error('[TweetCheck] Error reading tweetPostedVerified from IndexedDB:', dbError);
        console.log('[UI LOG - TweetCheck] Error reading Tweet status from IndexedDB for vault:', selectedVaultId, '. Proceeding to API check.');
      }

      // 2. Proceed to API check
      // console.log('[UI LOG - TweetCheck] Proceeding to API check for tweet status for vault:', selectedVaultId);
      try {
        const response = await fetch('/api/twittertweets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            content: vaultData.tweetContent,
            walletAddress
          })
        });
        const data = await response.json();
        if (data.success && data.hasMatchingTweet) {
          console.log('[UI LOG - TweetCheck] Tweet verified via API for vault:', selectedVaultId);
          setIsTweetVerified(true);
          await updateVerificationStatus(selectedVaultId, { tweetPostedVerified: true });
        } else {
          console.log('[UI LOG - TweetCheck] Tweet not verified via API for vault:', selectedVaultId, 'API Response:', data);
          setIsTweetVerified(false);
          await updateVerificationStatus(selectedVaultId, { tweetPostedVerified: false });
          setTweetError(data.error || 'Required tweet not found.');
        }
      } catch (error) {
        console.error('[TweetCheck] API call failed:', error);
        console.log('[UI LOG - TweetCheck] Tweet verification API call failed for vault:', selectedVaultId);
        setTweetError('Failed to verify tweet');
        setIsTweetVerified(false);
        if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { tweetPostedVerified: false });
      } finally {
        setIsCheckingTweet(false);
      }
    };
    checkTweetStatus();
  }, [user, authLoading, loading, routeValidationError, vaultData]);

  // Get the Twitter URL from vault data, falling back to Cluster Protocol if not available
  const getTwitterUrl = () => {
    if (vaultData && vaultData.sponsor_links && vaultData.sponsor_links.twitter) {
      // Extract username from the vault's Twitter URL and create follow intent
      const twitterUrl = vaultData.sponsor_links.twitter;
      const usernameMatch = twitterUrl.match(/twitter\.com\/([^\/\?]+)|x\.com\/([^\/\?]+)/);
      if (usernameMatch) {
        const username = usernameMatch[1] || usernameMatch[2];
        return `https://x.com/intent/follow?screen_name=${username}`;
      }
      return twitterUrl; // fallback to original URL if we can't extract username
    }
    // Fallback to Cluster Protocol follow intent
    return "https://x.com/intent/follow?screen_name=clusterprotocol";
  };

  // Get the Telegram URL from vault data
  const getTelegramUrl = () => {
    if (vaultData && vaultData.sponsor_links && vaultData.sponsor_links.telegram) {
      return vaultData.sponsor_links.telegram;
    }
    return null;
  };

  // Handler for Telegram button with delay
  const handleTelegramJoin = async () => {
    const telegramUrl = getTelegramUrl();
    if (!telegramUrl) {
      // console.log("No Telegram URL provided for this vault");
      return;
    }
    setTelegramProcessing(true);
    setTimeout(async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      // const walletAddress = localStorage.getItem('userWalletAddress'); // Not used for this update directly
      
      if (selectedVaultId) {
        await updateVerificationStatus(selectedVaultId, { telegramVerified: true });
        setTelegramCoinsGranted(true); // UI update
      }
      setTelegramCreditsGranted(true); // UI update for button state
      setTelegramProcessing(false);
      window.open(telegramUrl, "_blank");
    }, 1500);
  };

  // Handler for Discord button with delay
  const handleDiscordJoin = async () => {
    const discordUrl = getDiscordUrl();
    if (!discordUrl) {
      // console.log("No Discord URL provided for this vault");
      return;
    }
    setDiscordProcessing(true);
    setTimeout(async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      
      if (selectedVaultId) {
        await updateVerificationStatus(selectedVaultId, { discordVerified: true });
        setDiscordCoinsGranted(true); // UI update
      }
      setDiscordCreditsGranted(true); // UI update for button state
      setDiscordProcessing(false);
      window.open(discordUrl, "_blank");
    }, 1500);
  };

  // Handler for LinkedIn button with delay
  const handleLinkedInJoin = async () => {
    const linkedinUrl = getLinkedInUrl();
    if (!linkedinUrl) {
      // console.log("No LinkedIn URL provided for this vault");
      return;
    }
    setLinkedinProcessing(true);
    setTimeout(async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      
      if (selectedVaultId) {
        await updateVerificationStatus(selectedVaultId, { linkedinVerified: true });
        setLinkedinCoinsGranted(true); // UI update
      }
      setLinkedinCreditsGranted(true); // UI update for button state
      setLinkedinProcessing(false);
      window.open(linkedinUrl, "_blank");
    }, 1500);
  };

  // Handler for Extra Link button with delay
  const handleExtraLinkJoin = async () => {
    const extraLinkUrl = getExtraLinkUrl();
    if (!extraLinkUrl) {
      // console.log("No Extra Link URL provided for this vault");
      return;
    }
    setExtraLinkProcessing(true);
    setTimeout(async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      
      if (selectedVaultId) {
        await updateVerificationStatus(selectedVaultId, { extraLinkVerified: true });
        setExtraLinkCoinsGranted(true); // UI update
      }
      setExtraLinkCreditsGranted(true); // UI update for button state
      setExtraLinkProcessing(false);
      window.open(extraLinkUrl, "_blank");
    }, 1500);
  };

  // Handler for regular Twitter auth button click
  const handleTwitterAuth = async () => {
    if (user) { // Supabase user check
      const twitterUrl = getTwitterUrl();
      if (twitterUrl) {
        window.open(twitterUrl, "_blank");
      }
    } else {
      // console.log("[Supabase Auth] Attempting to sign in with Twitter.");
      const supabaseClient = createClient();
      // console.log("[Supabase Auth] Supabase client initialized:", supabaseClient ? 'Client OK' : 'Client FAILED');
      
      const redirectTo = `${window.location.origin}/auth/callback`;
      // console.log("[Supabase Auth] Redirect URL for OAuth:", redirectTo);

      try {
        // console.log("[Supabase Auth] About to call signInWithOAuth...");
        const result = await supabaseClient.auth.signInWithOAuth({
          provider: 'twitter',
          options: {
            redirectTo: redirectTo,
          },
        });

        // console.log("[Supabase Auth] signInWithOAuth result:", result);

        if (result.error) {
          // console.error("[Supabase Auth] Error during signInWithOAuth call:", result.error);
          setFollowError(`Failed to connect with X: ${result.error.message}`);
        } else {
          // console.log("[Supabase Auth] signInWithOAuth successful, checking data:", result.data);
          if (result.data && result.data.url) {
            // console.log("[Supabase Auth] OAuth URL generated:", result.data.url);
            // The URL should look like: https://bolnsjszdtkiehgojpbw.supabase.co/auth/v1/authorize?provider=twitter&...
            window.location.href = result.data.url;
          } else {
            // console.warn("[Supabase Auth] No URL in result.data, automatic redirect should happen");
          }
        }
      } catch (clientError) {
        // console.error("[Supabase Auth] Client-side exception during signInWithOAuth:", clientError);
        setFollowError("A client-side error occurred while trying to connect with X.");
      }
    }
  };

  // Handler for Cluster Protocol Twitter follow (using API verification)
  const handleClusterTwitterAuth = async () => {
    // Skip action for specific vault IDs
    if (shouldSkipClusterFollow()) {
      console.log('[UI LOG - ClusterFollowAuth] Skipping Cluster Protocol follow action for vault:', selectedVaultId);
      return;
    }

    if (user) { // Supabase user check
      const clusterTwitterUrl = "https://x.com/intent/follow?screen_name=ClusterProtocol";
      window.open(clusterTwitterUrl, "_blank");
      // Note: Verification is handled by the checkClusterFollowStatus effect
    } else {
      // Same auth logic as regular Twitter auth
      const supabaseClient = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      try {
        const result = await supabaseClient.auth.signInWithOAuth({
          provider: 'twitter',
          options: {
            redirectTo: redirectTo,
          },
        });

        if (result.error) {
          setClusterFollowError(`Failed to connect with X: ${result.error.message}`);
        } else {
          if (result.data && result.data.url) {
            window.location.href = result.data.url;
          }
        }
      } catch (clientError) {
        setClusterFollowError("A client-side error occurred while trying to connect with X.");
      }
    }
  };

  // Get URL functions for new social platforms
  const getDiscordUrl = () => {
    if (vaultData && vaultData.discord_link) {
      return vaultData.discord_link;
    }
    return null;
  };

  const getLinkedInUrl = () => {
    if (vaultData && vaultData.linkedin_link) {
      return vaultData.linkedin_link;
    }
    return null;
  };

  const getExtraLinkUrl = () => {
    if (vaultData && vaultData.extra_link) {
      return vaultData.extra_link;
    }
    return null;
  };

  // Calculate total number of verification buttons for responsive sizing
  const getTotalVerificationButtons = () => {
    let count = 2; // Base buttons: Sponsor follow, Retweet & Like (removed Cluster follow from base)
    if (!shouldSkipClusterFollow()) count++; // Add Cluster follow if not skipped
    if (vaultData?.tweetContent) count++; // Tweet button
    if (getTelegramUrl()) count++; // Telegram button
    if (getDiscordUrl()) count++; // Discord button
    if (getLinkedInUrl()) count++; // LinkedIn button
    if (getExtraLinkUrl()) count++; // Extra Link button
    return count;
  };

  // Get responsive button height based on number of buttons and vault ID
  const getButtonHeight = () => {
    const totalButtons = getTotalVerificationButtons();
    
    // Smaller heights for non-113 vaults
    if (selectedVaultId !== '113' && selectedVaultId !== '114') {
      if (totalButtons >= 6) return "h-16"; // Smaller for 6+ buttons
      if (totalButtons >= 5) return "h-18"; // Medium for 5 buttons
      return "h-20"; // Standard for 4 or fewer buttons
    }
    
    // Original heights for vault 113
    if (totalButtons >= 6) return "h-20"; // Smaller for 6+ buttons
    if (totalButtons >= 5) return "h-22"; // Medium for 5 buttons
    return "h-24"; // Standard for 4 or fewer buttons
  };

  // Get responsive margin based on number of buttons
  const getButtonMargin = () => {
    const totalButtons = getTotalVerificationButtons();
    if (totalButtons >= 6) return "mb-2"; // Smaller margin for 6+ buttons
    if (totalButtons >= 5) return "mb-2.5"; // Medium margin for 5 buttons
    return "mb-3"; // Standard margin for 4 or fewer buttons
  };

  const getSlightlyTallerHeight = (originalHeightClass: string): string => {
    // Handle smaller heights for non-113 vaults
    if (originalHeightClass === "h-16") return "h-20"; // Increased from h-16
    if (originalHeightClass === "h-18") return "h-22"; // Increased from h-18
    if (originalHeightClass === "h-20") return "h-24"; // Increased from h-20
    
    // Handle original heights for vault 113
    if (originalHeightClass === "h-22") return "h-28"; // Increased from h-24
    if (originalHeightClass === "h-24") return "h-32"; // Increased from h-28
    return originalHeightClass; // Fallback
  };

  // Get conditional top margin for specific vault ID
  const getContainerTopMargin = () => {
    if (selectedVaultId === '113' || selectedVaultId === '114') {
      return "mt-2 md:mt-5"; // Changed from "mt-2 md:mt-7" to fine-tune the right column position
    }
    return "-mt-7 md:-mt-10"; // Default margins
  };

  // Get conditional button width for specific vault ID
  const getButtonWidth = () => {
    if (selectedVaultId === '113') {
      return "w-5/6"; // Adjusted from w-3/4 for a slightly wider button for vault 113
    }
    return "w-11/12"; // Adjusted from w-7/8 for a slightly wider button by default
  };

  // Get conditional gradient colors for vault ID 113 and 114
  const getBarGradientClasses = () => {
    if (selectedVaultId === '113') {
      return "bg-gradient-to-r from-blue-500 to-blue-700"; // Blue gradient for vault 113
    } else if (selectedVaultId === '114') {
      return "bg-gradient-to-r from-green-500 to-green-700"; // Green gradient for vault 114
    }
    return "bg-gradient-to-r from-yellow-500 to-orange-500"; // Default gradient
  };

  // Get conditional box shadow for bar gradient
  const getBarBoxShadow = () => {
    if (selectedVaultId === '113') {
      return "0 0 15px 5px rgba(26, 86, 203, 0.5)"; // Blue glow for vault 113
    } else if (selectedVaultId === '114') {
      return "0 0 15px 5px rgba(34, 197, 94, 0.5)"; // Green glow for vault 114
    }
    return "0 0 15px 5px rgba(255, 193, 7, 0.5)"; // Default yellow glow
  };

  // Get conditional light cone gradient
  const getLightConeGradient = () => {
    if (selectedVaultId === '113') {
      return "linear-gradient(to bottom, rgba(26, 86, 203, 0.4), rgba(26, 86, 203, 0.0))"; // Blue cone for vault 113
    } else if (selectedVaultId === '114') {
      return "linear-gradient(to bottom, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.0))"; // Green cone for vault 114
    }
    return "linear-gradient(to bottom, rgba(255, 193, 7, 0.4), rgba(255, 193, 7, 0.0))"; // Default yellow cone
  };

  // Get conditional proceed button gradient
  const getProceedButtonGradient = () => {
    if (selectedVaultId === '113') {
      return canProceedToVault ? "from-blue-400 to-blue-600" : "from-gray-500 to-gray-700"; // Lighter blue gradient for vault 113
    } else if (selectedVaultId === '114') {
      return canProceedToVault ? "from-green-400 to-green-600" : "from-gray-500 to-gray-700"; // Green gradient for vault 114
    }
    return canProceedToVault ? "from-green-500 to-green-700" : "from-gray-500 to-gray-700"; // Default green gradient
  };

  // Get conditional heading color for vault ID 113 and 114
  const getHeadingColor = () => {
    if (selectedVaultId === '113') {
      return "text-blue-400"; // Lighter blue hue for vault 113
    } else if (selectedVaultId === '114') {
      return "text-green-400"; // Green color for vault 114
    }
    return "text-yellow-500"; // Default yellow color
  };

  // Get conditional panel glow effects for vault ID 113 and 114
  const getPanelGlowStyles = () => {
    if (selectedVaultId === '113') {
      return {
        filter: "drop-shadow(0 0 20px rgba(26, 86, 203, 0.6)) drop-shadow(0 0 40px rgba(26, 86, 203, 0.4))",
       
      }; // Blue glow for vault 113
    } else if (selectedVaultId === '114') {
      return {
        filter: "drop-shadow(0 0 20px rgba(34, 197, 94, 0.6)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))",
       
      }; // Green glow for vault 114
    }
    return {}; // Default no additional glow
  };

  // Get conditional vault text color for vault ID 113 and 114
  const getVaultTextColor = () => {
    if (selectedVaultId === '113') {
      return "text-blue-400"; // Blue color for vault 113
    } else if (selectedVaultId === '114') {
      return "text-green-400"; // Dark green color for vault 114
    }
    return "text-yellow-500"; // Default yellow color
  };

  // Get conditional bottom margin for left component for vault ID 113
  const getLeftComponentBottomMargin = () => {
    if (selectedVaultId === '113' || selectedVaultId === '114') {
      return "md:-mb-13"; // Changed from "md:-mb-12" to fine-tune the black card position
    }
    return ""; // Default no extra bottom margin
  };

  // Handle proceed to vault button click
  const handleProceedToVault = async () => { // Made async for potential DB interaction
    if (selectedVaultId) {
      // localStorage.setItem(`verified_${selectedVaultId}`, 'true'); // Old way
      await updateVerificationStatus(selectedVaultId, { allStepsVerified: true }); // TODO use this to direct user to chat itself
      router.push('/chat');
      if (vaultData && vaultData.sponsor_links && vaultData.sponsor_links.vault_url) {
        window.open(vaultData.sponsor_links.vault_url, '_blank');
      }
    } else {
      router.push('/vault');
    }
  };

  // Enable the "PROCEED TO VAULT" button only if the user has completed ALL verifications
  // Include tweet verification only if vault has tweetContent, and include like verification
  // This logic will now depend on states that are themselves derived from IndexedDB or API calls.
  // hasLikedTweet is from the useTwitterLike hook, which needs to persist its state or re-verify.
  // For twitterLikeVerified, we'll rely on the `hasLikedTweet` from the hook for now.
  // If `useTwitterLike` needs to persist its state across sessions, it should also use IndexedDB.
  // For this refactor, we assume `hasLikedTweet` reflects the current verifiable like status.
 // TODO refactor to an efficient version 
  const [allStepsComplete, setAllStepsComplete] = useState(false);

  useEffect(() => {
    const checkAllSteps = () => {
      const tweetStepNeeded = !!vaultData?.tweetContent;
      const discordStepNeeded = !!vaultData?.discord_link;
      const linkedinStepNeeded = !!vaultData?.linkedin_link;
      const extraLinkStepNeeded = !!vaultData?.extra_link;
      const secondRetweetNeeded = selectedVaultId === '113' || selectedVaultId === '114'; // Second retweet for vault 113 and 114
      
      // Base required steps
      let completed = isFollowing && isFollowingCluster && telegramCreditsGranted && isRetweetVerified && hasLikedTweet;
      
      // DEBUG: Log verification status for vault 114
      if (selectedVaultId === '114') {
        console.log('[DEBUG Vault 114] Verification Status:');
        console.log('- isFollowing:', isFollowing);
        console.log('- isFollowingCluster:', isFollowingCluster);
        console.log('- telegramCreditsGranted:', telegramCreditsGranted);
        console.log('- isRetweetVerified:', isRetweetVerified);
        console.log('- hasLikedTweet:', hasLikedTweet);
        console.log('- tweetStepNeeded:', tweetStepNeeded);
        console.log('- discordStepNeeded:', discordStepNeeded);
        console.log('- linkedinStepNeeded:', linkedinStepNeeded);
        console.log('- extraLinkStepNeeded:', extraLinkStepNeeded);
        console.log('- Base completed:', completed);
        
        if (tweetStepNeeded) {
          console.log('- isTweetVerified:', isTweetVerified);
        }
        if (discordStepNeeded) {
          console.log('- discordCreditsGranted:', discordCreditsGranted);
        }
        if (linkedinStepNeeded) {
          console.log('- linkedinCreditsGranted:', linkedinCreditsGranted);
        }
        if (extraLinkStepNeeded) {
          console.log('- extraLinkCreditsGranted:', extraLinkCreditsGranted);
        }
      }
      
      // Add conditional steps
      if (tweetStepNeeded) {
        completed = completed && isTweetVerified;
      }
      if (discordStepNeeded) {
        completed = completed && discordCreditsGranted;
      }
      if (secondRetweetNeeded) {
        // For vault 113 and 114, require second retweet AND second like instead of LinkedIn
        completed = completed && isSecondRetweetVerified && hasLikedSecondTweet;
      } else if (linkedinStepNeeded && selectedVaultId !== '114') {
        // For other vaults (except 114), require LinkedIn if specified
        completed = completed && linkedinCreditsGranted;
      }
      if (extraLinkStepNeeded) {
        completed = completed && extraLinkCreditsGranted;
      }
      
      // DEBUG: Log final completion status for vault 114
      if (selectedVaultId === '114') {
        console.log('- Final completed status:', completed);
        console.log('========================');
      }
      
      setAllStepsComplete(completed);
    };
    checkAllSteps();
  }, [isFollowing, isFollowingCluster, telegramCreditsGranted, discordCreditsGranted, linkedinCreditsGranted, extraLinkCreditsGranted, isRetweetVerified, hasLikedTweet, isTweetVerified, isSecondRetweetVerified, hasLikedSecondTweet, vaultData, selectedVaultId]);


  const canProceedToVault = allStepsComplete; // TODO use index db's allStepsVerified
  // const canProceedToVault = vaultData?.tweetContent 
  //   ? isFollowing && telegramCreditsGranted && isRetweetVerified && hasLikedTweet && isTweetVerified 
  //   : isFollowing && telegramCreditsGranted && isRetweetVerified && hasLikedTweet;


  // Retweet verification effect
  useEffect(() => {
    if (loading || routeValidationError || authLoading || !user || !isClient || !selectedVaultId) return; 
    
    const checkRetweetLogic = async () => {
      // 1. Check IndexedDB first
      try {
        const storedStatus = await getVerificationStatus(selectedVaultId);
        if (storedStatus?.retweetVerified === true) {
          console.log('[UI LOG - RetweetCheck] Retweet already verified in IndexedDB for vault:', selectedVaultId);
          setIsRetweetVerified(true);
          // If already verified from DB, no need to call API or set loading state for API call
          return; 
        }
        // console.log('[UI LOG - RetweetCheck] Retweet not verified in IndexedDB for vault:', selectedVaultId, '. Proceeding to API check if needed.');
      } catch (dbError) {
        console.error('[RetweetCheck] Error reading retweetVerified from IndexedDB:', dbError);
        console.log('[UI LOG - RetweetCheck] Error reading Retweet status from IndexedDB for vault:', selectedVaultId, '. Proceeding to API check if needed.');
        // Fall through to API check if DB read fails
      }

      // Only proceed to API check if not already verified from DB
      // The `isRetweetVerified` state variable might have been set by `loadStatesFromDB` already.
      // If `isRetweetVerified` is true here, it means it was loaded, so we can skip the API.
      if (isRetweetVerified) {
        // This case can happen if loadStatesFromDB ran after the initial DB check in this effect but before API call was made.
        // Or if this effect re-runs and isRetweetVerified is already true.
        console.log('[UI LOG - RetweetCheck] isRetweetVerified state is already true, skipping API call for vault:', selectedVaultId);
        return;
      }

      // 2. Proceed to API check
      // console.log('[UI LOG - RetweetCheck] Proceeding to API check for retweet for vault:', selectedVaultId);
      if (!user) { 
        // console.warn("[RetweetCheck] No Supabase user for API check.");
        setIsCheckingRetweet(false);
        setIsRetweetVerified(false); // Ensure this is false if no user for API check
        return;
      }
      
      try {
        const userId = localStorage.getItem('twitterUserId');
        if (!userId) {
          // console.warn('[RetweetCheck] Twitter User ID not found for API check.');
          setIsRetweetVerified(false);
          setIsCheckingRetweet(false);
          return;
        }

        setIsCheckingRetweet(true);
        setRetweetError(null);
        const response = await fetch('/api/twitter-retweet-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            content: getRetweetContent()
          })
        });
        const data = await response.json();
        if (data.success && data.hasRetweet) {
          console.log('[UI LOG - RetweetCheck] Retweet verified via API for vault:', selectedVaultId);
          setIsRetweetVerified(true);
          await updateVerificationStatus(selectedVaultId, { retweetVerified: true });
        } else {
          console.log('[UI LOG - RetweetCheck] Retweet not verified via API for vault:', selectedVaultId, 'API Response:', data);
          setIsRetweetVerified(false);
          await updateVerificationStatus(selectedVaultId, { retweetVerified: false });
          setRetweetError(data.error || 'Required retweet not found.');
        }
      } catch (error) {
        console.error('[RetweetCheck] API call failed:', error);
        console.log('[UI LOG - RetweetCheck] Retweet verification API call failed for vault:', selectedVaultId);
        setRetweetError('Failed to verify retweet');
        setIsRetweetVerified(false);
        if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { retweetVerified: false });
      } finally {
        setIsCheckingRetweet(false);
      }
    };

    checkRetweetLogic();

  }, [user, authLoading, loading, routeValidationError, vaultData, isRetweetVerified]); // isRetweetVerified added to dependency array

  // Second Retweet verification effect (for vault 113 and 114)
  useEffect(() => {
    if (loading || routeValidationError || authLoading || !user || !isClient || !selectedVaultId) return;
    
    // Only run for vault 113 and 114
    if (selectedVaultId !== '113' && selectedVaultId !== '114') return;
    
    const checkSecondRetweetLogic = async () => {
      // 1. Check IndexedDB first
      try {
        const storedStatus = await getVerificationStatus(selectedVaultId);
        if (storedStatus?.secondRetweetVerified === true) {
          console.log('[UI LOG - SecondRetweetCheck] Second retweet already verified in IndexedDB for vault:', selectedVaultId);
          setIsSecondRetweetVerified(true);
          return; 
        }
      } catch (dbError) {
        console.error('[SecondRetweetCheck] Error reading secondRetweetVerified from IndexedDB:', dbError);
        console.log('[UI LOG - SecondRetweetCheck] Error reading Second Retweet status from IndexedDB for vault:', selectedVaultId, '. Proceeding to API check if needed.');
      }

      // Only proceed to API check if not already verified from DB
      if (isSecondRetweetVerified) {
        console.log('[UI LOG - SecondRetweetCheck] isSecondRetweetVerified state is already true, skipping API call for vault:', selectedVaultId);
        return;
      }

      // 2. Proceed to API check
      if (!user) { 
        setIsCheckingSecondRetweet(false);
        setIsSecondRetweetVerified(false);
        return;
      }
      
      try {
        const userId = localStorage.getItem('twitterUserId');
        if (!userId) {
          setIsSecondRetweetVerified(false);
          setIsCheckingSecondRetweet(false);
          return;
        }

        setIsCheckingSecondRetweet(true);
        setSecondRetweetError(null);
        const response = await fetch('/api/twitter-retweet-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            content: getSecondRetweetContent()
          })
        });
        const data = await response.json();
        if (data.success && data.hasRetweet) {
          console.log('[UI LOG - SecondRetweetCheck] Second retweet verified via API for vault:', selectedVaultId);
          setIsSecondRetweetVerified(true);
          await updateVerificationStatus(selectedVaultId, { secondRetweetVerified: true });
        } else {
          console.log('[UI LOG - SecondRetweetCheck] Second retweet not verified via API for vault:', selectedVaultId, 'API Response:', data);
          setIsSecondRetweetVerified(false);
          await updateVerificationStatus(selectedVaultId, { secondRetweetVerified: false });
          setSecondRetweetError(data.error || 'Required second retweet not found.');
        }
      } catch (error) {
        console.error('[SecondRetweetCheck] API call failed:', error);
        console.log('[UI LOG - SecondRetweetCheck] Second retweet verification API call failed for vault:', selectedVaultId);
        setSecondRetweetError('Failed to verify second retweet');
        setIsSecondRetweetVerified(false);
        if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { secondRetweetVerified: false });
      } finally {
        setIsCheckingSecondRetweet(false);
      }
    };

    checkSecondRetweetLogic();

  }, [user, authLoading, loading, routeValidationError, vaultData, isSecondRetweetVerified, selectedVaultId]);

  // Add a recovery effect to reset stuck states
  useEffect(() => {
    // If we have errors and the user is authenticated, allow them to retry after 3 seconds
    if ((retweetError || likeError || secondRetweetError || secondLikeError) && user && !isCheckingRetweet && !isCheckingLike && !isCheckingSecondRetweet && !isCheckingSecondLike) {
      const timer = setTimeout(() => {
        // console.log('[Recovery] Clearing errors to allow retry');
        setRetweetError(null);
        clearLikeError();
        setSecondRetweetError(null);
        clearSecondLikeError();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [retweetError, likeError, secondRetweetError, secondLikeError, user, isCheckingRetweet, isCheckingLike, isCheckingSecondRetweet, isCheckingSecondLike, clearLikeError, clearSecondLikeError]);

  // Handler for retweet button click - sequential flow with mobile strategy
  const handleRetweetClick = async () => {
    if (isCheckingRetweet || (isCheckingLike /*&& retweetClicked - removed*/)) {
      return;
    }

    setRetweetError(null);
    clearLikeError();
    const selectedVaultId = localStorage.getItem('selectedVaultId');

    // Current logic:
    // 1. If retweet not verified, open retweet URL.
    // 2. If retweet IS verified, and tweet NOT liked, open like URL.
    // This means `retweetClicked` is not strictly necessary as a persisted state.
    // The state transitions are: (Initial) -> Retweet -> Like

    if (!isRetweetVerified) {
      window.open(requiredRetweetUrl, '_blank');
      // No state change here for `retweetClicked` as it's transient.
      // The user is expected to perform the action and then the `checkRetweetStatus` effect will verify.
    } else if (isRetweetVerified && !hasLikedTweet) {
      const likeUrl = `https://x.com/intent/like?tweet_id=${requiredTweetId}`;
      window.open(likeUrl, '_blank');
      
      if (isMobile) {
        setPendingMockLike(requiredTweetId);
      } else {
        try {
          const mockResult = await mockLikeAction(requiredTweetId); // This updates hasLikedTweet via useTwitterLike
          if (mockResult && selectedVaultId) {
             // Assuming mockLikeAction's success means the like is "verified" for our purposes
             // The useTwitterLike hook should ideally handle its own persistence if needed across sessions for `hasLikedTweet`
             // For now, if `useTwitterLike` correctly sets `hasLikedTweet`, that's enough for the UI.
             // If we need to explicitly store our own "twitterLikeVerified" flag based on this:
             await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: true });
             console.log('[LikeCheck] Mock like successful, updated twitterLikeVerified in IndexedDB.');
          } else if (!mockResult && selectedVaultId) {
            // If mock like failed, ensure it's false in DB
            await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: false });
          }
        } catch (error) {
          console.error('[LikeCheck] Error during mock like action:', error);
          if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: false });
        }
      }
    }
    // If both retweet and like are completed, button is typically disabled or shows "Completed"
  };

  // Manual handler for checking like status
  const handleCheckLikeStatus = async () => { // [ ]
    if (user) {
      try {
        clearLikeError(); 
        const result = await checkLikeStatus(requiredTweetId); // This updates hasLikedTweet
        const selectedVaultId = localStorage.getItem('selectedVaultId');
        if (selectedVaultId) {
          // Update our DB based on the result of checkLikeStatus
          // Assuming `checkLikeStatus` returns a boolean or similar that indicates like status
          // and updates `hasLikedTweet` within its hook.
          // We then persist this understanding.
          if (hasLikedTweet) { // Check the state variable updated by the hook
             await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: true });
          } else {
             await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: false });
          }
        }
      } catch (error) {
        // console.error('[LikeCheck] Error during manual like check:', error);
         const selectedVaultId = localStorage.getItem('selectedVaultId');
         if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: false });
      }
    }
  };

  // Manual retry function to reset states
  const handleManualRetry = async () => { // TODO can be removed 
    setRetweetError(null);
    clearLikeError();
    // setRetweetClicked(false); // Removed
    setIsRetweetVerified(false); 
    // setRetweetVerifiedAndPersisted(false); // Removed

    // For hasLikedTweet, the useTwitterLike hook should provide a way to reset its state if needed.
    // For now, we'll assume clearLikeError() helps, or the hook handles its reset.
    // If useTwitterLike persists `hasLikedTweet` (e.g. in its own localStorage or IndexedDB),
    // it should also be cleared here.
    // Manually setting `hasLikedTweet` to false here might conflict with the hook's own state management.
    // Instead, we update our DB record for `twitterLikeVerified`.

    setPendingMockLike(null);
    
    const selectedVaultId = localStorage.getItem('selectedVaultId');
    if (selectedVaultId) {
      // localStorage.removeItem(`retweet_clicked_${selectedVaultId}`); // Removed
      // localStorage.removeItem(`retweet_verified_${selectedVaultId}`); // Removed
      // localStorage.removeItem(`twitter_like_verified_${selectedVaultId}`); // Removed
      // Instead of removing individual localStorage items, clear the IndexedDB record for the vault
      await deleteVerificationStatus(selectedVaultId);
      // And reset relevant UI states including credits awarded flag
      setIsFollowing(false);
      setTelegramCreditsGranted(false);
      setDiscordCreditsGranted(false);
      setLinkedinCreditsGranted(false);
      setExtraLinkCreditsGranted(false);
      setIsTweetVerified(false);
      setIsRetweetVerified(false);
      // Call the function from useTwitterLike to clear its persisted state if it has one,
      // or if `hasLikedTweet` should be directly mutable for reset:
      // setHasLikedTweet(false); // This depends on how useTwitterLike is designed.
      // For now, clearing our DB flag:
      // await updateVerificationStatus(selectedVaultId, { twitterLikeVerified: false }); // deleteVerificationStatus covers this
      
      setTwitterCoinsGranted(false);
      setTelegramCoinsGranted(false);
      setDiscordCoinsGranted(false);
      setLinkedinCoinsGranted(false);
      setExtraLinkCoinsGranted(false);
      setCreditsGranted(false); // Reset credits granted state
      console.log('[ManualRetry] Cleared IndexedDB state for vault and reset UI states:', selectedVaultId);
    }
  };

  // Effect for useTwitterLike hook to update IndexedDB when hasLikedTweet changes
  useEffect(() => {
    const selectedVaultId = localStorage.getItem('selectedVaultId');
    if (selectedVaultId && user) { // Only update if vault and user exist
        // Assuming `hasLikedTweet` reflects a verified or mock-verified state from the hook.
        if (hasLikedTweet !== undefined) { // Check if hasLikedTweet has been explicitly set by the hook
            console.log(`[UI LOG - LikeSync] Attempting to sync hasLikedTweet (${hasLikedTweet}) to twitterLikeVerified in IndexedDB for vault: ${selectedVaultId}`);
            updateVerificationStatus(selectedVaultId, { twitterLikeVerified: hasLikedTweet })
            .then(() => {
              console.log(`[UI LOG - LikeSync] Successfully updated twitterLikeVerified to ${hasLikedTweet} in IndexedDB for vault: ${selectedVaultId}`);
            })
            .catch(err => {
              console.error("[LikeSync] Failed to update twitterLikeVerified in IndexedDB:", err);
              console.log(`[UI LOG - LikeSync] Failed to update twitterLikeVerified in IndexedDB for vault: ${selectedVaultId}. Error: ${err.message}`);
            });
        } else {
          // console.log('[UI LOG - LikeSync] hasLikedTweet is undefined, no sync to IndexedDB for vault:', selectedVaultId);
        }
    }
  }, [hasLikedTweet, user, lastChecked]); // lastChecked from useTwitterLike indicates a fresh check 
  // selectedVaultId is fetched inside, not a reactive dependency from props/state.

  // Effect for second useTwitterLike hook to update IndexedDB when hasLikedSecondTweet changes
  useEffect(() => {
    const selectedVaultId = localStorage.getItem('selectedVaultId');
    if (selectedVaultId && user && (selectedVaultId === '113' || selectedVaultId === '114')) { // For vault 113 and 114
        if (hasLikedSecondTweet !== undefined) {
            console.log(`[UI LOG - SecondLikeSync] Attempting to sync hasLikedSecondTweet (${hasLikedSecondTweet}) to secondTwitterLikeVerified in IndexedDB for vault: ${selectedVaultId}`);
            updateVerificationStatus(selectedVaultId, { secondTwitterLikeVerified: hasLikedSecondTweet })
            .then(() => {
              console.log(`[UI LOG - SecondLikeSync] Successfully updated secondTwitterLikeVerified to ${hasLikedSecondTweet} in IndexedDB for vault: ${selectedVaultId}`);
            })
            .catch(err => {
              console.error("[SecondLikeSync] Failed to update secondTwitterLikeVerified in IndexedDB:", err);
              console.log(`[UI LOG - SecondLikeSync] Failed to update secondTwitterLikeVerified in IndexedDB for vault: ${selectedVaultId}. Error: ${err.message}`);
            });
        }
    }
  }, [hasLikedSecondTweet, user, secondLastChecked]);

  // Handler for second retweet button click - same logic as first retweet but for second tweet
  const handleSecondRetweetClick = async () => {
    if (selectedVaultId !== '113' && selectedVaultId !== '114') return;
    
    if (isCheckingSecondRetweet || isCheckingSecondLike) {
      return;
    }

    setSecondRetweetError(null);
    clearSecondLikeError();

    // Get vault-specific tweet URLs
    const getSecondRetweetUrl = () => {
      if (selectedVaultId === '113') {
        return `https://x.com/intent/retweet?tweet_id=1929270231085490538`; // dFusion tweet
      } else if (selectedVaultId === '114') {
        return `https://x.com/intent/retweet?tweet_id=1897363722651279671`; // Pai3Ai tweet
      }
      return secondRequiredRetweetUrl;
    };

    const getSecondLikeUrl = () => {
      if (selectedVaultId === '113') {
        return `https://x.com/intent/like?tweet_id=1929270231085490538`; // dFusion tweet
      } else if (selectedVaultId === '114') {
        return `https://x.com/intent/like?tweet_id=1897363722651279671`; // Pai3Ai tweet
      }
      return `https://x.com/intent/like?tweet_id=${secondRequiredTweetId}`;
    };

    const getSecondTweetId = () => {
      if (selectedVaultId === '113') {
        return "1929270231085490538"; // dFusion tweet
      } else if (selectedVaultId === '114') {
        return "1897363722651279671"; // Pai3Ai tweet
      }
      return secondRequiredTweetId;
    };

    // Logic: 
    // 1. If second retweet not verified, open vault-specific second retweet URL
    // 2. If second retweet IS verified, and second tweet NOT liked, open vault-specific second like URL

    if (!isSecondRetweetVerified) {
      window.open(getSecondRetweetUrl(), '_blank');
    } else if (isSecondRetweetVerified && !hasLikedSecondTweet) {
      window.open(getSecondLikeUrl(), '_blank');
      
      const tweetId = getSecondTweetId();
      if (isMobile) {
        setPendingSecondMockLike(tweetId);
      } else {
        try {
          const mockResult = await mockSecondLikeAction(tweetId);
          if (mockResult && selectedVaultId) {
             await updateVerificationStatus(selectedVaultId, { secondTwitterLikeVerified: true });
             console.log('[SecondLikeCheck] Mock like successful, updated secondTwitterLikeVerified in IndexedDB.');
          } else if (!mockResult && selectedVaultId) {
            await updateVerificationStatus(selectedVaultId, { secondTwitterLikeVerified: false });
          }
        } catch (error) {
          console.error('[SecondLikeCheck] Error during mock like action:', error);
          if (selectedVaultId) await updateVerificationStatus(selectedVaultId, { secondTwitterLikeVerified: false });
        }
      }
    }
  };

  return (
    <BorderFrame>
    {routeValidationError ? (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-red-600 bg-opacity-25 border border-red-700 text-white px-6 py-4 rounded-lg text-center">
          <h2 className="text-2xl mb-2 font-bold">Access Error</h2>
          <p>{routeValidationError}</p>
          <p className="mt-2 text-sm">Redirecting to vault selection...</p>
        </div>
      </div>
    ) : (
      
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 md:px-20 relative -mt-20">
        
        {/* REMOVED: The mobile-only chatvault.png from here */}
        
        <div className="relative mt-16 md:mt-0">
          <h1
            className={`${getHeadingColor()} text-4xl md:text-5xl font-bold md:mt-10 mt-12 text-center mb-10 tracking-wide mobile-heading `}
            style={{
              fontFamily: "VT323, monospace",
              letterSpacing: "0.001em",
              wordSpacing: "0.001em",
            }}
          >
            COMPLETE THE ACCESS PROCEDURE 
          </h1>
          <div
            className={`w-1/2 h-1 ${getBarGradientClasses()} absolute bottom-0 left-1/2 transform mb-8 -translate-x-1/2`}
            style={{
              boxShadow: getBarBoxShadow(),
            }}
          >
            
          </div>
          

          {/* Light cone effect */}
          <div className="absolute w-1/2 top-[120px] h-[300px] left-1/2 transform -translate-x-1/2 overflow-visible pointer-events-none ">
            <div
              style={{
                position: "absolute",
                top: "-20px",
                left: "0",
                width: "100%",
                height: "300px",
                background: getLightConeGradient(),
                filter: "blur(15px)",
                transform: "perspective(400px) rotateX(65deg)",
                transformOrigin: "top",
                opacity: "0.6",
              }}
            ></div>
          </div>
          
        </div>
        

        <div className="flex flex-col lg:flex-row w-full max-w-6xl md:gap-10 z-10 md:-mt-30 ">
          {/* Left card - Vault info */}
          <div className={`lg:w-2/5 relative -mt-15 ${getLeftComponentBottomMargin()}`}>
            {/* Panel background image */}
            <div 
              className={`relative w-full ${selectedVaultId === '113' ? 'md:h-[1000px] h-[600px]' : 'md:h-[900px] h-[500px]'} rounded-lg`}
              style={getPanelGlowStyles()}
            >
              <Image
                src={
                  selectedVaultId === '113' 
                    ? "/dfusion/bluecard.png" 
                    : selectedVaultId === '114' 
                      ? "/PAI/greencard.png" 
                      : "/panel.png"
                }
                alt="Panel Background"
                fill
                className="object-cover md:object-contain rounded-lg"
              />

              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center p-6">
                
                {/* Mobile-only chatvault icon in top-left */}
                <div className="absolute top-8 left-6 md:hidden z-20">
                  <Image
                    src="/chatvault.png"
                    alt="Chat Vault"
                    width={50}
                    height={50}
                    className="object-contain"
                    priority
                  />
                </div>

                <Image
                  src={
                    selectedVaultId === '113' 
                      ? "/dfusion/mascoty2.png" 
                      : selectedVaultId === '114' 
                        ? "/PAI/greenhead.png" 
                        : "/zoravault.png"
                  }
                  alt="Vault Character"
                  width={selectedVaultId === '113' || selectedVaultId === '114' ? 200 : 250}
                  height={selectedVaultId === '113' || selectedVaultId === '114' ? 200 : 250}
                  className="object-contain max-w-full max-h-full"
                  priority
                  style={{
                    maxWidth: selectedVaultId === '113' || selectedVaultId === '114' ? '200px' : '250px',
                    maxHeight: selectedVaultId === '113' || selectedVaultId === '114' ? '200px' : '250px'
                  }}
                  onError={(e) => {
                    console.error('Image failed to load:', e);
                    console.log('Attempted to load:', 
                      selectedVaultId === '113' 
                        ? "/dfusion/mascoty2.png" 
                        : selectedVaultId === '114' 
                          ? "/PAI/greenhead.png" 
                          : "/zoravault.png"
                    );
                  }}
                />

                <h2 className={`${getVaultTextColor()} text-4xl font-bold mb-2 !tracking-tight`}>
                  {loading ? "LOAD..." : vaultData?.name || "VAULT"}
                </h2>
                <p className="text-white text-2xl mb-4">
                  Complete these steps <br /> to proceed to the vault
                </p>
                
                {/* Conditional price display for vault 113 and 114 */}
                {selectedVaultId === '113' ? (
                  <div className="flex flex-col items-center">
                    <div className={`${getVaultTextColor()} text-5xl md:text-6xl font-bold mb-1`}>
                      {loading
                        ? "$0"
                        : `$${(parseInt(convertAndFormatAptToUsd(vaultData?.total_prize || 0).replace(/,/g, '')) + 500).toLocaleString()}`}
                    </div>
                    <div className="text-yellow-400 text-lg md:text-xl font-medium">
                      {loading
                        ? "Loading..."
                        : `($${convertAndFormatAptToUsd(vaultData?.total_prize || 0)} + $500 nodes)`}
                    </div>
                  </div>
                ) : selectedVaultId === '114' ? (
                  <div className="flex flex-col items-center">
                    <div className={`${getVaultTextColor()} text-5xl md:text-6xl font-bold mb-1`}>
                      {loading
                        ? "$0"
                        : `$${(parseInt(convertAndFormatAptToUsd(vaultData?.total_prize || 0).replace(/,/g, '')) + 700).toLocaleString()}`}
                    </div>
                    <div className="text-green-400 text-lg md:text-xl font-medium">
                      {loading
                        ? "Loading..."
                        : `($${convertAndFormatAptToUsd(vaultData?.total_prize || 0)} + $700 nodes)`}
                    </div>
                  </div>
                ) : (
                  <div className={`${getVaultTextColor()} text-5xl md:text-6xl font-bold mb-1`}>
                    {loading
                      ? "$0"
                      : `$${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center - Simplified section without HUD gif */}
          <div
            className="lg:w-1/3 flex z-0 justify-center items-center mt-0 mb-0 pt-0 pb-0"
            data-mobile-lock="true"
          >
            <div className="relative mobile-lock-inner mt-0 mb-0 pt-0 pb-0">
              <div className="w-[900px] h-[380px] md:h-[700px] relative -translate-y-10 mt-0 mb-0 pt-0 pb-0">
                {/* Conditional content based on vault ID */}
                {selectedVaultId === '113' || selectedVaultId === '114' ? (
                  /* Verification buttons column for vault 113 */
                  <div className="flex flex-col gap-1 justify-center h-full md:mt-13">
                    {/* First column of verification buttons will go here */}
                    {/* Sponsor Twitter Follow Button with Coin Reward - NOW FIRST BUTTON */}
                    <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-1/3 mx-auto ${getButtonMargin()}`}>
                      <div
                        className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                        onClick={handleTwitterAuth}
                      >
                        <Image
                          src={
                            isFollowing
                              ? "/selectedverifybtnbg.png"
                              : "/unselectedverifybtnbg.png"
                          }
                          alt="Button Background"
                          fill
                          style={{ objectFit: "fill" }}
                          className="rounded-md"
                        />
                        <div className="absolute inset-0 flex items-center justify-between">
                          <div className="flex items-center pl-5">
                            <Image
                              src="/xlogo.png"
                              alt="Twitter"
                              width={42}
                              height={42}
                            />
                            <div className="ml-11 flex flex-col">
                              <span className="text-white font-bold text-xl">
                                {loading
                                  ? "Loading..."
                                  : isCheckingFollows
                                  ? "Checking..."
                                  : isFollowing
                                  ? "Verified"
                                  : user
                                  ? "Follow Sponsor"
                                  : "Connect X"}
                              </span>
                              {/* Place coin text under the main button text */}
                              {!isFollowing && !isCheckingFollows && !loading && (
                                <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                              )}
                              {isFollowing && (
                                <span className="text-green-300 text-base">+1 AWARDED</span>
                              )}
                            </div>
                          </div>
                          {/* Green tick image - only show when verified/connected */}
                          {isFollowing && (
                            <div className="pr-6" style={{ paddingRight: "25px" }}>
                              <Image
                                src="/green tick.png"
                                alt="Verified"
                                width={32}
                                height={32}
                              />
                            </div>
                          )}
                        </div>
                        {followError && (
                          <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                            {}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cluster Protocol Twitter Follow Button with Coin Reward - NOW SECOND BUTTON */}
                    {!shouldSkipClusterFollow() && (
                    <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-1/3 mx-auto ${getButtonMargin()}`}>
                      <div
                        className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                        onClick={handleClusterTwitterAuth}
                      >
                    <Image
                          src={
                            isFollowingCluster
                              ? "/selectedverifybtnbg.png"
                              : "/unselectedverifybtnbg.png"
                          }
                          alt="Button Background"
                          fill
                          style={{ objectFit: "fill" }}
                          className="rounded-md"
                        />
                        <div className="absolute inset-0 flex items-center justify-between">
                          <div className="flex items-center pl-5">
                            <Image
                              src="/xlogo.png"
                              alt="Twitter"
                              width={42}
                              height={42}
                            />
                            <div className="ml-11 flex flex-col">
                              <span className="text-white font-bold text-lg">
                                {loading
                                  ? "Loading..."
                                  : isCheckingClusterFollow
                                  ? "Checking..."
                                  : isFollowingCluster
                                  ? "Verified"
                                  : user
                                  ? "Follow @ClusterProtocol"
                                  : "Connect X"}
                              </span>
                              {/* Place coin text under the main button text */}
                              {!isFollowingCluster && !isCheckingClusterFollow && !loading && (
                                <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                              )}
                              {isFollowingCluster && (
                                <span className="text-green-300 text-base">+1 AWARDED</span>
                              )}
                            </div>
                          </div>
                          {/* Green tick image - only show when verified/connected */}
                          {isFollowingCluster && (
                            <div className="pr-6" style={{ paddingRight: "25px" }}>
                              <Image
                                src="/green tick.png"
                                alt="Verified"
                                width={32}
                                height={32}
                              />
                            </div>
                          )}
                        </div>
                        {clusterFollowError && (
                          <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                            {}
                          </div>
                        )}
                      </div>
                    </div>
                    )}



                    {/* Retweet Button with Coin Reward */}
                    <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-1/3 mx-auto ${getButtonMargin()}`}>
                      <div
                        className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full transition-opacity duration-200 ${
                          (isRetweetVerified && hasLikedTweet) || isCheckingRetweet || (pendingMockLike && isMobile)
                            ? "cursor-default"
                            : "cursor-pointer hover:opacity-90"
                        }`}
                        onClick={
                          (isRetweetVerified && hasLikedTweet) || isCheckingRetweet || (pendingMockLike && isMobile)
                            ? undefined 
                            : handleRetweetClick
                        }
                        style={{ 
                          opacity: isCheckingRetweet || (pendingMockLike && isMobile) ? 0.7 : 1 
                        }}
                      >
                        <Image
                          src={
                            isRetweetVerified && hasLikedTweet
                              ? "/selectedverifybtnbg.png"  // Completed state
                              : isRetweetVerified // If retweet is done, or we are checking it, show selected
                              ? "/selectedverifybtnbg.png"  // In progress or retweet verified
                              : "/unselectedverifybtnbg.png"  // Initial state
                          }
                          alt="Button Background"
                          fill
                          style={{ objectFit: "fill" }}
                          className={`rounded-md ${ // Pulse when retweet is verified, like is not, and not checking like
                            isRetweetVerified && !hasLikedTweet && !isCheckingLike && !pendingMockLike 
                              ? 'animate-pulse' 
                              : ''
                          }`}
                        />
                        <div className="absolute inset-0 flex items-center justify-between">
                          <div className="flex items-center pl-5">
                            <Image
                              src="/xlogo.png"
                              alt="Twitter"
                              width={42}
                              height={42}
                            />
                            <div className="ml-11 flex flex-col">
                              <span className="text-white font-bold text-xl">
                                {loading
                                  ? "Loading..."
                                  : isCheckingRetweet
                                  ? "Checking..."
                                  : isCheckingLike 
                                  ? "Liking..."
                                  : pendingMockLike && isMobile
                                  ? "Return after liking"
                                  : isRetweetVerified && hasLikedTweet && showingLiked 
                                  ? "like the tweet"
                                  : isRetweetVerified && hasLikedTweet && isVerifiedAndPersisted
                                  ? "liked"
                                  : isRetweetVerified 
                                  ? "Now Like"
                                  : user
                                  ? "Retweet & Like"
                                  : "Connect first"}
                              </span>
                              {/* Place coin text under the main button text */}
                              {!isRetweetVerified && !isCheckingRetweet && !loading && (
                                <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                              )}
                              
                              {(isRetweetVerified && hasLikedTweet) && (
                                <span className="text-green-300 text-base">+1 AWARDED</span>
                              )}
                              
                            </div>
                          </div>
                          {/* Green tick image - only show when both retweet and like are verified */}
                          {isRetweetVerified && hasLikedTweet && (
                            <div className="pr-6" style={{ paddingRight: "25px" }}>
                              <Image
                                src="/green tick.png"
                                alt="Verified"
                                width={32}
                                height={32}
                              />
                            </div>
                          )}
                        </div>
                        {/* Mobile-specific pending like message */}
                        {pendingMockLike && isMobile && !retweetError && !likeError && (
                          <div className="absolute -bottom-6 left-0 text-blue-400 text-sm truncate max-w-full">
                          </div>
                        )}
                        {/* Add retry button for persistent errors */}
                        {(retweetError || likeError) && !isCheckingRetweet && !isCheckingLike && (
                          <button
                            onClick={handleManualRetry}
                            className="absolute -bottom-12 right-0 text-xs text-blue-400 hover:text-blue-300 underline"
                          >
                            Reset & Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Twitter Tweet Button with Coin Reward */}
                    {vaultData?.tweetContent && (
                      <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-1/3 mx-auto ${getButtonMargin()}`}>
                        <div
                          className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                          onClick={() => {
                            // Open Twitter intent to tweet with prefilled content from vault
                            const tweetText = encodeURIComponent(vaultData.tweetContent);
                            const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}`;
                            window.open(tweetUrl, '_blank');
                          }}
                        >
                          <Image
                            src={
                              isTweetVerified
                                ? "/selectedverifybtnbg.png"
                                : "/unselectedverifybtnbg.png"
                            }
                            alt="Button Background"
                            fill
                            style={{ objectFit: "fill" }}
                            className="rounded-md"
                          />
                          <div className="absolute inset-0 flex items-center justify-between">
                            <div className="flex items-center pl-5">
                              <Image
                                src="/xlogo.png"
                                alt="Twitter"
                                width={42}
                                height={42}
                              />
                              <div className="ml-8 flex flex-col">
                                <span className="text-white font-bold text-xl">
                                  {loading
                                    ? "Loading..."
                                    : isCheckingTweet
                                    ? "Checking..."
                                    : isTweetVerified
                                    ? "Verified"
                                    : user
                                    ? "Tweet Content"
                                    : "Connect first"}
                                </span>
                                {/* Place coin text under the main button text */}
                                {!isTweetVerified && !isCheckingTweet && !loading && (
                                  <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                                )}
                                {isTweetVerified && (
                                  <span className="text-green-300 text-base">+1 AWARDED</span>
                                )}
                              </div>
                            </div>
                            {/* Green tick image - only show when verified/connected */}
                            {isTweetVerified && (
                              <div className="pr-6" style={{ paddingRight: "25px" }}>
                                <Image
                                  src="/green tick.png"
                                  alt="Verified"
                                  width={32}
                                  height={32}
                                />
                              </div>
                            )}
                          </div>
                          {tweetError && (
                            <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                              {}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Default content for other vaults - commented video component area */
                  <>
                    {/* GIF element replacing the lock and cross images */}
                    {/* 
                    <video 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-contain"
                    >
                      <source src="/vault-animation.mp4" type="video/mp4" />
                    </video>
                    */}
                  </>
                )}

                {/* Dynamic vault name and prize for mobile - kept from original */}
                
              </div>
            </div>
          </div>

          {/* Right - verification buttons */}
          <div className={`lg:w-1/3 flex flex-col gap-1 justify-center ml-2 ${getContainerTopMargin()}`}>
            {selectedVaultId === '113' || selectedVaultId === '114' ? (
              /* Second column of verification buttons for vault 113 and 114 */
              <>
                {/* Telegram Button with Coin Reward */}
                <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                  <div
                    className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                      getTelegramUrl() && !telegramProcessing && !telegramCreditsGranted
                        ? "cursor-pointer"
                        : telegramProcessing 
                          ? "cursor-wait" 
                          : telegramCreditsGranted
                            ? "cursor-default"
                            : "cursor-not-allowed opacity-50"
                    }`}
                    onClick={getTelegramUrl() && !telegramProcessing && !telegramCreditsGranted ? handleTelegramJoin : undefined}
                  >
                    <Image
                      src={
                        telegramCreditsGranted
                          ? "/selectedverifybtnbg.png"
                          : "/unselectedverifybtnbg.png"
                      }
                      alt="Button Background"
                      fill
                      style={{ objectFit: "fill" }}
                      className="rounded-md"
                    />
                    <div className="absolute inset-0 flex items-center justify-between">
                      <div className="flex items-center pl-5">
                        <Image
                          src="/telegramlogo.png"
                          alt="Telegram"
                          width={40}
                          height={40}
                        />
                        <div className="ml-11 flex flex-col">
                          <span className="text-white font-bold text-xl">
                            {loading
                              ? "Loading..."
                              : !getTelegramUrl()
                              ? "No Telegram Link Provided"
                              : telegramProcessing
                              ? "Processing..."
                              : telegramCreditsGranted
                              ? "Connected"
                              : "Join Telegram"}
                          </span>
                          {/* Place coin text under the main button text */}
                          {!telegramCoinsGranted && !telegramProcessing && getTelegramUrl() && (
                            <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                          )}
                          {telegramCoinsGranted && (
                            <span className="text-green-300 text-base">+1 AWARDED</span>
                          )}
                        </div>
                      </div>
                      {/* Green tick image - only show when verified/joined */}
                      {telegramCreditsGranted && (
                        <div className="pr-6" style={{ paddingRight: "25px" }}>
                          <Image
                            src="/green tick.png"
                            alt="Verified"
                            width={32}
                            height={32}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discord Button with Coin Reward - Show only if vault has discord_link */}
                {vaultData?.discord_link && (
                  <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                    <div
                      className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                        getDiscordUrl() && !discordProcessing && !discordCreditsGranted
                          ? "cursor-pointer"
                          : discordProcessing 
                            ? "cursor-wait" 
                            : discordCreditsGranted
                              ? "cursor-default"
                              : "cursor-not-allowed opacity-50"
                      }`}
                      onClick={getDiscordUrl() && !discordProcessing && !discordCreditsGranted ? handleDiscordJoin : undefined}
                    >
                      <Image
                        src={
                          discordCreditsGranted
                            ? "/selectedverifybtnbg.png"
                            : "/unselectedverifybtnbg.png"
                        }
                        alt="Button Background"
                        fill
                        style={{ objectFit: "fill" }}
                        className="rounded-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-between">
                        <div className="flex items-center pl-5">
                          <Image
                            src="/discordlogo.png"
                            alt="Discord"
                            width={40}
                            height={40}
                          />
                          <div className="ml-11 flex flex-col">
                            <span className="text-white font-bold text-xl">
                              {loading
                                ? "Loading..."
                                : discordProcessing
                                ? "Processing..."
                                : discordCreditsGranted
                                ? "Connected"
                                : "Join Discord"}
                            </span>
                            {/* Place coin text under the main button text */}
                            {!discordCoinsGranted && !discordProcessing && (
                              <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                            )}
                            {discordCoinsGranted && (
                              <span className="text-green-300 text-base">+1 AWARDED</span>
                            )}
                          </div>
                        </div>
                        {/* Green tick image - only show when verified/joined */}
                        {discordCreditsGranted && (
                          <div className="pr-6" style={{ paddingRight: "25px" }}>
                            <Image
                              src="/green tick.png"
                              alt="Verified"
                              width={32}
                              height={32}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* LinkedIn Button removed for vault 113 and 114 - replaced with second retweet button */}
                {(selectedVaultId === '113' || selectedVaultId === '114') && (
                  <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                    <div
                      className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full transition-opacity duration-200 ${
                        (isSecondRetweetVerified && hasLikedSecondTweet) || isCheckingSecondRetweet || (pendingSecondMockLike && isMobile)
                          ? "cursor-default"
                          : "cursor-pointer hover:opacity-90"
                      }`}
                      onClick={
                        (isSecondRetweetVerified && hasLikedSecondTweet) || isCheckingSecondRetweet || (pendingSecondMockLike && isMobile)
                          ? undefined 
                          : handleSecondRetweetClick
                      }
                      style={{ 
                        opacity: isCheckingSecondRetweet || (pendingSecondMockLike && isMobile) ? 0.7 : 1 
                      }}
                    >
                      <Image
                        src={
                          isSecondRetweetVerified && hasLikedSecondTweet
                            ? "/selectedverifybtnbg.png"  // Completed state
                            : isSecondRetweetVerified // If retweet is done, show selected
                            ? "/selectedverifybtnbg.png"  // In progress or retweet verified
                            : "/unselectedverifybtnbg.png"  // Initial state
                        }
                        alt="Button Background"
                        fill
                        style={{ objectFit: "fill" }}
                        className={`rounded-md ${ // Pulse when retweet is verified, like is not, and not checking like
                          isSecondRetweetVerified && !hasLikedSecondTweet && !isCheckingSecondLike && !pendingSecondMockLike 
                            ? 'animate-pulse' 
                            : ''
                        }`}
                      />
                      <div className="absolute inset-0 flex items-center justify-between">
                        <div className="flex items-center pl-5">
                          <Image
                            src="/xlogo.png"
                            alt="Twitter"
                            width={42}
                            height={42}
                          />
                          <div className="ml-11 flex flex-col">
                            <span className="text-white font-bold text-xl">
                              {loading
                                ? "Loading..."
                                : isCheckingSecondRetweet
                                ? "Checking..."
                                : isCheckingSecondLike 
                                ? "Liking..."
                                : pendingSecondMockLike && isMobile
                                ? "Return after liking"
                                : isSecondRetweetVerified && hasLikedSecondTweet && showingSecondLiked 
                                ? "like the tweet"
                                : isSecondRetweetVerified && hasLikedSecondTweet && isSecondVerifiedAndPersisted
                                ? "liked"
                                : isSecondRetweetVerified 
                                ? "Now Like"
                                : user
                                ? "Retweet & Like"
                                : "Connect first"}
                            </span>
                            {/* Place coin text under the main button text */}
                            {!isSecondRetweetVerified && !isCheckingSecondRetweet && !loading && (
                              <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                            )}
                            {(isSecondRetweetVerified && hasLikedSecondTweet) && (
                              <span className="text-green-300 text-base">+1 AWARDED</span>
                            )}
                          </div>
                        </div>
                        {/* Green tick image - only show when both retweet and like are verified */}
                        {isSecondRetweetVerified && hasLikedSecondTweet && (
                          <div className="pr-6" style={{ paddingRight: "25px" }}>
                            <Image
                              src="/green tick.png"
                              alt="Verified"
                              width={32}
                              height={32}
                            />
                          </div>
                        )}
                      </div>
                      {/* Mobile-specific pending like message */}
                      {pendingSecondMockLike && isMobile && !secondRetweetError && !secondLikeError && (
                        <div className="absolute -bottom-6 left-0 text-blue-400 text-sm truncate max-w-full">
                        </div>
                      )}
                      {/* Show errors */}
                      {(secondRetweetError || secondLikeError) && (
                        <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                          {}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extra Link Button with Coin Reward - Show only if vault has extra_link */}
                {vaultData?.extra_link && (
                  <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                    <div
                      className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                        getExtraLinkUrl() && !extraLinkProcessing && !extraLinkCreditsGranted
                          ? "cursor-pointer"
                          : extraLinkProcessing 
                            ? "cursor-wait" 
                            : extraLinkCreditsGranted
                              ? "cursor-default"
                              : "cursor-not-allowed opacity-50"
                      }`}
                      onClick={getExtraLinkUrl() && !extraLinkProcessing && !extraLinkCreditsGranted ? handleExtraLinkJoin : undefined}
                    >
                      <Image
                        src={
                          extraLinkCreditsGranted
                            ? "/selectedverifybtnbg.png"
                            : "/unselectedverifybtnbg.png"
                        }
                        alt="Button Background"
                        fill
                        style={{ objectFit: "fill" }}
                        className="rounded-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-between">
                        <div className="flex items-center pl-5">
                          <Image
                            src={selectedVaultId === '114' ? "/PAI/subnet.png" : "/dfusion/ball.png"}
                            alt="Extra Link"
                            width={40}
                            height={40}
                          />
                          <div className="ml-11 flex flex-col">
                            <span className="text-white font-bold text-xl">
                              {loading
                                ? "Loading..."
                                : extraLinkProcessing
                                ? "Processing..."
                                : extraLinkCreditsGranted
                                ? "Node Sale"
                                : "SUBNET SLOTS"}
                            </span>
                            {/* Place coin text under the main button text */}
                            {!extraLinkCoinsGranted && !extraLinkProcessing && (
                              <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                            )}
                            {extraLinkCoinsGranted && (
                              <span className="text-green-300 text-base">+1 AWARDED</span>
                            )}
                          </div>
                        </div>
                        {/* Green tick image - only show when verified/joined */}
                        {extraLinkCreditsGranted && (
                          <div className="pr-6" style={{ paddingRight: "25px" }}>
                            <Image
                              src="/green tick.png"
                              alt="Verified"
                              width={32}
                              height={32}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Proceed Button */}
                <div className="flex flex-col items-center mt-3">
                  <AngularButton
                    type="button"
                    href="#"
                    bgColor={getProceedButtonGradient()}
                    buttonWidth="250px"
                    buttonHeight="55px"
                    className={`${
                      canProceedToVault
                        ? "transform hover:scale-105 transition-transform"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    disabled={!canProceedToVault}
                    onClick={canProceedToVault ? handleProceedToVault : undefined}
                  >
                    <span className="text-2xl font-bold">PROCEED TO VAULT</span>
                  </AngularButton>
                </div>
              </>
            ) : (
              /* Default single column layout for all other vaults */
              <>
            {/* Cluster Protocol Twitter Follow Button with Coin Reward - FIRST BUTTON */}
            {!shouldSkipClusterFollow() && (
            <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
              <div
                className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                onClick={handleClusterTwitterAuth}
              >
                <Image
                  src={
                    isFollowingCluster
                      ? "/selectedverifybtnbg.png"
                      : "/unselectedverifybtnbg.png"
                  }
                  alt="Button Background"
                  fill
                  style={{ objectFit: "fill" }}
                  className="rounded-md"
                />
                <div className="absolute inset-0 flex items-center justify-between">
                  <div className="flex items-center pl-5">
                    <Image
                      src="/xlogo.png"
                      alt="Twitter"
                      width={42}
                      height={42}
                    />
                    <div className="ml-11 flex flex-col">
                      <span className="text-white font-bold text-lg">
                        {loading
                          ? "Loading..."
                          : isCheckingClusterFollow
                          ? "Checking..."
                          : isFollowingCluster
                          ? "Verified"
                          : user
                          ? "Follow @ClusterProtocol"
                          : "Connect X"}
                      </span>
                      {/* Place coin text under the main button text */}
                      {!isFollowingCluster && !isCheckingClusterFollow && !loading && (
                        <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                      )}
                      {isFollowingCluster && (
                        <span className="text-green-300 text-base">+1 AWARDED</span>
                      )}
                    </div>
                  </div>
                  {/* Green tick image - only show when verified/connected */}
                  {isFollowingCluster && (
                    <div className="pr-6" style={{ paddingRight: "25px" }}>
                      <Image
                        src="/green tick.png"
                        alt="Verified"
                        width={32}
                        height={32}
                      />
                    </div>
                  )}
                </div>
                {clusterFollowError && (
                  <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                    {}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Sponsor Twitter Follow Button with Coin Reward */}
            <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
              <div
                className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                onClick={handleTwitterAuth}
              >
                <Image
                  src={
                    isFollowing
                      ? "/selectedverifybtnbg.png"
                      : "/unselectedverifybtnbg.png"
                  }
                  alt="Button Background"
                  fill
                  style={{ objectFit: "fill" }}
                  className="rounded-md"
                />
                <div className="absolute inset-0 flex items-center justify-between">
                  <div className="flex items-center pl-5">
                    <Image
                      src="/xlogo.png"
                      alt="Twitter"
                      width={42}
                      height={42}
                    />
                    <div className="ml-11 flex flex-col">
                      <span className="text-white font-bold text-xl">
                        {loading
                          ? "Loading..."
                          : isCheckingFollows
                          ? "Checking..."
                          : isFollowing
                          ? "Verified"
                          : user
                          ? "Follow Sponsor"
                          : "Connect X"}
                      </span>
                      {/* Place coin text under the main button text */}
                      {!isFollowing && !isCheckingFollows && !loading && (
                        <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                      )}
                      {isFollowing && (
                        <span className="text-green-300 text-base">+1 AWARDED</span>
                      )}
                    </div>
                  </div>
                  {/* Green tick image - only show when verified/connected */}
                  {isFollowing && (
                    <div className="pr-6" style={{ paddingRight: "25px" }}>
                      <Image
                        src="/green tick.png"
                        alt="Verified"
                        width={32}
                        height={32}
                      />
                    </div>
                  )}
                </div>
                {followError && (
                  <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                    {}
                  </div>
                )}
              </div>
            </div>

            {/* Retweet Button with Coin Reward */}
            <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
              <div
                className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full transition-opacity duration-200 ${
                  (isRetweetVerified && hasLikedTweet) || isCheckingRetweet || (pendingMockLike && isMobile)
                    ? "cursor-default"
                    : "cursor-pointer hover:opacity-90"
                }`}
                onClick={
                  (isRetweetVerified && hasLikedTweet) || isCheckingRetweet || (pendingMockLike && isMobile)
                    ? undefined 
                    : handleRetweetClick
                }
                style={{ 
                  opacity: isCheckingRetweet || (pendingMockLike && isMobile) ? 0.7 : 1 
                }}
              >
                <Image
                  src={
                    isRetweetVerified && hasLikedTweet
                      ? "/selectedverifybtnbg.png"  // Completed state
                      : isRetweetVerified // If retweet is done, or we are checking it, show selected
                      ? "/selectedverifybtnbg.png"  // In progress or retweet verified
                      : "/unselectedverifybtnbg.png"  // Initial state
                  }
                  alt="Button Background"
                  fill
                  style={{ objectFit: "fill" }}
                  className={`rounded-md ${ // Pulse when retweet is verified, like is not, and not checking like
                    isRetweetVerified && !hasLikedTweet && !isCheckingLike && !pendingMockLike 
                      ? 'animate-pulse' 
                      : ''
                  }`}
                />
                <div className="absolute inset-0 flex items-center justify-between">
                  <div className="flex items-center pl-5">
                    <Image
                      src="/xlogo.png"
                      alt="Twitter"
                      width={42}
                      height={42}
                    />
                    <div className="ml-11 flex flex-col">
                      <span className="text-white font-bold text-xl">
                        {loading
                          ? "Loading..."
                          : isCheckingRetweet
                          ? "Checking..."
                          : isCheckingLike 
                          ? "Liking..."
                          : pendingMockLike && isMobile
                          ? "Return after liking"
                          : isRetweetVerified && hasLikedTweet && showingLiked 
                          ? "like the tweet"
                          : isRetweetVerified && hasLikedTweet && isVerifiedAndPersisted
                          ? "liked"
                          : isRetweetVerified 
                          ? "Now Like"
                          : user
                          ? "Retweet & Like"
                          : "Connect first"}
                      </span>
                      {/* Place coin text under the main button text */}
                      {!isRetweetVerified && !isCheckingRetweet && !loading && (
                        <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                      )}
                      
                      {(isRetweetVerified && hasLikedTweet) && (
                        <span className="text-green-300 text-base">+1 AWARDED</span>
                      )}
                      
                    </div>
                  </div>
                  {/* Green tick image - only show when both retweet and like are verified */}
                  {isRetweetVerified && hasLikedTweet && (
                    <div className="pr-6" style={{ paddingRight: "25px" }}>
                      <Image
                        src="/green tick.png"
                        alt="Verified"
                        width={32}
                        height={32}
                      />
                    </div>
                  )}
                </div>
                {/* Mobile-specific pending like message */}
                {pendingMockLike && isMobile && !retweetError && !likeError && (
                  <div className="absolute -bottom-6 left-0 text-blue-400 text-sm truncate max-w-full">
                  </div>
                )}
                {/* Add retry button for persistent errors */}
                {(retweetError || likeError) && !isCheckingRetweet && !isCheckingLike && (
                  <button
                    onClick={handleManualRetry}
                    className="absolute -bottom-12 right-0 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Reset & Retry
                  </button>
                )}
              </div>
            </div>

            {/* Twitter Tweet Button with Coin Reward */}
            {vaultData?.tweetContent && (
              <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                <div
                  className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full cursor-pointer`}
                  onClick={() => {
                    // Open Twitter intent to tweet with prefilled content from vault
                    const tweetText = encodeURIComponent(vaultData.tweetContent);
                    const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}`;
                    window.open(tweetUrl, '_blank');
                  }}
                >
                  <Image
                    src={
                      isTweetVerified
                        ? "/selectedverifybtnbg.png"
                        : "/unselectedverifybtnbg.png"
                    }
                    alt="Button Background"
                    fill
                    style={{ objectFit: "fill" }}
                    className="rounded-md"
                  />
                  <div className="absolute inset-0 flex items-center justify-between">
                    <div className="flex items-center pl-5">
                      <Image
                        src="/xlogo.png"
                        alt="Twitter"
                        width={42}
                        height={42}
                      />
                      <div className="ml-8 flex flex-col">
                        <span className="text-white font-bold text-xl">
                          {loading
                            ? "Loading..."
                            : isCheckingTweet
                            ? "Checking..."
                            : isTweetVerified
                            ? "Verified"
                            : user
                            ? "Tweet Content"
                            : "Connect first"}
                        </span>
                        {/* Place coin text under the main button text */}
                        {!isTweetVerified && !isCheckingTweet && !loading && (
                          <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                        )}
                        {isTweetVerified && (
                          <span className="text-green-300 text-base">+1 AWARDED</span>
                        )}
                      </div>
                    </div>
                    {/* Green tick image - only show when verified/connected */}
                    {isTweetVerified && (
                      <div className="pr-6" style={{ paddingRight: "25px" }}>
                        <Image
                          src="/green tick.png"
                          alt="Verified"
                          width={32}
                          height={32}
                        />
                      </div>
                    )}
                  </div>
                  {tweetError && (
                    <div className="absolute -bottom-6 left-0 text-red-500 text-sm truncate max-w-full">
                      {}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Telegram Button with Coin Reward */}
            <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
              <div
                className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                  getTelegramUrl() && !telegramProcessing && !telegramCreditsGranted
                    ? "cursor-pointer"
                    : telegramProcessing 
                      ? "cursor-wait" 
                      : telegramCreditsGranted
                        ? "cursor-default"
                        : "cursor-not-allowed opacity-50"
                }`}
                onClick={getTelegramUrl() && !telegramProcessing && !telegramCreditsGranted ? handleTelegramJoin : undefined}
              >
                <Image
                  src={
                    telegramCreditsGranted
                      ? "/selectedverifybtnbg.png"
                      : "/unselectedverifybtnbg.png"
                  }
                  alt="Button Background"
                  fill
                  style={{ objectFit: "fill" }}
                  className="rounded-md"
                />
                <div className="absolute inset-0 flex items-center justify-between">
                  <div className="flex items-center pl-5">
                    <Image
                      src="/telegramlogo.png"
                      alt="Telegram"
                      width={40}
                      height={40}
                    />
                    <div className="ml-11 flex flex-col">
                      <span className="text-white font-bold text-xl">
                        {loading
                          ? "Loading..."
                          : !getTelegramUrl()
                          ? "No Telegram Link Provided"
                          : telegramProcessing
                          ? "Processing..."
                          : telegramCreditsGranted
                          ? "Connected"
                          : "Join Telegram"}
                      </span>
                      {/* Place coin text under the main button text */}
                      {!telegramCoinsGranted && !telegramProcessing && getTelegramUrl() && (
                        <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                      )}
                      {telegramCoinsGranted && (
                        <span className="text-green-300 text-base">+1 AWARDED</span>
                      )}
                    </div>
                  </div>
                  {/* Green tick image - only show when verified/joined */}
                  {telegramCreditsGranted && (
                    <div className="pr-6" style={{ paddingRight: "25px" }}>
                      <Image
                        src="/green tick.png"
                        alt="Verified"
                        width={32}
                        height={32}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discord Button with Coin Reward - Show only if vault has discord_link */}
            {vaultData?.discord_link && (
              <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                <div
                  className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                    getDiscordUrl() && !discordProcessing && !discordCreditsGranted
                      ? "cursor-pointer"
                      : discordProcessing 
                        ? "cursor-wait" 
                        : discordCreditsGranted
                          ? "cursor-default"
                          : "cursor-not-allowed opacity-50"
                  }`}
                  onClick={getDiscordUrl() && !discordProcessing && !discordCreditsGranted ? handleDiscordJoin : undefined}
                >
                  <Image
                    src={
                      discordCreditsGranted
                        ? "/selectedverifybtnbg.png"
                        : "/unselectedverifybtnbg.png"
                    }
                    alt="Button Background"
                    fill
                    style={{ objectFit: "fill" }}
                    className="rounded-md"
                  />
                  <div className="absolute inset-0 flex items-center justify-between">
                    <div className="flex items-center pl-5">
                      <Image
                        src="/discordlogo.png"
                        alt="Discord"
                        width={40}
                        height={40}
                      />
                      <div className="ml-11 flex flex-col">
                        <span className="text-white font-bold text-xl">
                          {loading
                            ? "Loading..."
                            : discordProcessing
                            ? "Processing..."
                            : discordCreditsGranted
                            ? "Connected"
                            : "Join Discord"}
                        </span>
                        {/* Place coin text under the main button text */}
                        {!discordCoinsGranted && !discordProcessing && (
                          <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                        )}
                        {discordCoinsGranted && (
                          <span className="text-green-300 text-base">+1 AWARDED</span>
                        )}
                      </div>
                    </div>
                    {/* Green tick image - only show when verified/joined */}
                    {discordCreditsGranted && (
                      <div className="pr-6" style={{ paddingRight: "25px" }}>
                        <Image
                          src="/green tick.png"
                          alt="Verified"
                          width={32}
                          height={32}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LinkedIn Button removed for vault 113 and 114 - replaced with second retweet button */}

            {/* Extra Link Button with Coin Reward - Show only if vault has extra_link */}
            {vaultData?.extra_link && (
              <div className={`relative ${getSlightlyTallerHeight(getButtonHeight())} ${getButtonWidth()} mx-auto ${getButtonMargin()}`}>
                <div
                  className={`relative ${getSlightlyTallerHeight(getButtonHeight())} w-full ${
                    getExtraLinkUrl() && !extraLinkProcessing && !extraLinkCreditsGranted
                      ? "cursor-pointer"
                      : extraLinkProcessing 
                        ? "cursor-wait" 
                        : extraLinkCreditsGranted
                          ? "cursor-default"
                          : "cursor-not-allowed opacity-50"
                  }`}
                  onClick={getExtraLinkUrl() && !extraLinkProcessing && !extraLinkCreditsGranted ? handleExtraLinkJoin : undefined}
                >
                  <Image
                    src={
                      extraLinkCreditsGranted
                        ? "/selectedverifybtnbg.png"
                        : "/unselectedverifybtnbg.png"
                    }
                    alt="Button Background"
                    fill
                    style={{ objectFit: "fill" }}
                    className="rounded-md"
                  />
                  <div className="absolute inset-0 flex items-center justify-between">
                    <div className="flex items-center pl-5">
                      <Image
                        src="/extralinklogo.png"
                        alt="Extra Link"
                        width={40}
                        height={40}
                      />
                      <div className="ml-11 flex flex-col">
                        <span className="text-white font-bold text-xl">
                          {loading
                            ? "Loading..."
                            : extraLinkProcessing
                            ? "Processing..."
                            : extraLinkCreditsGranted
                            ? "Connected"
                            : "<BUY SUBNET NODES NOW>"}
                        </span>
                        {/* Place coin text under the main button text */}
                        {!extraLinkCoinsGranted && !extraLinkProcessing && (
                          <span className="text-yellow-300 text-base">+1 ATTEMPT</span>
                        )}
                        {extraLinkCoinsGranted && (
                          <span className="text-green-300 text-base">+1 AWARDED</span>
                        )}
                      </div>
                    </div>
                    {/* Green tick image - only show when verified/joined */}
                    {extraLinkCreditsGranted && (
                      <div className="pr-6" style={{ paddingRight: "25px" }}>
                        <Image
                          src="/green tick.png"
                          alt="Verified"
                          width={32}
                          height={32}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Proceed Button */}
            <div className="flex flex-col items-center mt-3">
              {/* Verification status text */}
              
              
              <AngularButton
                type="button"
                href="#"
                bgColor={getProceedButtonGradient()}
                buttonWidth="250px"
                buttonHeight="55px"
                className={`${
                  canProceedToVault
                    ? "transform hover:scale-105 transition-transform"
                    : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!canProceedToVault}
                onClick={canProceedToVault ? handleProceedToVault : undefined}
              >
                <span className="text-2xl font-bold">PROCEED TO VAULT</span>
              </AngularButton>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </BorderFrame>
  );
}
