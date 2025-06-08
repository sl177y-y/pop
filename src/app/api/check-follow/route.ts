export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
// import { getToken } from "next-auth/jwt"; // Replaced with Supabase
import { createClient } from '@/utils/supabase/server';

// Twitter API v2 endpoint for checking follows
const TWITTER_API_URL = "https://api.twitter.com/2/users";

// We'll fetch the Cluster Protocol Twitter ID dynamically

export async function GET(request: Request) {
    console.log("[DEBUG API] check-follow endpoint called");
    try {
        // Get the user's session from Supabase
        console.log("[DEBUG API] Getting user session from Supabase");
        
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.log("[DEBUG API] No authenticated user found");
            return NextResponse.json(
                { error: "Not authenticated with Twitter" },
                { status: 401 }
            );
        }

        console.log("[DEBUG API] Supabase user found:", user.id);

        // Get Twitter access token from user metadata or identities
        // Note: With Supabase OAuth, the access token might not be directly available
        // This depends on your Supabase provider configuration
        const twitterIdentity = user.identities?.find(identity => identity.provider === 'twitter');
        const accessToken = user.user_metadata?.provider_token || user.user_metadata?.access_token;

        if (!accessToken) {
            console.log("[DEBUG API] No Twitter access token found");
            // For now, return a fallback response since we might not have access tokens
            return NextResponse.json({
                isFollowing: true, // Assume following for better UX
                userId: user.id,
                fallback: true,
                debug: "No access token available - assuming user is following for better UX"
            });
        }

        // Get Twitter user ID from user metadata
        const twitterUserId = user.user_metadata?.provider_id || twitterIdentity?.id;
        
        if (!twitterUserId) {
            console.log("[DEBUG API] No Twitter user ID found");
            return NextResponse.json(
                { error: "Could not determine Twitter user ID" },
                { status: 400 }
            );
        }

        // For now, hardcode the Cluster Protocol Twitter ID
        const clusterProtocolId = "1647049883924807680"; // ClusterProtocol Twitter ID

        console.log("[DEBUG API] Using Cluster Protocol Twitter ID:", clusterProtocolId);
        console.log("[DEBUG API] Twitter User ID:", twitterUserId);

        try {
            // Check if the user follows Cluster Protocol directly
            const followsEndpoint = `${TWITTER_API_URL}/${twitterUserId}/following/${clusterProtocolId}`;

            console.log("[DEBUG API] Checking follow status with endpoint:", followsEndpoint);

            const response = await fetch(followsEndpoint, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            console.log("[DEBUG API] Follow check response status:", response.status);

            // Try to get response text for debugging
            let responseText = "";
            try {
                responseText = await response.text();
                console.log("[DEBUG API] Response text:", responseText);
            } catch (textError) {
                console.log("[DEBUG API] Could not get response text:", textError);
            }

            // Check for the specific OAuth2 permission error
            const isOAuth2Error = response.status === 403 && 
                responseText.includes("You are not permitted to use OAuth2 on this endpoint");

            if (isOAuth2Error) {
                console.log("[DEBUG API] Detected OAuth2 permission error");
                return NextResponse.json({
                    isFollowing: true,
                    userId: twitterUserId,
                    clusterProtocolId,
                    responseStatus: response.status,
                    oauth2Error: true,
                    fallback: true,
                    debug: "OAuth2 permission error. Assuming user is following for better UX.",
                });
            }

            // If response is 200, user is following
            // If response is 404, user is not following
            const isFollowing = response.status === 200;

            console.log("[DEBUG API] Is following Cluster Protocol:", isFollowing);

            const responseJson = {
                isFollowing,
                userId: twitterUserId,
                clusterProtocolId,
                responseStatus: response.status,
                debug: `User ${twitterUserId} ${isFollowing ? "is" : "is not"} following Cluster Protocol (${clusterProtocolId})`,
            };

            return NextResponse.json(responseJson);
        } catch (error: any) {
            console.error("[DEBUG API] Error in direct follow check:", error);
            
            // Fallback response
            return NextResponse.json({
                isFollowing: true, // Assume following for better UX
                userId: twitterUserId,
                clusterProtocolId,
                fallback: true,
                error: `Error checking follow status: ${error.message || "Unknown error"}`,
                debug: `Using fallback due to error: ${error.message || "Unknown error"}`,
            });
        }
    } catch (error: any) {
        console.error("[DEBUG API] Outer catch - Error checking follow status:", error);
        return NextResponse.json(
            { 
                error: "Internal server error",
                debug: error.message || "Unknown error"
            },
            { status: 500 }
        );
    }
}
