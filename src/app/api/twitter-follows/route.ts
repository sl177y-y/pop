import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt"; // Replaced with Supabase
import { createClient } from '@/utils/supabase/server';

// Twitter API v2 endpoint for getting user's following list
const TWITTER_API_URL = "https://api.twitter.com/2/users";

export async function GET(request: Request) {
  try {
    // Get the user's session from Supabase
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Not authenticated with Twitter" },
        { status: 401 }
      );
    }

    // Get Twitter access token from user metadata or identities
    const twitterIdentity = user.identities?.find(identity => identity.provider === 'twitter');
    const accessToken = user.user_metadata?.provider_token || user.user_metadata?.access_token;

    if (!accessToken) {
      // Return fallback response assuming user is following
      return NextResponse.json({
        isFollowing: true,
        followingCount: 0,
        followingIds: [],
        fallback: true,
        debug: "No access token available - assuming user is following for better UX"
      });
    }

    // Get Twitter user ID from user metadata
    const twitterUserId = user.user_metadata?.provider_id || twitterIdentity?.id;

    if (!twitterUserId) {
      return NextResponse.json(
        { error: "Could not determine Twitter user ID" },
        { status: 400 }
      );
    }

    // The Cluster Protocol Twitter ID
    const clusterProtocolId = "1647049883924807680";

    // Get the list of accounts the user follows
    const followingEndpoint = `${TWITTER_API_URL}/${twitterUserId}/following?max_results=1000`;

    const response = await fetch(followingEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Return fallback response for better UX
      return NextResponse.json({
        isFollowing: true,
        followingCount: 0,
        followingIds: [],
        fallback: true,
        error: "Error fetching follows",
        details: errorText,
        status: response.status
      });
    }

    const followingData = await response.json();
    
    // Check if user is following Cluster Protocol
    const isFollowingCluster = followingData.data?.some(
      (user: any) => user.id === clusterProtocolId
    );

    return NextResponse.json({
      isFollowing: isFollowingCluster,
      followingCount: followingData.data?.length || 0,
      followingIds: followingData.data?.map((user: any) => user.id) || [],
    });
  } catch (error: any) {
    // Return fallback response for better UX
    return NextResponse.json({
      isFollowing: true,
      followingCount: 0,
      followingIds: [],
      fallback: true,
      error: error.message || "An error occurred"
    });
  }
} 