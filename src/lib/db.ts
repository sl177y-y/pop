// This file has been moved to server-only. Do not import from here in client code kep here for debugging 
throw new Error('Do not import db.ts on the client. Use API routes instead.');

import { createClient, createAdminClient } from './server/supabase';

// Initialize the Supabase client
const supabase = createClient();

// Types
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
  freecreditawarded?: string[]; // wallet addresses that have been awarded free credits
  tweetContent?: string; // content to tweet for verification
  discord_link?: string; // discord link for verification
  linkedin_link?: string; // linkedin link for verification
  whitepaper_link?: string; // whitepaper link for navbar
  retweet_content?: string; // content to check for retweet verification
  vault_public_key?:string;
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

// ===== User Management =====
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

export async function createOrUpdateUser(userData: User): Promise<User | null> {
  const { wallet_address } = userData;
  
  console.log(`[DEBUG DB] createOrUpdateUser called for wallet: ${wallet_address}`);
  console.log(`[DEBUG DB] Twitter data received:`, JSON.stringify(userData.twitter));
  console.log(`[DEBUG DB] Twitter data type:`, typeof userData.twitter);
  
  // Check if user exists
  const existingUser = await getUserByWallet(wallet_address);
  
  if (existingUser) {
    console.log(`[DEBUG DB] Existing user found, updating...`);
    console.log(`[DEBUG DB] Existing twitter data:`, JSON.stringify(existingUser.twitter));
    console.log(`[DEBUG DB] Existing twitter data type:`, typeof existingUser.twitter);
    
    // Ensure twitter data is properly formatted as an object, not a string
    const dataToUpdate = {
      last_active: new Date().toISOString(),
      ...userData,
    };
    
    console.log(`[DEBUG DB] Final update data:`, JSON.stringify(dataToUpdate));
    
    // Update user
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
    
    console.log(`[DEBUG DB] User updated successfully`);
    console.log(`[DEBUG DB] Returned twitter data:`, JSON.stringify(data.twitter));
    console.log(`[DEBUG DB] Returned twitter data type:`, typeof data.twitter);
    
    return data;
  } else {
    console.log(`[DEBUG DB] User not found, creating new user...`);
    // Create new user
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
    
    console.log(`[DEBUG DB] User created successfully`);
    console.log(`[DEBUG DB] Created user twitter data:`, JSON.stringify(data.twitter));
    console.log(`[DEBUG DB] Created user twitter data type:`, typeof data.twitter);
    
    return data;
  }
}

export async function getUserCredits(walletAddress: string): Promise<number> {
  const user = await getUserByWallet(walletAddress);
  return user?.credits || 0;
}

export async function updateUserCredits(
  walletAddress: string, 
  amount: number, 
  operation: 'add' | 'subtract'
): Promise<number | null> {
  const user = await getUserByWallet(walletAddress);
  
  if (!user) return null;
  
  const newBalance = operation === 'add' 
    ? user.credits + amount 
    : Math.max(0, user.credits - amount);
  
  const { data, error } = await supabase
    .from('users')
    .update({ credits: newBalance, last_active: new Date().toISOString() })
    .eq('wallet_address', walletAddress)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating credits:', error);
    return null;
  }
  
  // Record transaction
  if (user.id) {
    await createTransaction({
      user_id: user.id,
      amount,
      transaction_type: operation === 'add' ? 'credit_purchase' : 'withdrawal',
    });
  }
  
  return data.credits;
}

// ===== Vault Management =====
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
  
  // Check if admin client is available
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
    // Only try admin client if the service role key exists
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = createAdminClient();
        
        // Check if admin client was successfully created
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
    
    // Fall back to regular client
    console.log('Using regular Supabase client for vault update');
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

// Award free credits for Twitter follow if not already awarded
export async function awardFreeCreditIfEligible(vaultId: number, walletAddress: string): Promise<boolean> {
  // Fetch the vault
  const vault = await getVaultById(vaultId);
  if (!vault) return false;
  let awarded = Array.isArray(vault.freecreditawarded) ? vault.freecreditawarded : [];
  if (awarded.includes(walletAddress)) {
    // Already awarded
    return false;
  }
  // Add wallet address to awarded list
  awarded.push(walletAddress);
  // Update vault
  await updateVault(vaultId, { freecreditawarded: awarded });
  return true;
}

// ===== Transaction Tracking =====
export async function getTransactions(
  filters: { userId?: number; vaultId?: number } = {}
): Promise<Transaction[]> {
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

// ===== Conversation History =====
export async function getConversations(
  userId: number, 
  vaultId?: number
): Promise<Conversation[]> {
  try {
    console.log(`Getting conversations for userId: ${userId}, vaultId: ${vaultId || 'all'}`);
    
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
    
    console.log(`Retrieved ${data?.length || 0} conversations`);
    return data || [];
  } catch (err) {
    console.error('Exception in getConversations:', err);
    return [];
  }
}

export async function createConversation(
  userId: number, 
  vaultId: number
): Promise<Conversation | null> {
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

// Helper function to get user ID from wallet address
export async function getUserIdFromWallet(walletAddress: string): Promise<number | null> {
  if (!walletAddress) {
    console.error('No wallet address provided to getUserIdFromWallet');
    return null;
  }
  
  try {
    console.log(`Looking up user ID for wallet address: ${walletAddress}`);
    const user = await getUserByWallet(walletAddress);
    
    if (!user) {
      console.log(`No user found for wallet address: ${walletAddress}`);
      return null;
    }
    
    if (!user.id) {
      console.warn(`User found for wallet ${walletAddress} but has no ID`);
      return null;
    }
    
    console.log(`Found user ID ${user.id} for wallet address: ${walletAddress}`);
    return user.id;
  } catch (error) {
    console.error(`Error in getUserIdFromWallet for ${walletAddress}:`, error);
    return null;
  }
}