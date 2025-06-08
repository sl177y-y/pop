import { NextRequest, NextResponse } from 'next/server';
import { createVault, getVaultById, getVaults, updateVault } from '@/lib/server/db';
import { createClient } from '@/lib/server/supabase';

// GET: List all vaults or get details of specific vault
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vaultId = searchParams.get('id');

  try {
    if (vaultId) {
      // Get specific vault
      const vault = await getVaultById(Number(vaultId));
      
      if (!vault) {
        return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
      }
      
      return NextResponse.json(vault);
    } else {
      // Get all vaults
      const vaults = await getVaults();
      return NextResponse.json(vaults);
    }
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: 500 });
  }
}

// POST: Create new vault (admin only)
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = await req.json();
    
    // Extract data from request body
    const { name, total_prize, available_prize, vault_sponsor, sponsor_links, ai_prompt } = body;
    
    // Validate required fields
    if (!name || total_prize === undefined || available_prize === undefined || !ai_prompt) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert vault into Supabase
    const { data, error } = await supabase
      .from('vaults')
      .insert([
        { 
          name, 
          total_prize, 
          available_prize, 
          vault_sponsor, 
          sponsor_links, 
          ai_prompt 
        }
      ])
      .select();

    if (error) {
      console.error('Error creating vault:', error);
      return NextResponse.json(
        { message: 'Failed to create vault', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Vault created successfully', vault: data[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in vault creation API:', error);
    return NextResponse.json(
      { message: 'Server error', error: String(error) },
      { status: 500 }
    );
  }
}

// PUT: Update vault details (admin only)
export async function PUT(request: NextRequest) {
  try {
    const vaultData = await request.json();
    
    if (!vaultData.id) {
      return NextResponse.json({ error: 'Vault ID is required' }, { status: 400 });
    }
    
    const vaultId = Number(vaultData.id);
    
    // Check if vault exists
    const existingVault = await getVaultById(vaultId);
    
    if (!existingVault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    
    // Remove ID from update data
    const { id, ...updateData } = vaultData;
    
    const updatedVault = await updateVault(vaultId, updateData);
    
    if (!updatedVault) {
      return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
    }
    
    return NextResponse.json(updatedVault);
  } catch (error) {
    console.error('Error updating vault:', error);
    return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
  }
}