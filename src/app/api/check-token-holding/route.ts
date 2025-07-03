import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ethers } from 'ethers';
import { z } from 'zod';

const CheckTokenSchema = z.object({
  chain: z.enum(['aptos', 'ethereum']),
  userAddress: z.string(),
  tokenType: z.enum(['native', 'erc20', 'erc721', 'aptos_coin']).optional(),
  tokenAddress: z.string().optional(),
  amount: z.string().optional(),
  tokenId: z.string().optional(),
});

interface TokenHoldingRequest {
  userAddress: string;
  vaultId: number;
  blockchain: 'aptos' | 'ethereum';
}

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function checkAptosTokenBalance(userAddress: string, tokenType: string, tokenAddress?: string, requiredAmount?: number) {
  try {
    if (tokenType === 'native' || tokenType === 'aptos_coin') {
      // Check APT balance
      const response = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${userAddress}/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>`);
      if (!response.ok) return false;
      
      const data = await response.json();
      const balance = parseInt(data.data.coin.value) / 100000000; // Convert from octas to APT
      
      return requiredAmount ? balance >= requiredAmount : balance > 0;
    } else if (tokenType === 'erc20' && tokenAddress) {
      // Check custom token balance (would need Aptos token checking logic)
      // For now, return false as this requires more complex Aptos token queries
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Aptos token balance:', error);
    return false;
  }
}

async function checkEthereumTokenBalance(userAddress: string, tokenType: string, tokenAddress?: string, requiredAmount?: number) {
  try {
    // Use multiple fallback RPC endpoints
    const rpcUrls = [
      process.env.SEPOLIA_RPC_URL,
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://rpc.sepolia.org',
      'https://eth-sepolia.public.blastapi.io'
    ].filter(Boolean);

    let provider = null;
    
    // Try multiple RPC providers until one works
    for (const rpcUrl of rpcUrls) {
      try {
        provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
          staticNetwork: true,
          batchMaxCount: 1,
          batchStallTime: 50,
        });
        
        // Test the connection
        await provider.getNetwork();
        break;
      } catch (error) {
        console.warn(`RPC ${rpcUrl} failed:`, error.message);
        provider = null;
      }
    }

    if (!provider) {
      console.warn('All Ethereum RPC providers failed, returning false for token check');
      return false;
    }
    
    if (tokenType === 'native') {
      // Check ETH balance
      const balance = await provider.getBalance(userAddress);
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      
      return requiredAmount ? balanceInEth >= requiredAmount : balanceInEth > 0;
    } else if (tokenType === 'erc20' && tokenAddress) {
      // Check ERC20 token balance
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(userAddress);
      const decimals = await contract.decimals();
      const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
      
      return requiredAmount ? balanceFormatted >= requiredAmount : balanceFormatted > 0;
    } else if (tokenType === 'erc721' && tokenAddress) {
      // Check NFT ownership (simplified)
      const nftAbi = ['function balanceOf(address owner) view returns (uint256)'];
      const contract = new ethers.Contract(tokenAddress, nftAbi, provider);
      const balance = await contract.balanceOf(userAddress);
      
      return balance.gt(0);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Ethereum token balance:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenHoldingRequest = await request.json();
    const { userAddress, vaultId, blockchain } = body;

    if (!userAddress || !vaultId || !blockchain) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get vault conditions for this vault
    const { data: conditions, error: conditionsError } = await supabase
      .from('vault_conditions')
      .select('*')
      .eq('vault_id', vaultId)
      .eq('condition_type', 'hold_token');

    if (conditionsError) {
      console.error('Error fetching vault conditions:', conditionsError);
      return NextResponse.json(
        { error: 'Failed to check vault conditions' },
        { status: 500 }
      );
    }

    if (!conditions || conditions.length === 0) {
      return NextResponse.json({
        qualifiesForBonus: false,
        bonusCredits: 0,
        message: 'No token holding requirements for this vault'
      });
    }

    let totalBonusCredits = 0;
    const qualifiedConditions = [];

    // Check each condition
    for (const condition of conditions) {
      let hasRequiredBalance = false;

      if (blockchain === 'aptos') {
        hasRequiredBalance = await checkAptosTokenBalance(
          userAddress,
          condition.token_type,
          condition.token_address,
          condition.amount
        );
      } else if (blockchain === 'ethereum') {
        hasRequiredBalance = await checkEthereumTokenBalance(
          userAddress,
          condition.token_type,
          condition.token_address,
          condition.amount
        );
      }

      if (hasRequiredBalance) {
        totalBonusCredits += condition.reward_credits || 0;
        qualifiedConditions.push(condition);
      }
    }

    // Update user credits if they qualify for bonus
    if (totalBonusCredits > 0) {
      // Get user by wallet address
      const walletColumn = blockchain === 'ethereum' ? 'evm_wallet_address' : 'wallet_address';
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, credits')
        .eq(walletColumn, userAddress)
        .single();

      if (userError || !user) {
        console.error('Error finding user:', userError);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Award bonus credits
      const newCredits = (user.credits || 0) + totalBonusCredits;
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits: newCredits })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating user credits:', updateError);
        return NextResponse.json(
          { error: 'Failed to award bonus credits' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        qualifiesForBonus: true,
        bonusCredits: totalBonusCredits,
        newTotalCredits: newCredits,
        qualifiedConditions: qualifiedConditions.map(c => ({
          tokenType: c.token_type,
          tokenAddress: c.token_address,
          requiredAmount: c.amount,
          rewardCredits: c.reward_credits
        })),
        message: `Congratulations! You've been awarded ${totalBonusCredits} bonus credits for holding required tokens.`
      });
    }

    return NextResponse.json({
      qualifiesForBonus: false,
      bonusCredits: 0,
      message: 'You do not currently hold the required tokens for bonus credits'
    });

  } catch (error) {
    console.error('Error in check-token-holding API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('userAddress');
  const vaultId = searchParams.get('vaultId');
  const blockchain = searchParams.get('blockchain');

  if (!userAddress || !vaultId || !blockchain) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Reuse POST logic for GET requests
  return POST(request);
}