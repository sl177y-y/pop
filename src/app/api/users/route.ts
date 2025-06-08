import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateUser, getUserByWallet } from '@/lib/server/db';

// GET: Retrieve user profile by wallet address
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet_address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const user = await getUserByWallet(walletAddress);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// POST: Create or update user profile
export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();
    
    if (!userData.wallet_address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    const user = await createOrUpdateUser(userData);
    
    if (!user) {
      return NextResponse.json({ error: 'Failed to create or update user' }, { status: 500 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: 'Failed to create or update user' }, { status: 500 });
  }
}