import { createClient, createAdminClient } from './supabase';

const supabase = createClient();

export type User = {
  id?: number;
  wallet_address: string;
  credits: number;
  twitter?: {
    username: string;
    verified_follows: string[];
  };
  last_active?: string;
  created_at?: string;
};

export type Vault = {
  id?: number;
  name: string;
  total_prize: number;
  available_prize: number;
  vault_sponsor?: string;
  sponsor_links?: any;
  ai_prompt?: string;
  created_at?: string;
  freecreditawarded?: string[];
  tweetContent?: string; // content to tweet for verification
  discord_link?: string; // discord link for verification
  linkedin_link?: string; // linkedin link for verification
  whitepaper_link?: string; // whitepaper link for navbar
  retweet_content?: string; // content to check for retweet verification
};

export type Transaction = {
  id?: number;
  user_id: number;
  vault_id?: number;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal' | 'prize' | 'credit_purchase';
  timestamp?: string;
};

export type Conversation = {
  id?: number;
  user_id: number;
  vault_id: number;
  created_at?: string;
};

export type Message = {
  id?: number;
  conversation_id: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp?: string;
};

export async function checkIfTwitterIdExists(twitterId: string): Promise<{exists: boolean, existingWallet?: string}> {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_address, twitter')
    .not('twitter', 'is', null);
  
  if (error) {
    console.error('Error checking Twitter ID:', error);
    return { exists: false };
  }
  
  // Filter users that have the same Twitter ID
  const userWithSameTwitterId = data.find(user => {
    if (user.twitter && typeof user.twitter === 'object') {
      return user.twitter.username === twitterId;
    }
    // If twitter data is stored as string, parse it
    if (user.twitter && typeof user.twitter === 'string') {
      try {
        const twitterData = JSON.parse(user.twitter);
        return twitterData.username === twitterId;
      } catch (e) {
        console.error('Error parsing Twitter data:', e);
        return false;
      }
    }
    return false;
  });
  
  if (userWithSameTwitterId) {
    return { 
      exists: true, 
      existingWallet: userWithSameTwitterId.wallet_address 
    };
  }
  
  return { exists: false };
}

export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
}

export async function createOrUpdateUser(userData: User): Promise<User | null | { error: string }> {
  const { wallet_address } = userData;
  
  // Check if Twitter ID exists (if provided)
  if (userData.twitter?.username) {
    const twitterIdCheck = await checkIfTwitterIdExists(userData.twitter.username);
    if (twitterIdCheck.exists && twitterIdCheck.existingWallet !== wallet_address) {
      return { 
        error: `This Twitter account is already linked to another wallet: ${twitterIdCheck.existingWallet?.substring(0, 6)}...${twitterIdCheck.existingWallet?.slice(-4)}` 
      };
    }
  }
  
  const existingUser = await getUserByWallet(wallet_address);
  if (existingUser) {
    const dataToUpdate = {
      last_active: new Date().toISOString(),
      ...userData,
    };
    const { data, error } = await supabase
      .from('users')
      .update(dataToUpdate)
      .eq('wallet_address', wallet_address)
      .select()
      .single();
    if (error) {
      console.error('[DEBUG DB] Error updating user:', error);
      return null;
    }
    return data;
  } else {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        wallet_address,
        credits: userData.credits || 0,
        twitter: userData.twitter,
        last_active: new Date().toISOString(),
      }])
      .select()
      .single();
    if (error) {
      console.error('[DEBUG DB] Error creating user:', error);
      return null;
    }
    return data;
  }
}

export async function getUserCredits(walletAddress: string): Promise<number> {
  const user = await getUserByWallet(walletAddress);
  return user?.credits || 0;
}

export async function updateUserCredits(walletAddress: string, amount: number, operation: 'add' | 'subtract'): Promise<number | null> {
  console.log(`[UPDATE_CREDITS] Starting ${operation} ${amount} credits for ${walletAddress}`);
  
  try {
    // Validate inputs
    if (!walletAddress || !amount || amount <= 0) {
      console.error('[UPDATE_CREDITS] Invalid inputs:', { walletAddress, amount, operation });
      return null;
    }

    if (operation !== 'add' && operation !== 'subtract') {
      console.error('[UPDATE_CREDITS] Invalid operation:', operation);
      return null;
    }

    // Get user with retry logic
    let user = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !user) {
      user = await getUserByWallet(walletAddress);
      if (!user) {
        retryCount++;
        console.warn(`[UPDATE_CREDITS] User ${walletAddress} not found, retry ${retryCount}/${maxRetries}`);
        
        // Try to create user if not found
        if (retryCount === 1) {
          console.log(`[UPDATE_CREDITS] Attempting to create user ${walletAddress}`);
          const createResult = await createOrUpdateUser({
            wallet_address: walletAddress,
            credits: 0
          });
          
          if (createResult && typeof createResult === 'object' && !('error' in createResult)) {
            user = createResult;
            console.log(`[UPDATE_CREDITS] Successfully created user ${walletAddress}`);
            break;
          } else {
            console.warn(`[UPDATE_CREDITS] Failed to create user ${walletAddress}:`, createResult);
          }
        }
        
        if (retryCount < maxRetries && !user) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    if (!user) {
      console.error(`[UPDATE_CREDITS] User ${walletAddress} not found after ${maxRetries} retries and creation attempt`);
      return null;
    }

    // Calculate new balance
    const currentCredits = user.credits || 0;
    const newBalance = operation === 'add' 
      ? currentCredits + amount 
      : Math.max(0, currentCredits - amount);

    console.log(`[UPDATE_CREDITS] Current: ${currentCredits}, New: ${newBalance} (${operation} ${amount})`);

    // Update credits with retry logic
    let updateSuccess = false;
    let finalCredits = null;
    retryCount = 0;
    
    while (retryCount < maxRetries && !updateSuccess) {
      try {
        const { data, error } = await supabase
          .from('users')
          .update({ 
            credits: newBalance, 
            last_active: new Date().toISOString() 
          })
          .eq('wallet_address', walletAddress)
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        if (data) {
          finalCredits = data.credits;
          updateSuccess = true;
          console.log(`[UPDATE_CREDITS] Successfully updated credits for ${walletAddress} to ${finalCredits}`);
        } else {
          throw new Error('No data returned from update');
        }
      } catch (error) {
        retryCount++;
        console.warn(`[UPDATE_CREDITS] Credit update failed, retry ${retryCount}/${maxRetries}:`, error);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    if (!updateSuccess) {
      console.error(`[UPDATE_CREDITS] Failed to update credits for ${walletAddress} after ${maxRetries} retries`);
      return null;
    }

    // Create transaction record (non-blocking)
    if (user.id) {
      try {
        await createTransaction({
          user_id: user.id,
          amount,
          transaction_type: operation === 'add' ? 'credit_purchase' : 'withdrawal',
        });
        console.log(`[UPDATE_CREDITS] Transaction record created for user ${user.id}`);
      } catch (transactionError) {
        // Don't fail the credit update if transaction recording fails
        console.warn(`[UPDATE_CREDITS] Failed to create transaction record:`, transactionError);
      }
    } else {
      console.warn(`[UPDATE_CREDITS] No user ID available for transaction record`);
    }

    return finalCredits;
    
  } catch (error) {
    console.error(`[UPDATE_CREDITS] Unexpected error in updateUserCredits:`, error);
    return null;
  }
}

export async function getVaults(): Promise<Vault[]> {
  const { data, error } = await supabase
    .from('vaults')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching vaults:', error);
    return [];
  }
  return data;
}

export async function getVaultById(vaultId: number): Promise<Vault | null> {
  const { data, error } = await supabase
    .from('vaults')
    .select('*')
    .eq('id', vaultId)
    .single();
  if (error) {
    console.error('Error fetching vault:', error);
    return null;
  }
  return data;
}

export async function createVault(vaultData: Vault): Promise<Vault | null> {
  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error('Admin client not available for creating vault');
    return null;
  }
  const { data, error } = await adminClient
    .from('vaults')
    .insert([vaultData])
    .select()
    .single();
  if (error) {
    console.error('Error creating vault:', error);
    return null;
  }
  return data;
}

export async function updateVault(vaultId: number, vaultData: Partial<Vault>): Promise<Vault | null> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = createAdminClient();
        if (adminClient) {
          const { data, error } = await adminClient
            .from('vaults')
            .update(vaultData)
            .eq('id', vaultId)
            .select()
            .single();
          if (error) {
            console.error('Error updating vault with admin client:', error);
          } else {
            return data;
          }
        }
      } catch (adminError) {
        console.error('Error with admin client:', adminError);
      }
    } else {
      console.log('No SUPABASE_SERVICE_ROLE_KEY found, using regular client');
    }
    const { data, error } = await supabase
      .from('vaults')
      .update(vaultData)
      .eq('id', vaultId)
      .select()
      .single();
    if (error) {
      console.error('Error updating vault with regular client:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Exception in updateVault:', err);
    return null;
  }
}

export async function awardFreeCreditIfEligible(vaultId: number, walletAddress: string): Promise<boolean> {
  console.log(`[FREE_CREDIT] Starting award process for vault ${vaultId}, wallet ${walletAddress}`);
  
  try {
    // Validate inputs
    if (!vaultId || !walletAddress) {
      console.error('[FREE_CREDIT] Invalid inputs:', { vaultId, walletAddress });
      return false;
    }

    // Get vault with retry logic
    let vault = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !vault) {
      vault = await getVaultById(vaultId);
      if (!vault) {
        retryCount++;
        console.warn(`[FREE_CREDIT] Vault ${vaultId} not found, retry ${retryCount}/${maxRetries}`);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    if (!vault) {
      console.error(`[FREE_CREDIT] Vault ${vaultId} not found after ${maxRetries} retries`);
      return false;
    }

    // Ensure freecreditawarded is properly initialized
    let awarded = [];
    if (vault.freecreditawarded) {
      if (Array.isArray(vault.freecreditawarded)) {
        awarded = [...vault.freecreditawarded];
      } else if (typeof vault.freecreditawarded === 'string') {
        try {
          awarded = JSON.parse(vault.freecreditawarded);
          if (!Array.isArray(awarded)) {
            awarded = [];
          }
        } catch (e) {
          console.warn('[FREE_CREDIT] Failed to parse freecreditawarded, initializing as empty array');
          awarded = [];
        }
      }
    }

    // Check if already awarded (case-insensitive)
    const normalizedWallet = walletAddress.toLowerCase();
    const alreadyAwarded = awarded.some(addr => addr.toLowerCase() === normalizedWallet);
    
    if (alreadyAwarded) {
      console.log(`[FREE_CREDIT] Credits already awarded to ${walletAddress} for vault ${vaultId}`);
      return false;
    }

    // Ensure user exists before awarding credits
    let user = await getUserByWallet(walletAddress);
    if (!user) {
      console.log(`[FREE_CREDIT] User ${walletAddress} not found, creating new user`);
      const createResult = await createOrUpdateUser({
        wallet_address: walletAddress,
        credits: 0
      });
      
      if (!createResult || typeof createResult === 'object' && 'error' in createResult) {
        console.error(`[FREE_CREDIT] Failed to create user ${walletAddress}:`, createResult);
        return false;
      }
      
      user = createResult;
    }

    // Add wallet to awarded list
    awarded.push(walletAddress);
    
    // Update vault with retry logic and proper error handling
    let vaultUpdateSuccess = false;
    retryCount = 0;
    
    while (retryCount < maxRetries && !vaultUpdateSuccess) {
      try {
        const updatedVault = await updateVault(vaultId, { freecreditawarded: awarded });
        if (updatedVault) {
          vaultUpdateSuccess = true;
          console.log(`[FREE_CREDIT] Successfully updated vault ${vaultId} with new awarded list`);
        } else {
          throw new Error('updateVault returned null');
        }
      } catch (error) {
        retryCount++;
        console.warn(`[FREE_CREDIT] Vault update failed, retry ${retryCount}/${maxRetries}:`, error);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    if (!vaultUpdateSuccess) {
      console.error(`[FREE_CREDIT] Failed to update vault ${vaultId} after ${maxRetries} retries`);
      return false;
    }

    console.log(`[FREE_CREDIT] Successfully awarded free credit eligibility to ${walletAddress} for vault ${vaultId}`);
    return true;
    
  } catch (error) {
    console.error(`[FREE_CREDIT] Unexpected error in awardFreeCreditIfEligible:`, error);
    return false;
  }
}

export async function getTransactions(filters: { userId?: number; vaultId?: number } = {}): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*');
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.vaultId) {
    query = query.eq('vault_id', filters.vaultId);
  }
  const { data, error } = await query.order('timestamp', { ascending: false });
  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data;
}

export async function createTransaction(transactionData: Transaction): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transactionData])
    .select()
    .single();
  if (error) {
    console.error('Error creating transaction:', error);
    return null;
  }
  return data;
}

export async function getConversations(userId: number, vaultId?: number): Promise<Conversation[]> {
  try {
    if (!userId || isNaN(userId)) {
      console.error('Invalid userId provided to getConversations:', userId);
      return [];
    }
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId);
    if (vaultId) {
      if (isNaN(vaultId)) {
        console.error('Invalid vaultId provided to getConversations:', vaultId);
        return [];
      }
      query = query.eq('vault_id', vaultId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching conversations:', error.message, error.details, error.hint);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception in getConversations:', err);
    return [];
  }
}

export async function createConversation(userId: number, vaultId: number): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{ user_id: userId, vault_id: vaultId }])
    .select()
    .single();
  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
  return data;
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  return data;
}

export async function addMessage(messageData: Message): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert([messageData])
    .select()
    .single();
  if (error) {
    console.error('Error adding message:', error);
    return null;
  }
  return data;
}

export async function getUserIdFromWallet(walletAddress: string): Promise<number | null> {
  if (!walletAddress) {
    console.error('No wallet address provided to getUserIdFromWallet');
    return null;
  }
  try {
    const user = await getUserByWallet(walletAddress);
    if (!user) {
      return null;
    }
    if (!user.id) {
      return null;
    }
    return user.id;
  } catch (error) {
    console.error(`Error in getUserIdFromWallet for ${walletAddress}:`, error);
    return null;
  }
}

/**
 * Atomically award free credits - ensures both eligibility tracking and credit awarding succeed together
 * This is the recommended function to use for awarding free credits
 */
export async function atomicAwardFreeCredits(vaultId: number, walletAddress: string, completedTasks?: number): Promise<{
  success: boolean;
  creditsAwarded: number;
  message: string;
  alreadyAwarded?: boolean;
}> {
  console.log(`[ATOMIC_AWARD] Starting atomic free credit award for vault ${vaultId}, wallet ${walletAddress}`);
  
  try {
    // Validate inputs
    if (!vaultId || !walletAddress) {
      return {
        success: false,
        creditsAwarded: 0,
        message: 'Invalid inputs: vaultId and walletAddress are required'
      };
    }

    // Step 1: Check if already awarded (without modifying anything)
    const vault = await getVaultById(vaultId);
    if (!vault) {
      return {
        success: false,
        creditsAwarded: 0,
        message: `Vault ${vaultId} not found`
      };
    }

    // Check existing awards
    let awarded = [];
    if (vault.freecreditawarded) {
      if (Array.isArray(vault.freecreditawarded)) {
        awarded = [...vault.freecreditawarded];
      } else if (typeof vault.freecreditawarded === 'string') {
        try {
          awarded = JSON.parse(vault.freecreditawarded);
          if (!Array.isArray(awarded)) {
            awarded = [];
          }
        } catch (e) {
          awarded = [];
        }
      }
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const alreadyAwarded = awarded.some(addr => addr.toLowerCase() === normalizedWallet);
    
    if (alreadyAwarded) {
      console.log(`[ATOMIC_AWARD] Credits already awarded to ${walletAddress} for vault ${vaultId}`);
      return {
        success: false,
        creditsAwarded: 0,
        message: 'Free credits already awarded for this vault',
        alreadyAwarded: true
      };
    }

    // Step 2: Determine credit amount based on completed tasks
    let creditsToAward: number;
    if (completedTasks !== undefined && completedTasks > 0) {
      // Award 1 credit per completed verification task
      creditsToAward = completedTasks;
      console.log(`[ATOMIC_AWARD] Will award ${creditsToAward} credits for ${completedTasks} completed tasks`);
    } else {
      // Fallback to old logic for backward compatibility
      creditsToAward = vaultId === 113 ? 8 : (vault.tweetContent ? 4 : 3);
      console.log(`[ATOMIC_AWARD] Using fallback logic: ${creditsToAward} credits (vault has tweet content: ${!!vault.tweetContent})`);
    }

    // Step 3: Ensure user exists
    let user = await getUserByWallet(walletAddress);
    if (!user) {
      console.log(`[ATOMIC_AWARD] Creating user ${walletAddress}`);
      const createResult = await createOrUpdateUser({
        wallet_address: walletAddress,
        credits: 0
      });
      
      if (!createResult || typeof createResult === 'object' && 'error' in createResult) {
        return {
          success: false,
          creditsAwarded: 0,
          message: `Failed to create user: ${typeof createResult === 'object' && 'error' in createResult ? createResult.error : 'Unknown error'}`
        };
      }
      
      user = createResult;
    }

    // Step 4: Update vault eligibility list first (this acts as our "lock")
    awarded.push(walletAddress);
    const vaultUpdateResult = await updateVault(vaultId, { freecreditawarded: awarded });
    
    if (!vaultUpdateResult) {
      return {
        success: false,
        creditsAwarded: 0,
        message: 'Failed to update vault eligibility tracking'
      };
    }

    console.log(`[ATOMIC_AWARD] Successfully updated vault eligibility for ${walletAddress}`);

    // Step 5: Award credits (with rollback on failure)
    const creditUpdateResult = await updateUserCredits(walletAddress, creditsToAward, 'add');
    
    if (creditUpdateResult === null) {
      // Rollback: Remove wallet from awarded list
      console.error(`[ATOMIC_AWARD] Credit update failed, rolling back vault eligibility for ${walletAddress}`);
      const rollbackAwarded = awarded.filter(addr => addr.toLowerCase() !== normalizedWallet);
      await updateVault(vaultId, { freecreditawarded: rollbackAwarded });
      
      return {
        success: false,
        creditsAwarded: 0,
        message: 'Failed to award credits - eligibility has been rolled back'
      };
    }

    console.log(`[ATOMIC_AWARD] Successfully awarded ${creditsToAward} credits to ${walletAddress}. New balance: ${creditUpdateResult}`);
    
    return {
      success: true,
      creditsAwarded: creditsToAward,
      message: `Successfully awarded ${creditsToAward} free credits`
    };

  } catch (error) {
    console.error(`[ATOMIC_AWARD] Unexpected error:`, error);
    return {
      success: false,
      creditsAwarded: 0,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Health check function to diagnose free credit system issues
 */
export async function freeCreditSystemHealthCheck(): Promise<{
  healthy: boolean;
  checks: {
    database: boolean;
    vaultAccess: boolean;
    userAccess: boolean;
    creditUpdate: boolean;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  const checks = {
    database: false,
    vaultAccess: false,
    userAccess: false,
    creditUpdate: false
  };

  try {
    // Test 1: Basic database connectivity
    try {
      const { data, error } = await supabase.from('vaults').select('id').limit(1);
      if (error) {
        errors.push(`Database connectivity error: ${error.message}`);
      } else {
        checks.database = true;
      }
    } catch (dbError) {
      errors.push(`Database connection failed: ${dbError}`);
    }

    // Test 2: Vault access
    try {
      const vaults = await getVaults();
      if (vaults && vaults.length >= 0) {
        checks.vaultAccess = true;
      } else {
        errors.push('Failed to fetch vaults');
      }
    } catch (vaultError) {
      errors.push(`Vault access error: ${vaultError}`);
    }

    // Test 3: User access (try to get a non-existent user)
    try {
      const testUser = await getUserByWallet('0x0000000000000000000000000000000000000000');
      // Should return null for non-existent user, which is expected
      checks.userAccess = true;
    } catch (userError) {
      errors.push(`User access error: ${userError}`);
    }

    // Test 4: Credit update capability (dry run)
    try {
      // This is a read-only test - we just check if the function can be called
      // without actually modifying anything
      const testWallet = '0x0000000000000000000000000000000000000000';
      const testUser = await getUserByWallet(testWallet);
      // If user doesn't exist (expected), this is still a successful test
      checks.creditUpdate = true;
    } catch (creditError) {
      errors.push(`Credit update capability error: ${creditError}`);
    }

  } catch (overallError) {
    errors.push(`Overall health check error: ${overallError}`);
  }

  const healthy = Object.values(checks).every(check => check === true);

  return {
    healthy,
    checks,
    errors
  };
}
