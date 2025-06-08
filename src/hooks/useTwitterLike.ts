// [ ]
import { useState, useEffect, useCallback, useRef } from 'react';
// import { useSession } from 'next-auth/react'; // Replaced with Supabase
import { createClient } from '@/utils/supabase/client'; // Supabase client
import { User } from '@supabase/supabase-js'; // Import User type
import { verificationDB, VerificationState } from '@/lib/verificationDB';

interface TwitterLikeStatus {
  hasLikedTweet: boolean;
  isLoading: boolean;
  error: string | null;
  errorType: string | null;
  retryAfter: number | null;
  checkLikeStatus: (tweetId: string) => Promise<boolean>;
  mockLikeAction: (tweetId: string) => Promise<boolean>;
  clearError: () => void;
  lastChecked: Date | null;
  // New mobile-specific properties
  pendingMockLike: string | null;
  setPendingMockLike: (tweetId: string | null) => void;
  // New properties for the improved mock behavior
  showingLiked: boolean;
  isVerifiedAndPersisted: boolean;
}

export function useTwitterLike(): TwitterLikeStatus {
  // const { data: session, status } = useSession(); // Replaced with Supabase
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [hasLikedTweet, setHasLikedTweet] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  // New state for mobile focus detection
  const [pendingMockLike, setPendingMockLike] = useState<string | null>(null);

  // New state for improved mock behavior
  const [showingLiked, setShowingLiked] = useState<boolean>(false);
  const [isVerifiedAndPersisted, setIsVerifiedAndPersisted] = useState<boolean>(false);

  // Supabase: Get user session
  useEffect(() => {
    const getUserSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setUser(currentSession?.user ?? null);
      setAuthLoading(false);
    };
    getUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setUser(currentSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  // Mobile focus detection for delayed mock like
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && pendingMockLike) {
        console.log('[MOBILE_LIKE] User returned to app, executing pending mock like for tweet:', pendingMockLike);
        // User returned to app, execute pending mock like with a small delay
        setTimeout(async () => {
          try {
            const result = await mockLikeAction(pendingMockLike);
            if (result) {
              console.log('[MOBILE_LIKE] Delayed mock like successful');
              setPendingMockLike(null);
            } else {
              console.error('[MOBILE_LIKE] Delayed mock like failed');
            }
          } catch (error) {
            console.error('[MOBILE_LIKE] Error during delayed mock like:', error);
          }
        }, 500); // Small delay to ensure app is fully focused
      }
    };

    // Add event listeners for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus events as additional detection
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [pendingMockLike]);

  // Clear pending mock like if user manually completes the like
  useEffect(() => {
    if (hasLikedTweet && pendingMockLike) {
      console.log('[MOBILE_LIKE] Like completed, clearing pending mock like');
      setPendingMockLike(null);
    }
  }, [hasLikedTweet, pendingMockLike]);

  // Check for persisted verification state on mount using IndexedDB
  useEffect(() => {
    const checkPersistedState = async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (selectedVaultId) {
        const vaultId = parseInt(selectedVaultId);
        try {
          // Initialize or get existing state from IndexedDB
          const state = await verificationDB.initializeVaultState(vaultId);
          
          if (state.like) {
            setHasLikedTweet(true);
            setIsVerifiedAndPersisted(true);
            console.log('[LIKE_PERSISTENCE] Restored verified like state from IndexedDB for vault:', vaultId);
          }
        } catch (error) {
          console.error('[LIKE_PERSISTENCE] Error checking IndexedDB state:', error);
        }
      }
    };
    
    checkPersistedState();
  }, []);

  const clearError = () => {
    setError(null);
    setErrorType(null);
    setRetryAfter(null);
  };

  const mockLikeAction = useCallback(async (tweetId: string): Promise<boolean> => {
    // If already verified and persisted, don't run again
    if (isVerifiedAndPersisted) {
      console.log('[MOCK_LIKE] Action already verified and persisted, skipping');
      return true;
    }

    console.log(`[MOCK_LIKE] Starting mock like action for tweet: ${tweetId}`);
    
    try {
      setIsLoading(true);
      setError(null);
      setErrorType(null);
      
      // Clear any existing retry timer
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      
      // Step 1: Show "liked" immediately
      setShowingLiked(true);
      console.log('[MOCK_LIKE] Showing "liked" text...');
      
      // Simulate API call delay
      await new Promise(resolve => {
        console.log(`[MOCK_LIKE] Simulating like action with 1 second delay...`);
        setTimeout(resolve, 1000);
      });
      
      // Step 2: Update to liked state
      setHasLikedTweet(true);
      setLastChecked(new Date());
      
      // Store verification state in IndexedDB to prevent re-checking
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (selectedVaultId) {
        const vaultId = parseInt(selectedVaultId);
        await verificationDB.setVerificationState(vaultId, { like: true });
        console.log('[MOCK_LIKE] Stored verification state in IndexedDB for vault:', vaultId);
      }
      
      console.log('[MOCK_LIKE] Mock like action completed successfully for tweet:', tweetId);
      
      // Step 3: After 2 seconds, transition from "liked" to "likes"
      setTimeout(() => {
        setShowingLiked(false);
        setIsVerifiedAndPersisted(true);
        console.log('[MOCK_LIKE] Transitioned from "liked" to "likes" after 2 seconds');
      }, 2000);
      
      return true;
      
    } catch (err) {
      console.error(`[MOCK_LIKE] Error during mock like action:`, err);
      setError('Failed to like tweet. Please try again.');
      setErrorType('api_error');
      setShowingLiked(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isVerifiedAndPersisted]);

  const checkLikeStatus = async (tweetId: string): Promise<boolean> => {
    // if (status !== 'authenticated') { // Old NextAuth check
    if (authLoading) {
      // Still waiting for auth status
      setError('Checking authentication status...');
      setErrorType('auth_pending');
      return false;
    }
    if (!user) { // Supabase check
      setError('Not authenticated with Twitter');
      setErrorType('auth_required');
      return false;
    }

    if (!tweetId) {
      setError('Tweet ID is required');
      setErrorType('validation_error');
      return false;
    }

    // Check IndexedDB first to avoid unnecessary API calls
    const selectedVaultId = localStorage.getItem('selectedVaultId');
    if (selectedVaultId) {
      try {
        const vaultId = parseInt(selectedVaultId);
        const state = await verificationDB.getVerificationState(vaultId);
        if (state?.like) {
          console.log('[LIKE_CHECK] Skipping API call - already verified in IndexedDB');
          setHasLikedTweet(true);
          setIsVerifiedAndPersisted(true);
          return true;
        }
      } catch (error) {
        console.error('[LIKE_CHECK] Error checking IndexedDB state:', error);
      }
    }

    setIsLoading(true);
    clearError();

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/twitter-likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        // Handle specific error types from the API
        setError(data.message || data.error || 'Failed to check like status');
        setErrorType(data.errorType || 'unknown_error');
        
        if (data.retryAfter) {
          setRetryAfter(data.retryAfter);
        }
        
        return false;
      }

      const likeStatus = data.hasLikedTweet;
      setHasLikedTweet(likeStatus);
      setLastChecked(new Date());
      
      // Update IndexedDB if verified
      if (likeStatus && selectedVaultId) {
        try {
          const vaultId = parseInt(selectedVaultId);
          await verificationDB.setVerificationState(vaultId, { like: true });
          setIsVerifiedAndPersisted(true);
        } catch (error) {
          console.error('[LIKE_CHECK] Error updating IndexedDB state:', error);
        }
      }
      
      return likeStatus;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out - please try again');
        setErrorType('timeout_error');
      } else {
        setError(err.message || 'Network error occurred while checking like status');
        setErrorType('network_error');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    hasLikedTweet,
    isLoading,
    error,
    errorType,
    retryAfter,
    checkLikeStatus,
    mockLikeAction,
    clearError,
    lastChecked,
    // New mobile-specific exports
    pendingMockLike,
    setPendingMockLike,
    // New properties for the improved mock behavior
    showingLiked,
    isVerifiedAndPersisted
  };
}
