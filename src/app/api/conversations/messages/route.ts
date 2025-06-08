import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getMessages } from '@/lib/server/db';

// GET: Retrieve messages for a conversation
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversation_id');

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
  }

  try {
    const messages = await getMessages(Number(conversationId));
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST: Add a message to a conversation
export async function POST(request: NextRequest) {
  try {
    const messageData = await request.json();
    
    if (!messageData.conversation_id) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    
    if (!messageData.content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }
    
    if (!messageData.role || !['user', 'assistant', 'system'].includes(messageData.role)) {
      return NextResponse.json({ error: 'Valid role is required (user, assistant, or system)' }, { status: 400 });
    }
    
    const message = await addMessage(messageData);
    
    if (!message) {
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }
    
    return NextResponse.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}