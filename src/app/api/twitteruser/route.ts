import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Interface for Twitter user details
interface TwitterUserDetails {
  id: string;
  rest_id: string;
  name: string;
  username: string;
  followers_count: number;
  following_count: number;
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
 * Get Twitter user details by username
 */
async function getUserDetails(username: string): Promise<TwitterUserDetails | null> {
  try {
    const options = {
      method: 'GET',
      hostname: 'twitter-x.p.rapidapi.com',
      port: null,
      path: `/user/details?username=${encodeURIComponent(username)}`,
      headers: {
        'x-rapidapi-key': process.env.RAPID_API_KEY || '',
        'x-rapidapi-host': 'twitter-x.p.rapidapi.com'
      }
    };

    const response = await makeRequest(options);
    
    if (response.status !== 200 || !response.data) {
      console.error('Error fetching user details:', response);
      return null;
    }

    // Handle the nested structure from the API response
    if (response.data.data?.user?.result) {
      const userData = response.data.data.user.result;
      
      return {
        id: userData.id || '',
        rest_id: userData.rest_id || '',
        name: userData.legacy?.name || '',
        username: userData.legacy?.screen_name || '',
        followers_count: userData.legacy?.followers_count || 0,
        following_count: userData.legacy?.friends_count || 0
      };
    }

    console.error('Unexpected user details response structure:', response.data);
    return null;
  } catch (error) {
    console.error('Error in getUserDetails:', error);
    return null;
  }
}

/**
 * API endpoint to get Twitter user details
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[DEBUG] twitteruser API called');
    
    // Check if API key is configured
    if (!process.env.RAPID_API_KEY) {
      console.error('[DEBUG] RAPID_API_KEY not configured in environment variables');
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { username } = body;

    console.log(`[DEBUG] Received request for username: ${username}`);

    if (!username) {
      console.log('[DEBUG] Missing required parameters');
      return NextResponse.json(
        { success: false, error: 'Missing username' },
        { status: 400 }
      );
    }

    // Get user details
    console.log(`[DEBUG] Getting user details for ${username}`);
    const userDetails = await getUserDetails(username);
    if (!userDetails) {
      console.log('[DEBUG] Failed to fetch user details');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user details' },
        { status: 404 }
      );
    }

    console.log(`[DEBUG] User details retrieved for ${username}: id=${userDetails.rest_id}`);

    // Return the user details
    return NextResponse.json({
      success: true,
      userDetails
    });
  } catch (error) {
    console.error('[DEBUG] Error in twitteruser API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 