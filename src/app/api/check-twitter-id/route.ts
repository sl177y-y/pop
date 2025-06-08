import { NextResponse } from "next/server";
import { checkIfTwitterIdExists } from "@/lib/server/db";

export async function POST(request: Request) {
  try {
    console.log('[DEBUG] check-twitter-id API called');
    
    const { twitterId } = await request.json();
    console.log(`[DEBUG] Checking Twitter ID: ${twitterId}`);

    if (!twitterId) {
      console.log('[DEBUG] Missing Twitter ID parameter');
      return NextResponse.json(
        { error: "Twitter ID is required" },
        { status: 400 }
      );
    }

    // Check if Twitter ID exists in database
    const checkResult = await checkIfTwitterIdExists(twitterId);
    
    if (checkResult.exists) {
      console.log(`[DEBUG] Twitter ID ${twitterId} already exists for wallet: ${checkResult.existingWallet}`);
      return NextResponse.json({
        exists: true,
        existingWallet: checkResult.existingWallet,
        message: `This Twitter account is already linked to another wallet: ${checkResult.existingWallet?.substring(0, 6)}...${checkResult.existingWallet?.slice(-4)}`
      }, { status: 409 });
    }

    // If Twitter ID doesn't exist, return success
    return NextResponse.json({
      exists: false,
      message: "Twitter ID is available"
    }, { status: 200 });
  } catch (error) {
    console.error('[DEBUG] Error in check-twitter-id API:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
