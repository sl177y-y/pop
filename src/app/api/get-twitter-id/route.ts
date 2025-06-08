export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt"; // Replaced with Supabase
import { createClient } from '@/utils/supabase/server';

// Twitter API v2 endpoint for user lookup
const TWITTER_API_URL = "https://api.twitter.com/2/users/by/username/ClusterProtocol";

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
      // Return hardcoded ClusterProtocol ID as fallback
      return NextResponse.json({ 
        id: "1647049883924807680", // ClusterProtocol Twitter ID
        username: "ClusterProtocol",
        fallback: true
      });
    }

    // Fetch the Twitter ID for ClusterProtocol
    const response = await fetch(TWITTER_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Twitter API error:", await response.text());
      // Return hardcoded ClusterProtocol ID as fallback
      return NextResponse.json({ 
        id: "1647049883924807680", // ClusterProtocol Twitter ID
        username: "ClusterProtocol",
        fallback: true
      });
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      id: data.data?.id,
      username: data.data?.username 
    });
  } catch (error: any) {
    console.error("Error fetching Twitter ID:", error);
    // Return hardcoded ClusterProtocol ID as fallback
    return NextResponse.json({ 
      id: "1647049883924807680", // ClusterProtocol Twitter ID
      username: "ClusterProtocol",
      fallback: true,
      error: error.message || "An error occurred"
    });
  }
}
