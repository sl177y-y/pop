import { useState, useEffect } from 'react';
// import { useSession } from 'next-auth/react'; // Replaced with Supabase
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

interface TwitterFollowStatus {
  isFollowing: boolean;
  isLoading: boolean;
  error: string | null;
  checkFollowStatus: () => Promise<boolean>;
}

export function useTwitterFollow(): TwitterFollowStatus {
  // const { data: session, status } = useSession(); // Replaced with Supabase
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();

  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase: Get user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const checkFollowStatus = async (): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated with Twitter');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/twitter-follows');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check follow status');
      }

      const data = await response.json();
      setIsFollowing(data.isFollowing);
      return data.isFollowing;
    } catch (err: any) {
      setError(err.message || 'An error occurred while checking follow status');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically check follow status when user is available
  useEffect(() => {
    if (user && !authLoading) {
      checkFollowStatus();
    }
  }, [user, authLoading]);

  return {
    isFollowing,
    isLoading,
    error,
    checkFollowStatus
  };
} 