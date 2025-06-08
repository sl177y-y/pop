import { NextResponse } from "next/server";
import { createOrUpdateUser, getUserByWallet } from "@/lib/server/db";

export async function POST(request: Request) {
  try {
    console.log('[DEBUG] save-twitter API called');
    
    const { walletAddress, username } = await request.json();
    console.log(`[DEBUG] Saving Twitter for wallet: ${walletAddress}, username: ${username}`);

    if (!walletAddress || !username) {
      console.log('[DEBUG] Missing required parameters');
      return NextResponse.json(
        { error: "Wallet address and Twitter username are required" },
        { status: 400 }
      );
    }

    // Get user data from database
    console.log(`[DEBUG] Fetching user data for wallet: ${walletAddress}`);
    const user = await getUserByWallet(walletAddress);
    
    if (!user) {
      console.log(`[DEBUG] User not found with wallet: ${walletAddress}`);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prepare new Twitter data object
    let twitterData = {
      username,
      verified_follows: []
    };

    console.log('[DEBUG] Twitter data to save:', JSON.stringify(twitterData));

    // Update user with Twitter data
    const updatedUser = await createOrUpdateUser({
      wallet_address: walletAddress,
      credits: user.credits,
      twitter: twitterData
    });

    if (!updatedUser) {
      console.log('[DEBUG] Failed to update user');
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
    
    // Check if the response contains an error message (Twitter ID already exists)
    if ('error' in updatedUser) {
      console.log(`[DEBUG] Twitter error: ${updatedUser.error}`);
      return NextResponse.json(
        { error: updatedUser.error },
        { status: 409 }
      );
    }

    console.log('[DEBUG] Successfully updated user with twitter data');
    console.log('[DEBUG] Updated user twitter data:', JSON.stringify(updatedUser.twitter));

    return NextResponse.json({ 
      success: true,
      message: "Twitter username saved successfully",
      username
    });
  } catch (error: any) {
    console.error("[DEBUG] Error saving Twitter username:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
}