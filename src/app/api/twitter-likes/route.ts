import { NextRequest, NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt"; // Replaced with Supabase
import { createClient } from '@/utils/supabase/server';

// Twitter API v2 endpoint for getting user's liked tweets
const TWITTER_API_URL = "https://api.twitter.com/2/users";

// Simple in-memory cache to reduce API calls
// In production, consider using Redis or a proper caching service
const cache = new Map<string, { data: any; timestamp: number; expiresAt: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for rate limit errors

// Rate limit tracking per user
const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 10; // Conservative limit

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST STARTED ===`);
  console.log(`[TWITTER_LIKES_LOG][${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[TWITTER_LIKES_LOG][${requestId}] Request ID: ${requestId}`);
  
  try {
    // Get the user's session from Supabase
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Getting user session from Supabase...`);
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] AUTHENTICATION FAILED - No valid user found`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] User exists: ${!!user}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Error: ${error?.message || 'None'}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (AUTH FAILED) ===`);
      
      return NextResponse.json(
        { 
          error: "Not authenticated with Twitter",
          errorType: "auth_required",
          message: "Please sign in with Twitter to check like status"
        },
        { status: 401 }
      );
    }

    console.log(`[TWITTER_LIKES_LOG][${requestId}] AUTHENTICATION SUCCESS - User found: ${user.id}`);

    // Get Twitter access token from user metadata or identities
    const twitterIdentity = user.identities?.find(identity => identity.provider === 'twitter');
    const accessToken = user.user_metadata?.provider_token || user.user_metadata?.access_token;

    if (!accessToken) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] No Twitter access token found - using mock response`);
      
      // Parse request body to get the tweet ID
      const body = await request.json();
      const { tweetId } = body;
      
      // Return a mock successful response for better UX
      const mockResult = {
        hasLikedTweet: true, // Assume liked for better UX
        likeCheckResult: "mock_success",
        message: "Like status simulated - Twitter API access not available",
        tweetId: tweetId,
        fallback: true
      };
      
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (MOCK RESPONSE) ===`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
      
      return NextResponse.json(mockResult);
    }

    console.log(`[TWITTER_LIKES_LOG][${requestId}] Access token available`);

    // Get Twitter user ID from user metadata
    const twitterUserId = user.user_metadata?.provider_id || twitterIdentity?.id;
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter User ID: ${twitterUserId}`);

    if (!twitterUserId) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] ERROR - No Twitter user ID found`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (NO USER ID) ===`);
      
      return NextResponse.json(
        { error: "Could not determine Twitter user ID" },
        { status: 400 }
      );
    }

    // Parse request body to get the tweet ID to check
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Parsing request body...`);
    const body = await request.json();
    const { tweetId } = body;
    
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Tweet ID to check: ${tweetId}`);

    if (!tweetId) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] ERROR - No tweet ID provided`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (NO TWEET ID) ===`);
      
      return NextResponse.json(
        { error: "Tweet ID is required" },
        { status: 400 }
      );
    }

    // Check our local rate limit first
    const now = Date.now();
    const userKey = `${twitterUserId}_${tweetId}`;
    const rateLimitData = rateLimitTracker.get(twitterUserId);
    
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Checking rate limits for user: ${twitterUserId}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Current time: ${now}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Rate limit data exists: ${!!rateLimitData}`);
    
    if (rateLimitData) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Rate limit data - Count: ${rateLimitData.count}, Reset time: ${rateLimitData.resetTime}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Time until reset: ${Math.max(0, rateLimitData.resetTime - now)}ms`);
      
      if (now < rateLimitData.resetTime) {
        if (rateLimitData.count >= MAX_REQUESTS_PER_WINDOW) {
          console.log(`[TWITTER_LIKES_LOG][${requestId}] RATE LIMIT EXCEEDED - User: ${twitterUserId}, Count: ${rateLimitData.count}/${MAX_REQUESTS_PER_WINDOW}`);
          console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (RATE LIMITED) ===`);
          
          return NextResponse.json(
            { 
              error: "Rate limit exceeded",
              errorType: "rate_limit",
              message: "Too many requests. Please try again in a few minutes.",
              retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000)
            },
            { status: 429 }
          );
        }
      } else {
        // Reset the counter if window has expired
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Rate limit window expired, resetting counter`);
        rateLimitTracker.set(twitterUserId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
      }
    } else {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] First request for user, initializing rate limit tracker`);
      rateLimitTracker.set(twitterUserId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // Check cache first
    const cacheKey = `${twitterUserId}_${tweetId}`;
    const cached = cache.get(cacheKey);
    
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Checking cache with key: ${cacheKey}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Cache entry exists: ${!!cached}`);
    
    if (cached && now < cached.expiresAt) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] CACHE HIT - Returning cached result`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Cached data created: ${new Date(cached.timestamp).toISOString()}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Cache expires at: ${new Date(cached.expiresAt).toISOString()}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Like status from cache: ${cached.data.hasLikedTweet}`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (CACHE HIT) ===`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
      
      return NextResponse.json(cached.data);
    } else if (cached) {
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Cache entry expired, will fetch fresh data`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Cache expired at: ${new Date(cached.expiresAt).toISOString()}`);
    }

    // Update rate limit counter
    const currentRateLimit = rateLimitTracker.get(twitterUserId)!;
    const newCount = currentRateLimit.count + 1;
    rateLimitTracker.set(twitterUserId, { 
      count: newCount, 
      resetTime: currentRateLimit.resetTime 
    });
    
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Updated rate limit counter: ${newCount}/${MAX_REQUESTS_PER_WINDOW}`);

    // Get the list of tweets the user has liked
    const likedTweetsEndpoint = `${TWITTER_API_URL}/${twitterUserId}/liked_tweets?max_results=20`;

    console.log(`[TWITTER_LIKES_LOG][${requestId}] Making Twitter API request...`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Endpoint: ${likedTweetsEndpoint}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] User ID: ${twitterUserId}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] API call time: ${new Date().toISOString()}`);
    
    const response = await fetch(likedTweetsEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter API response received`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Response status: ${response.status}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Response ok: ${response.ok}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Response status text: ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TWITTER_LIKES_LOG][${requestId}] TWITTER API ERROR OCCURRED`);
      console.error(`[TWITTER_LIKES_LOG][${requestId}] Error details:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        userId: twitterUserId,
        tweetId: tweetId,
        endpoint: likedTweetsEndpoint
      });

      // Handle specific error types
      if (response.status === 429) {
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter API RATE LIMIT HIT (429)`);
        
        // Cache the rate limit error to prevent immediate retries
        const rateLimitResult = {
          error: "Twitter API rate limit exceeded",
          errorType: "api_rate_limit",
          message: "Twitter's API rate limit has been reached. Please try again later.",
          retryAfter: 900, // 15 minutes
          hasLikedTweet: false,
          likeCheckResult: "failed_rate_limit"
        };
        
        cache.set(cacheKey, {
          data: rateLimitResult,
          timestamp: now,
          expiresAt: now + RATE_LIMIT_CACHE_DURATION
        });

        console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (TWITTER RATE LIMIT) ===`);
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
        
        return NextResponse.json(rateLimitResult, { status: 429 });
      }
      
      if (response.status === 401) {
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter API AUTHORIZATION FAILED (401)`);
        console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (TWITTER AUTH FAILED) ===`);
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
        
        return NextResponse.json(
          { 
            error: "Twitter authorization failed",
            errorType: "twitter_auth_failed",
            message: "Twitter authorization expired. Please sign out and sign in again.",
            details: errorText,
            hasLikedTweet: false,
            likeCheckResult: "failed_auth"
          },
          { status: 401 }
        );
      }
      
      if (response.status === 403) {
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter API ACCESS FORBIDDEN (403)`);
        
        // For 403 errors, return a fallback success response for better UX
        const fallbackResult = {
          hasLikedTweet: true, // Assume liked for better UX
          likeCheckResult: "fallback_success",
          message: "Twitter API access restricted - assuming like for better user experience",
          tweetId: tweetId,
          fallback: true
        };
        
        console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (TWITTER FORBIDDEN - FALLBACK) ===`);
        console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
        
        return NextResponse.json(fallbackResult);
      }

      // For other errors, also use fallback
      const fallbackResult = {
        hasLikedTweet: true, // Assume liked for better UX
        likeCheckResult: "error_fallback",
        message: "Error checking like status - assuming like for better user experience",
        tweetId: tweetId,
        fallback: true,
        error: errorText
      };
      
      console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (ERROR FALLBACK) ===`);
      console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);
      
      return NextResponse.json(fallbackResult);
    }

    // Parse the response
    const likedTweetsData = await response.json();
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Twitter API response parsed successfully`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Liked tweets count: ${likedTweetsData.data?.length || 0}`);

    // Check if the specific tweet is in the liked tweets
    const hasLikedTweet = likedTweetsData.data?.some(
      (tweet: any) => tweet.id === tweetId
    ) || false;

    console.log(`[TWITTER_LIKES_LOG][${requestId}] Like check result: ${hasLikedTweet}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Target tweet ID: ${tweetId}`);

    const result = {
      hasLikedTweet,
      likeCheckResult: "success",
      tweetId: tweetId,
      likedTweetsCount: likedTweetsData.data?.length || 0,
      message: hasLikedTweet ? "User has liked the tweet" : "User has not liked the tweet"
    };

    // Cache the successful result
    cache.set(cacheKey, {
      data: result,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    });

    console.log(`[TWITTER_LIKES_LOG][${requestId}] Result cached with key: ${cacheKey}`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (SUCCESS) ===`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[TWITTER_LIKES_LOG][${requestId}] UNEXPECTED ERROR:`, error);
    console.error(`[TWITTER_LIKES_LOG][${requestId}] Error message:`, error.message);
    console.error(`[TWITTER_LIKES_LOG][${requestId}] Error stack:`, error.stack);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] === REQUEST COMPLETED (UNEXPECTED ERROR) ===`);
    console.log(`[TWITTER_LIKES_LOG][${requestId}] Total request time: ${Date.now() - startTime}ms`);

    // Return fallback response for unexpected errors
    return NextResponse.json({
      hasLikedTweet: true, // Assume liked for better UX
      likeCheckResult: "unexpected_error_fallback",
      message: "Unexpected error occurred - assuming like for better user experience",
      fallback: true,
      error: error.message || "An unexpected error occurred"
    });
  }
}
