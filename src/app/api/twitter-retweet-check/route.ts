import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

interface RetweetCheckResponse {
  success: boolean;
  hasRetweet: boolean;
  matchingRetweet?: any;
  error?: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\u2019']/g, "'").trim().toLowerCase();
}

// Remove URLs from text for better comparison
function removeUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/g, '')  // Remove http/https URLs
    .replace(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')  // Remove domain names
    .replace(/\s+/g, ' ')  // Clean up extra spaces
    .trim();
}

function extractRetweets(responseData: any, contentToCheck: string): any | null {
  const requestId = `extract_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`[RETWEET_EXTRACT][${requestId}] Starting retweet extraction...`);
  console.log(`[RETWEET_EXTRACT][${requestId}] Content to check: "${contentToCheck}"`);
  
  const normalizedContent = normalizeText(contentToCheck);
  const contentWithoutUrls = removeUrls(normalizedContent);
  
  console.log(`[RETWEET_EXTRACT][${requestId}] Normalized content: "${normalizedContent}"`);
  console.log(`[RETWEET_EXTRACT][${requestId}] Content without URLs: "${contentWithoutUrls}"`);
  
  try {
    if (responseData?.data?.user?.result?.timeline?.timeline?.instructions) {
      const instructions = responseData.data.user.result.timeline.timeline.instructions;
      console.log(`[RETWEET_EXTRACT][${requestId}] Found ${instructions.length} instructions`);
      
      const addEntriesInstruction = instructions.find((inst: any) => inst.type === 'TimelineAddEntries');
      if (addEntriesInstruction && addEntriesInstruction.entries) {
        console.log(`[RETWEET_EXTRACT][${requestId}] Found ${addEntriesInstruction.entries.length} entries`);
        
        // Limit processing to first 20 entries to improve performance
        const entriesToProcess = Math.min(addEntriesInstruction.entries.length, 20);
        console.log(`[RETWEET_EXTRACT][${requestId}] Processing first ${entriesToProcess} entries (limited from ${addEntriesInstruction.entries.length})`);
        
        for (let i = 0; i < entriesToProcess; i++) {
          const entry = addEntriesInstruction.entries[i];
          console.log(`[RETWEET_EXTRACT][${requestId}] Processing entry ${i + 1}/${entriesToProcess}`);
          
          if (
            entry.content?.entryType === 'TimelineTimelineItem' &&
            entry.content?.itemContent?.itemType === 'TimelineTweet'
          ) {
            const tweetResult = entry.content.itemContent.tweet_results?.result;
            if (tweetResult && tweetResult.__typename === 'Tweet') {
              const legacy = tweetResult.legacy;
              
              console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ${i + 1} analysis:`, {
                id: legacy?.id_str,
                full_text_length: legacy?.full_text?.length || 0,
                full_text_preview: legacy?.full_text?.substring(0, 100) + '...',
                retweeted_status_id_str: legacy?.retweeted_status_id_str,
                hasRetweetedStatusResult: !!tweetResult.retweeted_status_result,
                isQuoteStatus: legacy?.is_quote_status,
                conversation_id_str: legacy?.conversation_id_str,
                user_id_str: legacy?.user_id_str,
              });
              
              if (legacy) {
                let isMatch = false;
                let matchType = '';
                
                // Check 1: Regular retweet (starts with "RT @")
                if (legacy.full_text && legacy.full_text.startsWith('RT @')) {
                  console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ${i + 1}: Regular retweet detected`);
                  const normalizedTweet = normalizeText(legacy.full_text);
                  const tweetWithoutUrls = removeUrls(normalizedTweet);
                  
                  if (normalizedTweet.includes(normalizedContent) || tweetWithoutUrls.includes(contentWithoutUrls)) {
                    isMatch = true;
                    matchType = 'regular_retweet';
                  }
                }
                
                // Check 2: Retweet with retweeted_status_result
                if (!isMatch && tweetResult.retweeted_status_result) {
                  console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ${i + 1}: Retweet with retweeted_status_result detected`);
                  const retweetedStatus = tweetResult.retweeted_status_result.result;
                  if (retweetedStatus && retweetedStatus.legacy) {
                    const retweetedText = retweetedStatus.legacy.full_text;
                    if (retweetedText) {
                      const normalizedRetweeted = normalizeText(retweetedText);
                      const retweetedWithoutUrls = removeUrls(normalizedRetweeted);
                      
                      console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ${i + 1}: Checking retweeted content: "${retweetedText.substring(0, 100)}..."`);
                      
                      if (normalizedRetweeted.includes(normalizedContent) || retweetedWithoutUrls.includes(contentWithoutUrls)) {
                        isMatch = true;
                        matchType = 'retweet_with_status';
                      }
                    }
                  }
                }
                
                // Check 3: Quote tweet
                if (!isMatch && legacy.is_quote_status && legacy.quoted_status_id_str) {
                  console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ${i + 1}: Quote tweet detected`);
                  // For quote tweets, check both the quote text and the original tweet text
                  const normalizedTweet = normalizeText(legacy.full_text);
                  const tweetWithoutUrls = removeUrls(normalizedTweet);
                  
                  if (normalizedTweet.includes(normalizedContent) || tweetWithoutUrls.includes(contentWithoutUrls)) {
                    isMatch = true;
                    matchType = 'quote_tweet';
                  }
                }
                
                // Check 4: Regular tweet content match (fallback)
                if (!isMatch && legacy.full_text) {
                  const normalizedTweet = normalizeText(legacy.full_text);
                  const tweetWithoutUrls = removeUrls(normalizedTweet);
                  
                  if (normalizedTweet.includes(normalizedContent) || tweetWithoutUrls.includes(contentWithoutUrls)) {
                    // Additional check: if it contains the content but doesn't look like a retweet, 
                    // it might be a retweet that we missed
                    const contentWords = contentWithoutUrls.split(' ').filter(word => word.length > 2);
                    const tweetWords = tweetWithoutUrls.split(' ').filter(word => word.length > 2);
                    const matchingWords = contentWords.filter(word => tweetWithoutUrls.includes(word));
                    const similarityScore = matchingWords.length / contentWords.length;
                    
                    if (similarityScore >= 0.8) {
                      isMatch = true;
                      matchType = 'content_match';
                    }
                  }
                }
                
                if (isMatch) {
                  console.log(`[RETWEET_EXTRACT][${requestId}] ✅ RETWEET MATCH FOUND! Tweet ${i + 1}`);
                  console.log(`[RETWEET_EXTRACT][${requestId}] Match type: ${matchType}`);
                  console.log(`[RETWEET_EXTRACT][${requestId}] Tweet ID: ${legacy.id_str}`);
                  console.log(`[RETWEET_EXTRACT][${requestId}] Tweet text: "${legacy.full_text}"`);
                  
                  return {
                    ...legacy,
                    matchType: matchType,
                    retweetedStatusResult: tweetResult.retweeted_status_result || null
                  };
                } else {
                  console.log(`[RETWEET_EXTRACT][${requestId}] ❌ No match in tweet ${i + 1}`);
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`[RETWEET_EXTRACT][${requestId}] Error extracting retweets:`, error);
  }
  
  console.log(`[RETWEET_EXTRACT][${requestId}] ❌ No matching retweet found`);
  return null;
}

async function makeRequest(options: any): Promise<any> {
  const requestId = `http_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`[HTTP_REQUEST][${requestId}] Making request to: ${options.hostname}${options.path}`);
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        console.log(`[HTTP_REQUEST][${requestId}] Response received: ${res.statusCode} ${res.statusMessage}`);
        try {
          const data = JSON.parse(body.toString());
          resolve({ status: res.statusCode, data });
        } catch (error) {
          console.error(`[HTTP_REQUEST][${requestId}] JSON parse error:`, error);
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });
    req.on('error', (error) => {
      console.error(`[HTTP_REQUEST][${requestId}] Request error:`, error);
      reject(error);
    });
    req.end();
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `retweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[RETWEET_CHECK_API][${requestId}] === NEW RETWEET CHECK REQUEST ===`);
  
  try {
    if (!process.env.RAPID_API_KEY) {
      console.error(`[RETWEET_CHECK_API][${requestId}] RAPID_API_KEY not configured`);
      return NextResponse.json({ success: false, hasRetweet: false, error: 'API key not configured' }, { status: 500 });
    }
    
    const body = await request.json();
    const { userId, content } = body;
    
    console.log(`[RETWEET_CHECK_API][${requestId}] Request parameters:`, {
      userId: userId,
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 50) + (content?.length > 50 ? '...' : '')
    });
    
    if (!userId || !content) {
      console.log(`[RETWEET_CHECK_API][${requestId}] Missing required parameters`);
      return NextResponse.json({ success: false, hasRetweet: false, error: 'Missing userId or content' }, { status: 400 });
    }
    
    // Try multiple endpoints to get comprehensive tweet data
    const endpoints = [
      `/user/tweetsandreplies?user_id=${userId}&limit=20`, // Includes retweets and replies - limited to 20
      `/user/tweets?user_id=${userId}&limit=20` // Regular tweets (may include some retweets) - limited to 20
    ];
    
    let matchingRetweet = null;
    
    for (let i = 0; i < endpoints.length && !matchingRetweet; i++) {
      const endpoint = endpoints[i];
      console.log(`[RETWEET_CHECK_API][${requestId}] Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);
      
      const options = {
        method: 'GET',
        hostname: 'twitter-x.p.rapidapi.com',
        port: null,
        path: endpoint,
        headers: {
          'x-rapidapi-key': process.env.RAPID_API_KEY,
          'x-rapidapi-host': 'twitter-x.p.rapidapi.com',
        },
      };
      
      try {
        const response = await makeRequest(options);
        
        if (response.status !== 200 || !response.data) {
          console.log(`[RETWEET_CHECK_API][${requestId}] Endpoint ${i + 1} failed: ${response.status}`);
          continue;
        }
        
        console.log(`[RETWEET_CHECK_API][${requestId}] Endpoint ${i + 1} successful, extracting retweets...`);
        matchingRetweet = extractRetweets(response.data, content);
        
        if (matchingRetweet) {
          console.log(`[RETWEET_CHECK_API][${requestId}] ✅ Found matching retweet on endpoint ${i + 1}`);
          break;
        } else {
          console.log(`[RETWEET_CHECK_API][${requestId}] No matching retweet found on endpoint ${i + 1}`);
        }
      } catch (error) {
        console.error(`[RETWEET_CHECK_API][${requestId}] Error with endpoint ${i + 1}:`, error);
        continue;
      }
    }
    
    const result = {
      success: true,
      hasRetweet: !!matchingRetweet,
      matchingRetweet: matchingRetweet || undefined,
    };
    
    console.log(`[RETWEET_CHECK_API][${requestId}] Final result:`, {
      hasRetweet: result.hasRetweet,
      matchType: matchingRetweet?.matchType || null
    });
    console.log(`[RETWEET_CHECK_API][${requestId}] === REQUEST COMPLETED ===`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[RETWEET_CHECK_API][${requestId}] Error in retweet check:`, error);
    console.log(`[RETWEET_CHECK_API][${requestId}] === REQUEST COMPLETED WITH ERROR ===`);
    return NextResponse.json({ success: false, hasRetweet: false, error: 'Internal server error' }, { status: 500 });
  }
}
