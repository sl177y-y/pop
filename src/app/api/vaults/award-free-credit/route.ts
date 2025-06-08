import { NextRequest, NextResponse } from 'next/server';
import { atomicAwardFreeCredits } from '@/lib/server/db';

export async function POST(request: NextRequest) {
  try {
    console.log('[award-free-credit] Incoming request');
    const { vaultId, walletAddress } = await request.json();
    console.log('[award-free-credit] Input:', { vaultId, walletAddress });
    
    // Validate inputs
    if (!vaultId || !walletAddress) {
      console.warn('[award-free-credit] Missing vaultId or walletAddress', { vaultId, walletAddress });
      return NextResponse.json({ 
        error: 'vaultId and walletAddress are required',
        awarded: false,
        creditsAwarded: 0
      }, { status: 400 });
    }

    // Validate vaultId is a valid number
    const numericVaultId = Number(vaultId);
    if (isNaN(numericVaultId) || numericVaultId <= 0) {
      console.warn('[award-free-credit] Invalid vaultId:', vaultId);
      return NextResponse.json({ 
        error: 'Invalid vaultId',
        awarded: false,
        creditsAwarded: 0
      }, { status: 400 });
    }

    // Validate wallet address format (basic check)
    if (typeof walletAddress !== 'string' || walletAddress.length < 10) {
      console.warn('[award-free-credit] Invalid walletAddress:', walletAddress);
      return NextResponse.json({ 
        error: 'Invalid walletAddress',
        awarded: false,
        creditsAwarded: 0
      }, { status: 400 });
    }

    // Use the atomic function for reliable credit awarding
    const result = await atomicAwardFreeCredits(numericVaultId, walletAddress);
    
    console.log('[award-free-credit] Atomic award result:', result);
    
    if (result.success) {
      return NextResponse.json({ 
        awarded: true, 
        creditsAwarded: result.creditsAwarded,
        message: result.message
      });
    } else {
      // Determine appropriate status code based on the failure reason
      let statusCode = 500; // Default to server error
      
      if (result.alreadyAwarded) {
        statusCode = 409; // Conflict - already awarded
      } else if (result.message.includes('not found')) {
        statusCode = 404; // Not found
      } else if (result.message.includes('Invalid inputs')) {
        statusCode = 400; // Bad request
      }
      
      return NextResponse.json({ 
        awarded: false,
        creditsAwarded: 0,
        error: result.message
      }, { status: statusCode });
    }
    
  } catch (error) {
    console.error('Error in award-free-credit API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      awarded: false,
      creditsAwarded: 0
    }, { status: 500 });
  }
}
