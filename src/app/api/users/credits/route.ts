import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits, updateUserCredits } from '@/lib/server/db';

// GET: Get user credit balance
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet_address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const credits = await getUserCredits(walletAddress);
    return NextResponse.json({ credits });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}

// POST: Add/remove credits
export async function POST(request: NextRequest) {
  try {
    const { wallet_address, amount, operation } = await request.json();
    
    if (!wallet_address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    
    if (operation !== 'add' && operation !== 'subtract') {
      return NextResponse.json({ error: 'Operation must be add or subtract' }, { status: 400 });
    }
    
    const newBalance = await updateUserCredits(wallet_address, amount, operation);
    
    if (newBalance === null) {
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }
    
    return NextResponse.json({ credits: newBalance });
  } catch (error) {
    console.error('Error updating credits:', error);
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
  }
}