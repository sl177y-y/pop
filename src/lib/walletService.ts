// API helpers
async function fetchUserByWallet(walletAddress: string) {
  const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return null;
  return res.json();
}

async function createOrUpdateUserAPI(userData: any) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Handles user registration/login when a wallet connects
 * @param walletAddress The user's wallet address
 * @returns The user object if successful, null otherwise
 */
export async function handleWalletConnection(walletAddress: string) {
  try {
    // Check if user already exists
    const existingUser = await fetchUserByWallet(walletAddress);
    if (existingUser) {
      // User exists, update last active time
      return await createOrUpdateUserAPI({
        wallet_address: walletAddress,
        credits: existingUser.credits,
        twitter: existingUser.twitter
      });
    } else {
      // Create new user with 0 credits - users must verify with Twitter to get credits
      return await createOrUpdateUserAPI({
        wallet_address: walletAddress,
        credits: 0, // Start with 0 credits
      });
    }
  } catch (error) {
    // console.error('Error handling wallet connection:', error);
    throw error;
  }
}

/**
 * Validates if a wallet address is in the correct format
 * @param address The wallet address to validate
 * @returns True if the address is valid, false otherwise
 */
export function isValidWalletAddress(address: string): boolean {
  // Basic validation - should be adjusted for actual blockchain format
  return Boolean(address) && address.length > 0 && address.startsWith('0x');
}