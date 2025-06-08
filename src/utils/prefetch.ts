// Utility function to prefetch images
export const prefetchImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Utility function to prefetch multiple images
export const prefetchImages = async (imageSources: string[]): Promise<void> => {
  try {
    await Promise.all(imageSources.map(src => prefetchImage(src)));
    // console.log('All images prefetched successfully');
  } catch (error) {
    // console.warn('Some images failed to prefetch:', error);
  }
};

// Vault page assets to prefetch
export const VAULT_PAGE_ASSETS = [
  // Vault page specific assets
  '/vaultborder.png',
  '/3.png',
  '/lock.webp',
  '/vaultcardborder.webp',
  '/ring.png',
  '/panel.png',
  '/machine.png',
  '/chatvault.png',
  '/gptvault.png',
  '/zoravault.png',
  '/beravault.png',
  '/basevault.png',
  '/candylogo.png',
  '/holdlogo.png',
  '/stakedlogo.png',
  '/telegramlogo.png',
  // Chat page assets
  '/button.png',
  // Verify page assets - using optimized WebP
  '/HUD.webp',
  '/xlogo.png',
  '/green tick.png',
  // Additional common assets
  '/selectedverifybtnbg.png',
  '/unselectedverifybtnbg.png',
  '/chatbg.png',
  '/msgbg.png',
  '/sendbtnbg.png'
];

// Verify page specific assets
export const VERIFY_PAGE_ASSETS = [
  '/HUD.webp',
  '/xlogo.png',
  '/green tick.png',
  '/selectedverifybtnbg.png',
  '/unselectedverifybtnbg.png',
  '/telegramlogo.png',
  '/candylogo.png',
  '/holdlogo.png',
  '/stakedlogo.png',
  // Common assets that might be used
  '/vaultborder.png',
  '/3.png'
];

// Chat page specific assets
export const CHAT_PAGE_ASSETS = [
  '/chatbg.png',
  '/msgbg.png',
  '/sendbtnbg.png',
  '/button.png',
  '/vaultborder.png',
  '/3.png'
];

// Function to prefetch all vault page assets
export const prefetchVaultAssets = () => {
  prefetchImages(VAULT_PAGE_ASSETS);
};

// Function to prefetch verify page assets
export const prefetchVerifyAssets = () => {
  prefetchImages(VERIFY_PAGE_ASSETS);
};

// Function to prefetch chat page assets
export const prefetchChatAssets = () => {
  prefetchImages(CHAT_PAGE_ASSETS);
}; 