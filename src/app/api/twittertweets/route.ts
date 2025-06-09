import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Interface for tweet data
interface TweetDetails {
  id: string;
  text: string;
  created_at: string;
}

// Interface for response data
interface ResponseData {
  success: boolean;
  tweets?: TweetDetails[];
  hasMatchingTweet?: boolean;
  matchingTweet?: TweetDetails;
  error?: string;
}

/**
 * Make HTTP request to RapidAPI
 */
async function makeRequest(options: any): Promise<any> {
  const requestId = `http_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`[HTTP_REQUEST][${requestId}] Starting HTTP request:`, {
    method: options.method,
    hostname: options.hostname,
    path: options.path,
    hasApiKey: !!options.headers['x-rapidapi-key'],
    apiKeyLength: options.headers['x-rapidapi-key']?.length || 0
  });

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`[HTTP_REQUEST][${requestId}] Response received:`, {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers
      });

      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
        console.log(`[HTTP_REQUEST][${requestId}] Data chunk received, total length: ${data.length}`);
      });
      
      res.on('end', () => {
        console.log(`[HTTP_REQUEST][${requestId}] Response complete:`, {
          statusCode: res.statusCode,
          dataLength: data.length,
          contentType: res.headers['content-type']
        });

        try {
          const parsedData = JSON.parse(data);
          console.log(`[HTTP_REQUEST][${requestId}] JSON parsed successfully:`, {
            hasData: !!parsedData,
            topLevelKeys: Object.keys(parsedData || {}),
            dataStructure: {
              hasData: !!parsedData?.data,
              hasUser: !!parsedData?.data?.user,
              hasResult: !!parsedData?.data?.user?.result
            }
          });
          
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          console.error(`[HTTP_REQUEST][${requestId}] JSON parse error:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            dataPreview: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
            dataLength: data.length
          });
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[HTTP_REQUEST][${requestId}] Request error:`, {
        message: error.message,
        code: (error as any).code,
        errno: (error as any).errno
      });
      reject(error);
    });

    req.on('timeout', () => {
      console.error(`[HTTP_REQUEST][${requestId}] Request timeout`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    console.log(`[HTTP_REQUEST][${requestId}] Sending request...`);
    req.end();
  });
}

/**
 * Extract tweets from the API response
 */
function extractTweets(responseData: any): TweetDetails[] {
  const tweets: TweetDetails[] = [];
  
  console.log('[TWEET_EXTRACT] Starting tweet extraction...');
  console.log('[TWEET_EXTRACT] Response data structure check:', {
    hasData: !!responseData?.data,
    hasUser: !!responseData?.data?.user,
    hasResult: !!responseData?.data?.user?.result,
    hasTimeline: !!responseData?.data?.user?.result?.timeline,
    hasTimelineTimeline: !!responseData?.data?.user?.result?.timeline?.timeline,
    hasInstructions: !!responseData?.data?.user?.result?.timeline?.timeline?.instructions
  });
  
  try {
    // Navigate through the nested structure to get to the tweets
    if (responseData?.data?.user?.result?.timeline?.timeline?.instructions) {
      const instructions = responseData.data.user.result.timeline.timeline.instructions;
      console.log('[TWEET_EXTRACT] Found instructions array with length:', instructions.length);
      
      // Find the TimelineAddEntries instruction
      const addEntriesInstruction = instructions.find((inst: any) => inst.type === 'TimelineAddEntries');
      console.log('[TWEET_EXTRACT] TimelineAddEntries instruction found:', !!addEntriesInstruction);
      
      if (addEntriesInstruction && addEntriesInstruction.entries) {
        console.log('[TWEET_EXTRACT] Found entries array with length:', addEntriesInstruction.entries.length);
        
        // Limit processing to first 20 entries to improve performance
        const entriesToProcess = addEntriesInstruction.entries.slice(0, 20);
        console.log(`[TWEET_EXTRACT] Processing first ${entriesToProcess.length} entries (limited from ${addEntriesInstruction.entries.length})`);
        
        entriesToProcess.forEach((entry: any, index: number) => {
          console.log(`[TWEET_EXTRACT] Processing entry ${index + 1}/${entriesToProcess.length}`);
          
          if (
            entry.content?.entryType === 'TimelineTimelineItem' &&
            entry.content?.itemContent?.itemType === 'TimelineTweet'
          ) {
            const tweetResult = entry.content.itemContent.tweet_results?.result;
            
            if (tweetResult && tweetResult.__typename === 'Tweet') {
              const legacy = tweetResult.legacy;
              
              if (legacy) {
                // Extract the main tweet
                const tweet = {
                  id: legacy.id_str,
                  text: legacy.full_text,
                  created_at: legacy.created_at
                };
                
                console.log(`[TWEET_EXTRACT] Extracted tweet ${tweets.length + 1}:`, {
                  id: tweet.id,
                  textLength: tweet.text?.length || 0,
                  textPreview: tweet.text?.substring(0, 100) + '...',
                  created_at: tweet.created_at,
                  isRetweet: tweet.text?.startsWith('RT @') || false,
                  hasRetweetedStatus: !!tweetResult.retweeted_status_result,
                  isQuoteStatus: legacy.is_quote_status || false
                });
                
                tweets.push(tweet);
                
                // If this is a retweet with retweeted_status_result, also extract the original tweet
                if (tweetResult.retweeted_status_result) {
                  const retweetedStatus = tweetResult.retweeted_status_result.result;
                  if (retweetedStatus && retweetedStatus.legacy && retweetedStatus.__typename === 'Tweet') {
                    const originalTweet = {
                      id: retweetedStatus.legacy.id_str,
                      text: retweetedStatus.legacy.full_text,
                      created_at: retweetedStatus.legacy.created_at
                    };
                    
                    console.log(`[TWEET_EXTRACT] Extracted original retweeted content ${tweets.length + 1}:`, {
                      id: originalTweet.id,
                      textLength: originalTweet.text?.length || 0,
                      textPreview: originalTweet.text?.substring(0, 100) + '...',
                      created_at: originalTweet.created_at,
                      isOriginalOfRetweet: true
                    });
                    
                    tweets.push(originalTweet);
                  }
                }
              } else {
                console.log(`[TWEET_EXTRACT] Entry ${index} missing legacy data`);
              }
            } else {
              console.log(`[TWEET_EXTRACT] Entry ${index} not a Tweet type:`, tweetResult?.__typename);
            }
          } else {
            console.log(`[TWEET_EXTRACT] Entry ${index} not a timeline tweet:`, {
              entryType: entry.content?.entryType,
              itemType: entry.content?.itemContent?.itemType
            });
          }
        });
      } else {
        console.log('[TWEET_EXTRACT] No entries found in TimelineAddEntries instruction');
      }
    } else {
      console.log('[TWEET_EXTRACT] Response data structure invalid - missing required nested properties');
    }
  } catch (error) {
    console.error('[TWEET_EXTRACT] Error extracting tweets:', error);
  }
  
  console.log(`[TWEET_EXTRACT] Extraction complete. Total tweets extracted: ${tweets.length}`);
  return tweets;
}

/**
 * Get tweets from a user by user ID
 */
async function getUserTweets(userId: string): Promise<TweetDetails[]> {
  console.log(`[GET_USER_TWEETS] Starting to fetch tweets for user ID: ${userId}`);
  
  try {
    // Try multiple endpoints to get comprehensive tweet data
    const endpoints = [
      `/user/tweets?user_id=${userId}&limit=20`, // Regular tweets (primary) - limited to 20
      `/user/tweetsandreplies?user_id=${userId}&limit=20` // Includes retweets and replies - limited to 20
    ];
    
    let allTweets: TweetDetails[] = [];
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      console.log(`[GET_USER_TWEETS] Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);
      
      const options = {
        method: 'GET',
        hostname: 'twitter-x.p.rapidapi.com',
        port: null,
        path: endpoint,
        headers: {
          'x-rapidapi-key': process.env.RAPID_API_KEY || '',
          'x-rapidapi-host': 'twitter-x.p.rapidapi.com'
        }
      };

      console.log(`[GET_USER_TWEETS] Making request with options:`, {
        method: options.method,
        hostname: options.hostname,
        path: options.path,
        hasApiKey: !!process.env.RAPID_API_KEY,
        apiKeyLength: process.env.RAPID_API_KEY?.length || 0
      });

      try {
        const response = await makeRequest(options);
        
        console.log(`[GET_USER_TWEETS] API response received for endpoint ${i + 1}:`, {
          status: response.status,
          hasData: !!response.data,
          dataType: typeof response.data
        });
        
        if (response.status !== 200) {
          console.error(`[GET_USER_TWEETS] Endpoint ${i + 1} returned non-200 status:`, {
            status: response.status,
            data: response.data
          });
          continue;
        }
        
        if (!response.data) {
          console.error(`[GET_USER_TWEETS] Endpoint ${i + 1} returned no data`);
          continue;
        }

        console.log(`[GET_USER_TWEETS] Raw API response structure for endpoint ${i + 1}:`, {
          hasData: !!response.data?.data,
          hasUser: !!response.data?.data?.user,
          hasResult: !!response.data?.data?.user?.result,
          hasTimeline: !!response.data?.data?.user?.result?.timeline,
          responseKeys: Object.keys(response.data || {}),
          dataKeys: Object.keys(response.data?.data || {})
        });

        const extractedTweets = extractTweets(response.data);
        console.log(`[GET_USER_TWEETS] Extraction completed for endpoint ${i + 1}. Extracted ${extractedTweets.length} tweets`);
        
        // Add tweets to the collection, avoiding duplicates
        extractedTweets.forEach(tweet => {
          const isDuplicate = allTweets.some(existingTweet => existingTweet.id === tweet.id);
          if (!isDuplicate) {
            allTweets.push(tweet);
          } else {
            console.log(`[GET_USER_TWEETS] Skipping duplicate tweet ID: ${tweet.id}`);
          }
        });
        
        console.log(`[GET_USER_TWEETS] Total unique tweets after endpoint ${i + 1}: ${allTweets.length}`);
      } catch (error) {
        console.error(`[GET_USER_TWEETS] Error with endpoint ${i + 1}:`, error);
        continue;
      }
    }
    
    console.log(`[GET_USER_TWEETS] All endpoints processed. Final tweet count: ${allTweets.length}`);
    return allTweets;
  } catch (error) {
    console.error('[GET_USER_TWEETS] Error in getUserTweets:', error);
    console.error('[GET_USER_TWEETS] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return [];
  }
}

/**
 * Check if content exists in a tweet
 */
function checkTweetContent(tweets: TweetDetails[], contentToCheck: string): { 
  hasMatch: boolean; 
  matchingTweet?: TweetDetails 
} {
  console.log(`[CONTENT_CHECK] Starting content check...`);
  console.log(`[CONTENT_CHECK] Content to check: "${contentToCheck}"`);
  console.log(`[CONTENT_CHECK] Content length: ${contentToCheck.length}`);
  console.log(`[CONTENT_CHECK] Number of tweets to check: ${tweets.length}`);
  
  // Normalize content for comparison
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/&amp;/g, '&')  // Convert HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  };
  
  // Remove URLs from content for comparison (since Twitter converts them to t.co links)
  const removeUrls = (text: string): string => {
    return text
      .replace(/https?:\/\/[^\s]+/g, '')  // Remove http/https URLs
      .replace(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')  // Remove domain names like candymachine.fun
      .replace(/\s+/g, ' ')  // Clean up extra spaces
      .trim();
  };
  
  // Remove RT prefix for better retweet matching
  const removeRetweetPrefix = (text: string): string => {
    return text.replace(/^RT\s+@\w+:\s*/i, '').trim();
  };
  
  const normalizedContent = normalizeText(contentToCheck);
  const contentWithoutUrls = removeUrls(normalizedContent);
  const contentWithoutRt = removeRetweetPrefix(contentWithoutUrls);
  
  console.log(`[CONTENT_CHECK] Normalized content: "${normalizedContent}"`);
  console.log(`[CONTENT_CHECK] Content without URLs: "${contentWithoutUrls}"`);
  console.log(`[CONTENT_CHECK] Content without RT prefix: "${contentWithoutRt}"`);
  
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    const normalizedTweet = normalizeText(tweet.text);
    const tweetWithoutUrls = removeUrls(normalizedTweet);
    const tweetWithoutRt = removeRetweetPrefix(tweetWithoutUrls);
    
    console.log(`[CONTENT_CHECK] Checking tweet ${i + 1}/${tweets.length}:`);
    console.log(`[CONTENT_CHECK] Tweet ID: ${tweet.id}`);
    console.log(`[CONTENT_CHECK] Original tweet: "${tweet.text}"`);
    console.log(`[CONTENT_CHECK] Normalized tweet: "${normalizedTweet}"`);
    console.log(`[CONTENT_CHECK] Tweet without URLs: "${tweetWithoutUrls}"`);
    console.log(`[CONTENT_CHECK] Tweet without RT prefix: "${tweetWithoutRt}"`);
    
    // Try multiple matching strategies
    const exactMatch = normalizedTweet.includes(normalizedContent);
    const urlFreeMatch = tweetWithoutUrls.includes(contentWithoutUrls);
    const rtFreeMatch = tweetWithoutRt.includes(contentWithoutRt);
    
    // For retweets, also check if the content matches when RT prefix is removed from both
    const isRetweet = tweet.text.toLowerCase().startsWith('rt @');
    const retweetContentMatch = isRetweet && (
      tweetWithoutRt.includes(contentWithoutUrls) || 
      contentWithoutRt.includes(tweetWithoutRt)
    );
    
    // Calculate similarity for partial matching
    const contentWords = contentWithoutRt.split(' ').filter(word => word.length > 2);
    const tweetWords = tweetWithoutRt.split(' ').filter(word => word.length > 2);
    const matchingWords = contentWords.filter(word => tweetWithoutRt.includes(word));
    
    // Stricter check: all content words must be present in the tweet
    const allWordsMatch = contentWords.length > 0 && contentWords.every(word => tweetWithoutRt.includes(word));
    const similarityScore = contentWords.length > 0 ? matchingWords.length / contentWords.length : 0;
    
    console.log(`[CONTENT_CHECK] Match analysis for tweet ${i + 1}:`);
    console.log(`[CONTENT_CHECK]   Exact match: ${exactMatch}`);
    console.log(`[CONTENT_CHECK]   URL-free match: ${urlFreeMatch}`);
    console.log(`[CONTENT_CHECK]   RT-free match: ${rtFreeMatch}`);
    console.log(`[CONTENT_CHECK]   Retweet content match: ${retweetContentMatch}`);
    console.log(`[CONTENT_CHECK]   All words match (stricter): ${allWordsMatch}`);
    console.log(`[CONTENT_CHECK]   Is retweet: ${isRetweet}`);
    console.log(`[CONTENT_CHECK]   Similarity score: ${similarityScore.toFixed(2)} (${matchingWords.length}/${contentWords.length} words)`);
    console.log(`[CONTENT_CHECK]   Matching words: [${matchingWords.join(', ')}]`);
    
    // Consider it a match if:
    // 1. Exact match, OR
    // 2. URL-free content matches, OR  
    // 3. RT-free content matches, OR
    // 4. Retweet content matches (for RT tweets), OR
    // 5. All significant words from the content are present in the tweet (stricter check)
    const isMatch = exactMatch || urlFreeMatch || rtFreeMatch || retweetContentMatch || allWordsMatch;
    
    console.log(`[CONTENT_CHECK] Final match result for tweet ${i + 1}: ${isMatch}`);
    
    if (isMatch) {
      console.log(`[CONTENT_CHECK] ✅ MATCH FOUND! Tweet ${i + 1} contains the required content`);
      console.log(`[CONTENT_CHECK] Match type: ${exactMatch ? 'exact' : urlFreeMatch ? 'url-free' : rtFreeMatch ? 'rt-free' : retweetContentMatch ? 'retweet-content' : 'all-words'}`);
      console.log(`[CONTENT_CHECK] Matching tweet details:`, {
        id: tweet.id,
        created_at: tweet.created_at,
        textLength: tweet.text.length,
        isRetweet: isRetweet
      });
      
      return {
        hasMatch: true,
        matchingTweet: tweet
      };
    } else {
      console.log(`[CONTENT_CHECK] ❌ No match in tweet ${i + 1}`);
      
      // Show detailed comparison for debugging
      if (similarityScore > 0.5) {
        console.log(`[CONTENT_CHECK] Close match detected (${(similarityScore * 100).toFixed(1)}% similarity)`);
        console.log(`[CONTENT_CHECK] Missing words: [${contentWords.filter(word => !tweetWithoutRt.includes(word)).join(', ')}]`);
      }
    }
  }
  
  console.log(`[CONTENT_CHECK] ❌ No matching tweet found after checking all ${tweets.length} tweets`);
  return { hasMatch: false };
}

/**
 * API endpoint to check if a user has tweeted specific content
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[TWITTER_TWEETS_API][${requestId}] === NEW REQUEST STARTED ===`);
  
  try {
    console.log(`[TWITTER_TWEETS_API][${requestId}] twittertweets API called`);
    
    // Check if API key is configured
    if (!process.env.RAPID_API_KEY) {
      console.error(`[TWITTER_TWEETS_API][${requestId}] RAPID_API_KEY not configured in environment variables`);
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, content, walletAddress } = body;

    console.log(`[TWITTER_TWEETS_API][${requestId}] Request parameters:`, {
      userId: userId,
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 50) + (content?.length > 50 ? '...' : ''),
      hasWalletAddress: !!walletAddress,
      walletPreview: walletAddress?.substring(0, 10) + '...'
    });

    if (!userId || !content) {
      console.log(`[TWITTER_TWEETS_API][${requestId}] Missing required parameters:`, {
        hasUserId: !!userId,
        hasContent: !!content
      });
      return NextResponse.json(
        { success: false, error: 'Missing userId or content to check' },
        { status: 400 }
      );
    }

    // Get user tweets
    console.log(`[TWITTER_TWEETS_API][${requestId}] Getting tweets for user ID: ${userId}`);
    const tweets = await getUserTweets(userId);
    
    console.log(`[TWITTER_TWEETS_API][${requestId}] Tweet retrieval completed:`, {
      tweetsFound: tweets.length,
      tweetIds: tweets.map(t => t.id),
      tweetPreviews: tweets.map(t => ({
        id: t.id,
        textPreview: t.text.substring(0, 50) + '...',
        created_at: t.created_at
      }))
    });
    
    // Log all fetched tweets with complete content
    console.log(`[TWITTER_TWEETS_API][${requestId}] === ALL FETCHED TWEETS (${tweets.length} total) ===`);
    tweets.forEach((tweet, index) => {
      console.log(`[TWITTER_TWEETS_API][${requestId}] Tweet ${index + 1}/${tweets.length}:`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   ID: ${tweet.id}`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   Created: ${tweet.created_at}`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   Text Length: ${tweet.text.length} characters`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   Full Text: "${tweet.text}"`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   Text (lowercase): "${tweet.text.toLowerCase()}"`);
      console.log(`[TWITTER_TWEETS_API][${requestId}]   ---`);
    });
    console.log(`[TWITTER_TWEETS_API][${requestId}] === END OF ALL FETCHED TWEETS ===`);
    
    if (tweets.length === 0) {
      console.log(`[TWITTER_TWEETS_API][${requestId}] No tweets found for user ID: ${userId}`);
      return NextResponse.json({
        success: true,
        tweets: [],
        hasMatchingTweet: false
      });
    }

    console.log(`[TWITTER_TWEETS_API][${requestId}] Found ${tweets.length} tweets for user ID: ${userId}`);

    // Check if any tweet contains the specified content
    console.log(`[TWITTER_TWEETS_API][${requestId}] Starting content matching process...`);
    const { hasMatch, matchingTweet } = checkTweetContent(tweets, content);
    
    console.log(`[TWITTER_TWEETS_API][${requestId}] Content matching completed:`, {
      hasMatch: hasMatch,
      matchingTweetId: matchingTweet?.id || null,
      matchingTweetPreview: matchingTweet?.text.substring(0, 100) + '...' || null
    });

    // If Twitter ID already exists with another wallet, check first
    if (walletAddress && hasMatch) {
      console.log(`[TWITTER_TWEETS_API][${requestId}] Checking if Twitter ID ${userId} already exists with another wallet`);
      const { checkIfTwitterIdExists } = await import('@/lib/server/db');
      const twitterIdCheck = await checkIfTwitterIdExists(userId);
      
      console.log(`[TWITTER_TWEETS_API][${requestId}] Twitter ID check result:`, {
        exists: twitterIdCheck.exists,
        existingWallet: twitterIdCheck.existingWallet,
        currentWallet: walletAddress,
        isConflict: twitterIdCheck.exists && twitterIdCheck.existingWallet !== walletAddress
      });
      
      // If Twitter ID already exists with another wallet, return an error
      if (twitterIdCheck.exists && twitterIdCheck.existingWallet !== walletAddress) {
        console.log(`[TWITTER_TWEETS_API][${requestId}] Twitter ID ${userId} already exists with wallet: ${twitterIdCheck.existingWallet}`);
        return NextResponse.json({
          success: false,
          error: `This Twitter account is already linked to another wallet.`
        }, { status: 409 });
      }

      // If matches and wallet info provided, you could update user data here
      // Similar to how updateVerifiedFollows works in rapidfollowingcheck
    }

    // Return the result
    const responseData: ResponseData = {
      success: true,
      hasMatchingTweet: hasMatch,
      tweets: tweets.slice(0, 5), // Only return the first few tweets to keep response size reasonable
    };
    
    if (hasMatch && matchingTweet) {
      responseData.matchingTweet = matchingTweet;
    }

    console.log(`[TWITTER_TWEETS_API][${requestId}] Final response:`, {
      success: responseData.success,
      hasMatchingTweet: responseData.hasMatchingTweet,
      tweetsReturned: responseData.tweets?.length || 0,
      hasMatchingTweetData: !!responseData.matchingTweet
    });
    
    console.log(`[TWITTER_TWEETS_API][${requestId}] === REQUEST COMPLETED SUCCESSFULLY ===`);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error(`[TWITTER_TWEETS_API][${requestId}] Error in twittertweets API:`, error);
    console.error(`[TWITTER_TWEETS_API][${requestId}] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.log(`[TWITTER_TWEETS_API][${requestId}] === REQUEST COMPLETED WITH ERROR ===`);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
