import { createClient } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    // console.error('Error getting authenticated user:', error)
    return null
  }
}

export async function getTwitterAccessToken(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return null
    }
    
    // Get the provider token from user metadata
    // This assumes Twitter OAuth was set up correctly in Supabase
    const providerToken = user.user_metadata?.provider_token
    const providerRefreshToken = user.user_metadata?.provider_refresh_token
    
    return {
      accessToken: providerToken,
      refreshToken: providerRefreshToken,
      userId: user.user_metadata?.provider_id || user.id
    }
  } catch (error) {
    // console.error('Error getting Twitter access token:', error)
    return null
  }
} 
 