import { NextRequest, NextResponse } from 'next/server';
import { createTransaction, getTransactions, getUserIdFromWallet } from '@/lib/server/db';

// GET: List transactions (filterable by user, vault)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const vaultId = searchParams.get('vault_id');
  const walletAddress = searchParams.get('wallet_address');

  try {
    let filters: { userId?: number; vaultId?: number } = {};

    // If wallet address is provided, get the user ID
    if (walletAddress) {
      const foundUserId = await getUserIdFromWallet(walletAddress);
      if (foundUserId) {
        filters.userId = foundUserId;
      } else {
        return NextResponse.json({ error: 'User not found for the provided wallet address' }, { status: 404 });
      }
    } else if (userId) {
      filters.userId = Number(userId);
    }

    if (vaultId) {
      filters.vaultId = Number(vaultId);
    }

    const transactions = await getTransactions(filters);
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST: Record new transaction
export async function POST(request: NextRequest) {
  try {
    const transactionData = await request.json();
    
    // Validate required fields
    if (!transactionData.user_id && !transactionData.wallet_address) {
      return NextResponse.json({ error: 'User ID or wallet address is required' }, { status: 400 });
    }
    
    if (typeof transactionData.amount !== 'number' || transactionData.amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    
    if (!transactionData.transaction_type) {
      return NextResponse.json({ error: 'Transaction type is required' }, { status: 400 });
    }
    
    // If wallet address is provided, get user ID
    if (transactionData.wallet_address && !transactionData.user_id) {
      const userId = await getUserIdFromWallet(transactionData.wallet_address);
      
      if (!userId) {
        return NextResponse.json({ error: 'User not found for the provided wallet address' }, { status: 404 });
      }
      
      transactionData.user_id = userId;
      delete transactionData.wallet_address;
    }
    
    const transaction = await createTransaction(transactionData);
    
    if (!transaction) {
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}