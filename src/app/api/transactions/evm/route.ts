import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ethers, JsonRpcProvider, Contract, parseEther, formatEther, parseUnits } from 'ethers';
import { getEVMVaultConfig, isValidEVMVaultId } from '@/lib/evmbuycredit';

interface EVMTransactionRequest {
  userAddress: string;
  amount: string; // Amount in ETH (e.g., "0.1")
  vaultId: number;
  tokenType: 'native' | 'erc20';
  tokenAddress?: string; // For ERC20 tokens
  transactionHash?: string; // Hash of the completed transaction
  verified?: boolean; // Flag indicating this is a real verified transaction
}

// Import RPC providers from evmbuycredit.ts
const RPC_PROVIDERS = [
  'https://eth-sepolia.g.alchemy.com/v2/b20Yg4jZMHRLeuzNknS1pSAgta1Plerw',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc.sepolia.org',
  'https://eth-sepolia.public.blastapi.io'
];

async function getWorkingProvider() {
  for (const rpcUrl of RPC_PROVIDERS) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
        batchMaxCount: 1,
        batchStallTime: 50,
      });
      await provider.getNetwork();
      return provider;
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      continue;
    }
  }
  throw new Error('All RPC providers failed');
}

async function verifyTransactionWithRetries(transactionHash: string, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const provider = await getWorkingProvider();
      
      // Get transaction details
      const tx = await provider.getTransaction(transactionHash);
      const receipt = await provider.getTransactionReceipt(transactionHash);
      
      if (!tx || !receipt) {
        throw new Error('Transaction not found');
      }
      
      return { tx, receipt };
    } catch (error) {
      console.warn(`Verification attempt ${i + 1} failed:`, error);
      lastError = error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  throw lastError;
}

async function atomicDatabaseUpdate(
  supabase,
  user,
  creditsToAward: number,
  ethAmount: number,
  vaultId: number,
  transactionHash: string
) {
  try {
    // console.log(`🔍 Starting database update for user ${user.id}:`);
    // console.log(`   Current credits: ${user.credits}`);
    // console.log(`   Credits to award: ${creditsToAward}`);
    // console.log(`   Transaction hash: ${transactionHash}`);
    
    // Start with updating user credits
    const newCredits = user.credits + creditsToAward;
    // console.log(`   New total credits: ${newCredits}`);
    
    // Update user credits
    // console.log(`📝 Updating user credits in database...`);
    const { data: updatedUser, error: userUpdateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', user.id)
      .select('credits')
      .single();

    if (userUpdateError) {
      console.error(`❌ User update failed:`, userUpdateError);
      throw new Error(`Failed to update user credits: ${userUpdateError.message}`);
    }
    
    // console.log(`✅ User credits updated successfully:`, updatedUser);

    // Insert transaction record
    // console.log(`📝 Inserting transaction record...`);
    const transactionData = {
      user_id: user.id,
      vault_id: vaultId,
      amount: ethAmount,
      transaction_type: 'credit_purchase',
      currency: 'ETH',
      status: 'completed',
      transaction_hash: transactionHash,
      credits_awarded: creditsToAward,
      blockchain: 'ethereum',
      timestamp: new Date().toISOString()
    };
    // console.log(`   Transaction data:`, transactionData);
    
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error(`❌ Transaction insert failed:`, transactionError);
      // Rollback user credits update
      // console.log(`🔄 Rolling back user credits...`);
      await supabase
        .from('users')
        .update({ credits: user.credits })
        .eq('id', user.id);
      
      throw new Error(`Failed to insert transaction: ${transactionError.message}`);
    }
    
    // console.log(`✅ Transaction record inserted successfully:`, transaction);
    // console.log(`🎉 Database update completed successfully!`);

    return {
      success: true,
      new_credits: newCredits,
      transaction_id: transaction.id
    };
  } catch (error) {
    console.error('❌ Database update failed:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EVMTransactionRequest = await request.json();
    const { userAddress, amount, vaultId, tokenType, tokenAddress, transactionHash, verified } = body;

    if (!userAddress || !amount || !vaultId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if user exists by EVM wallet address
    let user = null;
    // console.log(`🔍 Looking for user with EVM wallet address: ${userAddress}`);
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, credits, evm_wallet_address, wallet_address')
      .eq('evm_wallet_address', userAddress)
      .maybeSingle();

    if (existingUser) {
      user = existingUser;
      // console.log(`✅ Found existing user:`, user);
    } else {
      // console.log(`👤 User not found, creating new EVM-only user...`);
      // User doesn't exist, create new EVM-only user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          evm_wallet_address: userAddress,
          credits: 0
          // wallet_address will be NULL by default since we made it nullable
        })
        .select('id, credits')
        .single();

      if (createError) {
        console.error('❌ Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
      
      user = newUser;
      // console.log(`✅ Created new user:`, user);
    }

    // Validate EVM vault ID first
    if (!isValidEVMVaultId(vaultId)) {
      return NextResponse.json(
        { error: `Invalid EVM vault ID: ${vaultId}. This vault is not configured for EVM transactions.` },
        { status: 400 }
      );
    }

    // Get vault information from database
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('id', vaultId)
      .single();

    if (vaultError || !vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    if (vault.blockchain !== 'ethereum') {
      return NextResponse.json(
        { error: 'This vault does not accept EVM transactions' },
        { status: 400 }
      );
    }

    // Get EVM vault configuration
    const evmVaultConfig = getEVMVaultConfig(vaultId);
    if (!evmVaultConfig) {
      return NextResponse.json(
        { error: `EVM vault ${vaultId} configuration not found` },
        { status: 500 }
      );
    }

    // console.log(`💰 Processing EVM transaction for ${evmVaultConfig.description}`);
    // console.log(`🏦 Treasury address: ${evmVaultConfig.address}`);

    // Calculate credits to award (5 credits per 0.001 ETH)
    const ethAmount = parseFloat(amount);
    const creditsToAward = Math.floor((ethAmount / 0.0002) * 1); // 1 credit per 0.0002 ETH

    if (creditsToAward <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Amount too small. Minimum 0.0002 ETH required for 1 credit.'
      });
    }

    // Handle verified transactions (real MetaMask transactions)
    if (verified && transactionHash) {
      // console.log(`Processing verified transaction: ${transactionHash}`);
      
      try {
        // Verify transaction with retries
        const { tx, receipt } = await verifyTransactionWithRetries(transactionHash);
        
        if (receipt.status !== 1) {
          return NextResponse.json({
            success: false,
            error: 'Transaction failed on blockchain'
          });
        }
        
        // Verify transaction details
        const expectedTreasury = evmVaultConfig.address.toLowerCase();
        const actualRecipient = tx.to?.toLowerCase();
        const actualSender = tx.from?.toLowerCase();
        const expectedSender = userAddress.toLowerCase();
        const actualAmount = parseFloat(formatEther(tx.value));
        const tolerance = 0.000001;
        
        if (actualRecipient !== expectedTreasury) {
          return NextResponse.json({
            success: false,
            error: `Transaction sent to wrong address`
          });
        }
        
        if (actualSender !== expectedSender) {
          return NextResponse.json({
            success: false,
            error: `Transaction sender mismatch`
          });
        }
        
        if (Math.abs(actualAmount - parseFloat(amount)) > tolerance) {
          return NextResponse.json({
            success: false,
            error: `Transaction amount mismatch`
          });
        }

        // Perform atomic database update
        const result = await atomicDatabaseUpdate(
          supabase,
          user,
          creditsToAward,
          parseFloat(amount),
          vaultId,
          transactionHash
        );

        return NextResponse.json({
          success: true,
          message: `Successfully processed ${creditsToAward} credits for ${amount} Sepolia ETH`,
          creditsAwarded: creditsToAward,
          newTotalCredits: result.new_credits,
          transactionHash: transactionHash,
          transactionId: result.transaction_id,
          blockchain: 'ethereum',
          network: 'sepolia'
        });

      } catch (error) {
        console.error('Transaction processing failed:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to process transaction. Please try again.'
        });
      }
    }

    // Handle unverified requests (balance check only)
    const rpcUrls = [
      process.env.SEPOLIA_RPC_URL,
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://rpc.sepolia.org',
      'https://eth-sepolia.public.blastapi.io'
    ].filter(Boolean);

    let provider = null;
    let providerError = null;

    // Try multiple RPC providers until one works
    for (const rpcUrl of rpcUrls) {
      try {
        provider = new JsonRpcProvider(rpcUrl);
        await provider.getNetwork();
        // console.log(`Successfully connected to Sepolia via: ${rpcUrl}`);
        break;
      } catch (error) {
        console.warn(`Failed to connect to ${rpcUrl}:`, error.message);
        providerError = error;
        provider = null;
      }
    }

    if (!provider) {
      console.error('All RPC providers failed:', providerError);
      return NextResponse.json({
        success: false,
        error: 'Unable to connect to Sepolia network. Please try again later.'
      });
    }

    try {
      // Check user's balance for unverified requests
      let hasEnoughBalance = false;
      
      if (tokenType === 'native') {
        const balance = await provider.getBalance(userAddress);
        const required = parseEther(amount);
        hasEnoughBalance = balance >= required;
        
        // console.log(`Balance check: ${formatEther(balance)} ETH, Required: ${amount} ETH`);
      } else if (tokenType === 'erc20' && tokenAddress) {
        const erc20Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ];
        const contract = new Contract(tokenAddress, erc20Abi, provider);
        const balance = await contract.balanceOf(userAddress);
        const decimals = await contract.decimals();
        const required = parseUnits(amount, decimals);
        hasEnoughBalance = balance >= required;
      }

      if (!hasEnoughBalance) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient balance. Please get Sepolia ETH from faucet: https://sepolia-faucet.com/'
        });
      }

      return NextResponse.json({
        success: true,
        message: `Balance verified. You have sufficient funds to purchase ${creditsToAward} credits for ${amount} Sepolia ETH`,
        creditsToAward: creditsToAward,
        requiresTransaction: true,
        blockchain: 'ethereum',
        network: 'sepolia'
      });

    } catch (networkError) {
      console.error('Error checking balance:', networkError);
      return NextResponse.json({
        success: false,
        error: 'Network error: Unable to verify balance. Please try again.'
      });
    }

  } catch (error) {
    console.error('Error in EVM transaction API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('userAddress');

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing userAddress parameter' },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient();

    // Get user's transaction history
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('evm_wallet_address', userAddress)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        transactions: [],
        message: 'No transaction history found'
      });
    }

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('blockchain', 'ethereum')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json(
        { error: 'Failed to fetch transaction history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: transactions || [],
      totalTransactions: transactions?.length || 0
    });

  } catch (error) {
    console.error('Error in EVM transaction history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}