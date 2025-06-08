import { NextRequest, NextResponse } from 'next/server';
import { createConversation, getConversations, getUserIdFromWallet } from '@/lib/server/db';

// GET: Retrieve conversation history by user and vault
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const vaultId = searchParams.get('vault_id');
  const walletAddress = searchParams.get('wallet_address');

  try {
    let userIdForQuery: number | null = userId ? Number(userId) : null;
    
    // If wallet address is provided, get the user ID
    if (walletAddress && !userIdForQuery) {
      userIdForQuery = await getUserIdFromWallet(walletAddress);
      
      if (!userIdForQuery) {
        return NextResponse.json({ error: 'User not found for the provided wallet address' }, { status: 404 });
      }
    }
    
    if (!userIdForQuery) {
      return NextResponse.json({ error: 'User ID or wallet address is required' }, { status: 400 });
    }
    
    const vaultIdForQuery = vaultId ? Number(vaultId) : undefined;
    const conversations = await getConversations(userIdForQuery, vaultIdForQuery);
    
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST: Start a new conversation
export async function POST(request: NextRequest) {
  try {
    const { user_id, vault_id, wallet_address } = await request.json();
    
    let userIdForQuery = user_id;
    
    // If wallet address is provided, get the user ID
    if (wallet_address && !userIdForQuery) {
      userIdForQuery = await getUserIdFromWallet(wallet_address);
      
      if (!userIdForQuery) {
        return NextResponse.json({ error: 'User not found for the provided wallet address' }, { status: 404 });
      }
    }
    
    if (!userIdForQuery) {
      return NextResponse.json({ error: 'User ID or wallet address is required' }, { status: 400 });
    }
    
    if (!vault_id) {
      return NextResponse.json({ error: 'Vault ID is required' }, { status: 400 });
    }
    
    const conversation = await createConversation(userIdForQuery, Number(vault_id));
    
    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }
    
    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}