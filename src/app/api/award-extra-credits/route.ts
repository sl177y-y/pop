import { NextRequest, NextResponse } from 'next/server';
import { getUserByWallet, updateUserCredits, getVaultById } from '@/lib/server/db';
import { createClient } from '@/lib/server/supabase';
import { z } from 'zod';

const AwardCreditsSchema = z.object({
  vaultId: z.number(),
  userAddress: z.string(),
  chain: z.enum(['aptos', 'ethereum']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vaultId, userAddress, chain } = AwardCreditsSchema.parse(body);

    // Get user to ensure they exist
    const user = await getUserByWallet(userAddress);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get vault to check for conditions
    const vault = await getVaultById(vaultId);
    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    // Query vault conditions for this vault
    const supabase = createClient();
    const { data: conditions, error: conditionsError } = await supabase
      .from('vault_conditions')
      .select('*')
      .eq('vault_id', vaultId);

    if (conditionsError) {
      console.error('Error fetching vault conditions:', conditionsError);
      return NextResponse.json({ error: 'Failed to fetch vault conditions' }, { status: 500 });
    }

    if (!conditions || conditions.length === 0) {
      return NextResponse.json({ 
        creditsAwarded: 0, 
        message: 'No conditions found for this vault' 
      });
    }

    let totalCreditsAwarded = 0;
    const awardedConditions = [];

    // Check each condition
    for (const condition of conditions) {
      if (condition.condition_type === 'hold_token') {
        // Call our token holding API to verify
        const checkResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/check-token-holding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chain: chain || (vault.blockchain === 'ethereum' ? 'ethereum' : 'aptos'),
            userAddress: chain === 'ethereum' ? user.evm_wallet_address : userAddress,
            tokenType: condition.token_type,
            tokenAddress: condition.token_address,
            amount: condition.amount?.toString(),
          }),
        });

        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();
          
          if (checkResult.valid) {
            totalCreditsAwarded += condition.reward_credits;
            awardedConditions.push({
              condition_type: condition.condition_type,
              token_type: condition.token_type,
              amount: condition.amount,
              reward_credits: condition.reward_credits,
            });
          }
        }
      }
    }

    // Award credits if any conditions were met
    if (totalCreditsAwarded > 0) {
      const newBalance = await updateUserCredits(userAddress, totalCreditsAwarded, 'add');
      
      if (newBalance !== null) {
        return NextResponse.json({
          success: true,
          creditsAwarded: totalCreditsAwarded,
          newBalance,
          conditions: awardedConditions,
          message: `Awarded ${totalCreditsAwarded} credits for meeting vault conditions`
        });
      } else {
        return NextResponse.json({ 
          error: 'Failed to update user credits' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      creditsAwarded: 0,
      message: 'No vault conditions were met'
    });

  } catch (error) {
    console.error('Error awarding extra credits:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input parameters',
        details: error.errors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to award extra credits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}