import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import { getUserByWallet, createOrUpdateUser } from '@/lib/server/db';

// Interface for Twitter user details
interface TwitterUserDetails {
  id: string;
  rest_id: string;
  name: string;
  username: string;
  followers_count: number;
  following_count: number;
}

// Interface for response data
interface ResponseData {
  success: boolean;
  isFollowing?: boolean;
  creditsGranted?: boolean;
  error?: string;
  message?: string;
}

/**
 * Helper function to make HTTP requests to RapidAPI
 */
async function makeRequest(options: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks);
        try {
          const data = JSON.parse(body.toString());
          resolve({ status: res.statusCode, data });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Parse following entries from the API response
 */
function parseFollowingEntries(responseData: any): any[] {
  const followingList: any[] = [];
  try {
    if (responseData?.data?.user?.result?.timeline?.timeline?.instructions) {
      const instructions = responseData.data.user.result.timeline.timeline.instructions;
      const addEntriesInstruction = instructions.find((inst: any) => inst.type === 'TimelineAddEntries');
      if (addEntriesInstruction && addEntriesInstruction.entries) {
        addEntriesInstruction.entries.forEach((entry: any) => {
          if (entry.content?.itemContent?.itemType === 'TimelineUser') {
            const userResult = entry.content.itemContent.user_results?.result;
            if (userResult) {
              followingList.push({
                id: userResult.id,
                rest_id: userResult.rest_id
              });
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Error parsing following list:', err);
  }
  return followingList;
}

/**
 * Extract cursor for pagination from API response
 */
function extractCursor(responseData: any): string | null {
  try {
    if (responseData?.data?.user?.result?.timeline?.timeline?.instructions) {
      const instructions = responseData.data.user.result.timeline.timeline.instructions;
      const addEntriesInstruction = instructions.find((inst: any) => inst.type === 'TimelineAddEntries');
      if (addEntriesInstruction && addEntriesInstruction.entries) {
        // Look for cursor entry at the end
        const cursorEntry = addEntriesInstruction.entries.find((entry: any) => 
          entry.content?.entryType === 'TimelineTimelineCursor' && 
          entry.content?.cursorType === 'Bottom'
        );
        if (cursorEntry && cursorEntry.content?.value) {
          return cursorEntry.content.value;
        }
      }
    }
  } catch (err) {
    console.error('Error extracting cursor:', err);
  }
  return null;
}

/**
 * Check if user is following a target account (by Twitter IDs only) with pagination
 */
async function checkFollowing(userId: string, targetUserId: string): Promise<boolean> {
  console.log(`[DEBUG] Checking if user ${userId} follows ${targetUserId} with pagination`);
  
  let cursor: string | null = null;
  let pageCount = 0;
  const maxPages = 20; // Limit to prevent infinite loops (20 * 100 = 2000 follows max)
  let totalChecked = 0;

  try {
    while (pageCount < maxPages) {
      pageCount++;
      console.log(`[DEBUG] Fetching page ${pageCount} for user ${userId}${cursor ? ` with cursor: ${cursor.substring(0, 20)}...` : ''}`);

      // Build the path with cursor if available
      let path = `/user/following?user_id=${userId}&limit=100`;
      if (cursor) {
        path += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const options = {
        method: 'GET',
        hostname: 'twitter-x.p.rapidapi.com',
        port: null,
        path: path,
        headers: {
          'x-rapidapi-key': process.env.RAPID_API_KEY || '',
          'x-rapidapi-host': 'twitter-x.p.rapidapi.com'
        }
      };

      const response = await makeRequest(options);
      if (response.status !== 200 || !response.data) {
        console.error(`Error fetching following list (page ${pageCount}):`, response);
        break;
      }

      // Parse the following entries from this page
      const followingList = parseFollowingEntries(response.data);
      totalChecked += followingList.length;
      
      console.log(`[DEBUG] Page ${pageCount}: Found ${followingList.length} following accounts (total checked: ${totalChecked})`);

      // Check if target user is in this page
      const isFollowing = followingList.some((user: any) =>
        user.rest_id === targetUserId || user.id === targetUserId
      );

      if (isFollowing) {
        console.log(`[DEBUG] Found target user ${targetUserId} on page ${pageCount}! User ${userId} is following.`);
        return true;
      }

      // Get cursor for next page
      const nextCursor = extractCursor(response.data);
      
      // If no more pages or cursor is the same as previous, break
      if (!nextCursor || nextCursor === cursor || followingList.length === 0) {
        console.log(`[DEBUG] No more pages available. Total accounts checked: ${totalChecked}`);
        break;
      }

      cursor = nextCursor;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (pageCount >= maxPages) {
      console.log(`[DEBUG] Reached maximum pages (${maxPages}). Total accounts checked: ${totalChecked}`);
    }

    console.log(`[DEBUG] User ${userId} does not follow ${targetUserId} (checked ${totalChecked} accounts across ${pageCount} pages)`);
    return false;

  } catch (error) {
    console.error('Error in checkFollowing:', error);
    return false;
  }
}

/**
 * Extract Twitter username from URL
 */
function extractTwitterUsername(url: string): string | null {
  try {
    const twitterRegex = /twitter\.com\/([^\/\?]+)|x\.com\/([^\/\?]+)/;
    const match = url.match(twitterRegex);
    
    if (match) {
      return match[1] || match[2]; // Return the captured username group
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting Twitter username:', error);
    return null;
  }
}

/**
 * Add a verified follow to user's data
 */
async function updateVerifiedFollows(twitterUsername: string, targetUsername: string, walletAddress?: string): Promise<boolean> {
  try {
    if (!walletAddress) {
      console.log('[DEBUG] No wallet address provided for updating verified follows');
      return false;
    }

    // First check if this Twitter ID is already used by another wallet
    console.log(`[DEBUG] Checking if Twitter ID ${twitterUsername} already exists with another wallet`);
    const { checkIfTwitterIdExists } = await import('@/lib/server/db');
    const twitterIdCheck = await checkIfTwitterIdExists(twitterUsername);
    
    // If Twitter ID already exists with another wallet, return false
    if (twitterIdCheck.exists && twitterIdCheck.existingWallet !== walletAddress) {
      //console.log(`[DEBUG] Twitter ID ${twitterUsername} already exists with wallet: ${twitterIdCheck.existingWallet}`);
      return false;
    }

    // Get current user data
   // console.log(`[DEBUG] Fetching user data to update verified follows for wallet: ${walletAddress}`);
    const user = await getUserByWallet(walletAddress);
    if (!user) {
     // console.log(`[DEBUG] User with wallet ${walletAddress} not found for updating verified follows`);
      return false;
    }

    // Debug logging the twitter data
    //console.log(`[DEBUG] Raw Twitter data from DB (for update):`, JSON.stringify(user.twitter));
    //console.log(`[DEBUG] Twitter data type (for update):`, typeof user.twitter);
    
    // Initialize twitter data
    let twitterData = {
      username: twitterUsername,
      verified_follows: [] as string[]
    };

    // Handle existing twitter data that might be stored as a string
    if (user.twitter) {
      let existingTwitter = user.twitter;
      if (typeof user.twitter === 'string') {
        try {
          console.log('[DEBUG] Attempting to parse existing Twitter data from string');
          existingTwitter = JSON.parse(user.twitter);
          console.log('[DEBUG] Successfully parsed existing Twitter data:', JSON.stringify(existingTwitter));
        } catch (parseError) {
          console.error('[DEBUG] Error parsing existing Twitter data:', parseError);
          // Continue with empty data if we can't parse
        }
      }
      
      if (typeof existingTwitter === 'object') {
        if ('username' in existingTwitter) {
          twitterData.username = existingTwitter.username;
        }
        
        if ('verified_follows' in existingTwitter && Array.isArray(existingTwitter.verified_follows)) {
          twitterData.verified_follows = [...existingTwitter.verified_follows];
        }
      }
    }

    console.log(`[DEBUG] Current verified follows before update:`, JSON.stringify(twitterData.verified_follows));

    // Only add if not already in the array (case insensitive check)
    const alreadyExists = twitterData.verified_follows.some(
      follow => follow.toLowerCase() === targetUsername.toLowerCase()
    );
    
    if (!alreadyExists) {
      twitterData.verified_follows.push(targetUsername);
      console.log(`[DEBUG] Adding ${targetUsername} to verified follows for ${walletAddress}`);
    } else {
      console.log(`[DEBUG] ${targetUsername} already in verified follows for ${walletAddress}`);
    }

    console.log(`[DEBUG] New twitter data to save:`, JSON.stringify(twitterData));

    // Update user with new Twitter data
    const updatedUser = await createOrUpdateUser({
      wallet_address: walletAddress,
      credits: user.credits,
      twitter: twitterData
    });

    console.log(`[DEBUG] Update result:`, !!updatedUser);
    return !!updatedUser;
  } catch (error) {
    console.error('[DEBUG] Error updating verified follows:', error);
    return false;
  }
}

/**
 * API endpoint to check if a user follows a target account
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[DEBUG] rapidfollowingcheck API called');
    if (!process.env.RAPID_API_KEY) {
      console.error('[DEBUG] RAPID_API_KEY not configured in environment variables');
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    // Now expect twitterUserId and sponsorTwitterId directly
    const { twitterUserId, sponsorTwitterId, walletAddress } = body;
    console.log(`[DEBUG] Received request for userId: ${twitterUserId}, targetId: ${sponsorTwitterId}, wallet: ${walletAddress?.substring(0, 10)}...`);

    if (!twitterUserId || !sponsorTwitterId) {
      console.log('[DEBUG] Missing required parameters');
      return NextResponse.json(
        { success: false, error: 'Missing twitterUserId or sponsorTwitterId' },
        { status: 400 }
      );
    }

    // First check if this Twitter ID is already used by another wallet
    console.log(`[DEBUG] Checking if Twitter ID ${twitterUserId} already exists with another wallet`);
    const { checkIfTwitterIdExists } = await import('@/lib/server/db');
    const twitterIdCheck = await checkIfTwitterIdExists(twitterUserId);
    
    // If Twitter ID already exists with another wallet, return an error
    if (twitterIdCheck.exists && twitterIdCheck.existingWallet !== walletAddress) {
     // console.log(`[DEBUG] Twitter ID ${twitterUserId} already exists with wallet: ${twitterIdCheck.existingWallet}`);
      return NextResponse.json({
        success: false,
        error: `This Twitter account is already linked to another wallet: }`
      }, { status: 409 });
    }
    
    // If the Twitter ID check passes, proceed with follow check
    const isFollowing = await checkFollowing(twitterUserId, sponsorTwitterId);
    let creditsGranted = false;
    if (isFollowing && walletAddress) {
      const updateResult = await updateVerifiedFollows(twitterUserId, sponsorTwitterId, walletAddress);
      if (!updateResult) {
        // If updating the verified follows failed, it could be due to a duplicate Twitter ID
        return NextResponse.json({
          success: false,
          error: "Failed to update Twitter verification. This Twitter account may already be linked to another wallet."
        }, { status: 409 });
      }
      
      // Award free credits if eligible
      const vaultId = body.vaultId || null;
      if (vaultId) {
        try {
          console.log(`[rapidfollowingcheck] Attempting to award free credits for vault ${vaultId}, wallet ${walletAddress}`);
          
          // Use the atomic function for reliable credit awarding
          const { atomicAwardFreeCredits } = await import("@/lib/server/db");
          const result = await atomicAwardFreeCredits(Number(vaultId), walletAddress);
          
          console.log(`[rapidfollowingcheck] Atomic award result:`, result);
          
          if (result.success) {
            creditsGranted = true;
            console.log(`[rapidfollowingcheck] Successfully awarded ${result.creditsAwarded} credits to ${walletAddress}`);
          } else {
            creditsGranted = false;
            if (result.alreadyAwarded) {
              console.log(`[rapidfollowingcheck] Credits already awarded to ${walletAddress} for vault ${vaultId}`);
            } else {
              console.warn(`[rapidfollowingcheck] Failed to award credits: ${result.message}`);
            }
          }
        } catch (creditError) {
          console.error(`[rapidfollowingcheck] Error in credit awarding process:`, creditError);
          creditsGranted = false;
        }
      }
    }
    const responseData: ResponseData = {
      success: true,
      isFollowing,
      creditsGranted,
      message: isFollowing
        ? `User is following${creditsGranted ? ' and was granted credits.' : '.'}`
        : `User is not following`
    };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[DEBUG] Error in rapidfollowingcheck API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}