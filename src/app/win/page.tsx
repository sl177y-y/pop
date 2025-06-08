"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Confetti from 'react-confetti';
// import BorderFrame from '@/components/BorderFrame'; // BorderFrame removed as per new request

export default function WinPage() {
  const [showConfetti, setShowConfetti] = useState(false);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [prizeAmount, setPrizeAmount] = useState<string | null>(null);
  const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    setShowConfetti(true);

    const storedVaultName = localStorage.getItem('lastWonVaultName');
    const storedPrizeAmount = localStorage.getItem('lastWonPrizeAmount');
    const storedVaultId = localStorage.getItem('selectedVaultId');

    if (storedVaultName) setVaultName(storedVaultName);
    if (storedPrizeAmount) setPrizeAmount(storedPrizeAmount);
    if (storedVaultId) setCurrentVaultId(storedVaultId);

    // Generate the Twitter share URL with custom content
    const tweetText = `I did it fam.

 Fooled candy machine's AI vault @clusterprotocol over @aptos
and won real cash there.

If you dare to outcast AI, try it now to win pools of $10000`;
    const encodedText = encodeURIComponent(tweetText);
    setShareUrl(`https://twitter.com/intent/tweet?text=${encodedText}`);

    // Timer removed to allow indefinite confetti
    // const timer = setTimeout(() => setShowConfetti(false), 8000);
    // return () => clearTimeout(timer);
  }, []);

  // Function to copy image to clipboard
  const copyImageToClipboard = async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not supported');
      }

      const imageUrl = isVault114 ? '/PAI/shareonX.png' : '/winnig.png'; // Use vault 114 specific image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      
      // Check if ClipboardItem is supported
      if (typeof ClipboardItem === 'undefined') {
        throw new Error('ClipboardItem not supported');
      }
      
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });
      
      await navigator.clipboard.write([clipboardItem]);
      
      // Show success message
      alert('🎉 Victory image copied to clipboard! Now paste it in your tweet to show off your win!');
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      
      // Fallback: Try to open the image in a new tab for manual copy
      try {
        const fallbackImageUrl = isVault114 ? '/PAI/shareonX.png' : '/winnig.png'; // Use vault 114 specific image for fallback too
        const imageWindow = window.open(fallbackImageUrl, '_blank');
        if (imageWindow) {
          alert('📷 Image opened in new tab! Right-click the image and select "Copy image" to add it to your tweet.');
        } else {
          alert('❌ Unable to copy image automatically. Please navigate to your site and find the winning image to share manually.');
        }
      } catch (fallbackError) {
        alert('❌ Clipboard not supported in your browser. Please save the winning image manually and attach it to your tweet.');
      }
    }
  };

  // Function to handle share with image copy
  const handleShareWithImage = async () => {
    await copyImageToClipboard();
    // Open Twitter share after copying image
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const isVault113 = currentVaultId === '113';
  const isVault114 = currentVaultId === '114';

  // Conditional page background style
  const pageStyle = isVault113 ? {
    backgroundImage: "url('/dfusion/borderrm.png')",
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : isVault114 ? {
    backgroundImage: "url('/PAI/borderrmg.jpg')", // Using vault 114 green background
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : {}; // Default will be handled by Tailwind class if not vault 113 or 114

  const cardClasses = isVault113 
    ? 'bg-black bg-opacity-80 p-8 md:p-12 rounded-xl shadow-2xl border-2 border-blue-500' 
    : isVault114
    ? 'bg-black bg-opacity-80 p-8 md:p-12 rounded-xl shadow-2xl border-2 border-green-500'
    : 'bg-gray-900 bg-opacity-70 p-8 md:p-12 rounded-xl shadow-2xl border border-yellow-500';

  const cardGlowStyle = isVault113 ? {
    boxShadow: '0 0 25px 5px rgba(26, 86, 203, 0.7), 0 0 40px 10px rgba(26, 86, 203, 0.5)',
  } : isVault114 ? {
    boxShadow: '0 0 25px 5px rgba(34, 197, 94, 0.7), 0 0 40px 10px rgba(34, 197, 94, 0.5)', // Green glow for vault 114
  } : {};

  const titleTextColor = isVault113 ? 'text-blue-300' : isVault114 ? 'text-green-300' : 'text-yellow-400';
  const textColor = isVault113 ? 'text-blue-200' : isVault114 ? 'text-green-200' : 'text-white';
  const prizeTextColor = isVault113 ? 'text-cyan-400' : isVault114 ? 'text-green-400' : 'text-green-400';
  
  const buttonBaseClasses = 'font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105';
  const button1Classes = isVault113 
    ? `${buttonBaseClasses} bg-black text-blue-300 border-2 border-blue-500 hover:bg-blue-900 hover:text-white` 
    : isVault114
    ? `${buttonBaseClasses} bg-black text-green-300 border-2 border-green-500 hover:bg-green-900 hover:text-white`
    : `${buttonBaseClasses} bg-yellow-500 hover:bg-yellow-600 text-black`;
  const button2Classes = isVault113 
    ? `${buttonBaseClasses} bg-black text-blue-300 border-2 border-blue-500 hover:bg-blue-900 hover:text-white flex items-center justify-center` 
    : isVault114
    ? `${buttonBaseClasses} bg-black text-green-300 border-2 border-green-500 hover:bg-green-900 hover:text-white flex items-center justify-center`
    : `${buttonBaseClasses} bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center`;

  const mascotImage = isVault113 ? '/dfusion/mascoty.png' : isVault114 ? '/PAI/fullgreen.png' : '/zoravault.png';
  const titleFontFamily = isVault113 ? "'Clash Display', monospace" : isVault114 ? "'Fira Code', monospace" : "VT323, monospace";
  const textFontFamily = isVault113 ? "'Clash Display', monospace" : isVault114 ? "'Fira Code', monospace" : "VT323, monospace";
  
  // Conditional logo: Use candylogo.png for vault 113, otherwise default (which is also candylogo.png)
  const logoImage = isVault113 ? "/candylogo.png" : "/candylogo.png";
  const logoAlt = isVault113 ? "Candy Machine Logo" : "Candy Machine Logo"; // Alt text matches the logo
  const logoWidth = 150; // Standard candylogo width
  const logoHeight = 45; // Standard candylogo height
  // Footer variables removed by user, so not re-adding them here.

  return (
    // BorderFrame removed, pageStyle applied to this div
    <div 
      className={`min-h-screen text-white flex flex-col items-center justify-center p-4 relative overflow-hidden ${!isVault113 && !isVault114 ? 'bg-black' : ''}`}
      style={pageStyle} 
    >
      {showConfetti && <Confetti recycle={true} numberOfPieces={isVault113 ? 350 : isVault114 ? 350 : 250} colors={isVault113 ? ['#00AEEF', '#28ABE3', '#0072CE', '#58C9F3', '#FFFFFF'] : isVault114 ? ['#22C55E', '#16A34A', '#15803D', '#65A30D', '#FFFFFF'] : undefined} />}
      
      <div className="absolute top-13 left-20 z-20"> {/* Adjusted logo positioning */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src={logoImage}
            alt={logoAlt}
            width={logoWidth}
            height={logoHeight}
            priority
          />
        </Link>
      </div>

      <main 
        className={`text-center z-10 ${cardClasses} ${textColor}`}
        style={cardGlowStyle}
      >
        <Image
          src={mascotImage}
          alt={isVault113 ? "dFusion Mascot" : "Zora Mascot"} // Updated alt for non-113 mascot
          width={isVault113 ? 180 : 200}
          height={isVault113 ? 180 : 200}
          className="mx-auto mb-6 rounded-lg"
          unoptimized={!isVault113} // zoravault.png likely not a GIF
        />
        <h1 
          className={`text-4xl md:text-6xl font-bold mb-4 ${titleTextColor}`}
          style={{ fontFamily: titleFontFamily, textShadow: `0 0 10px ${isVault113 ? 'rgba(0, 191, 255, 0.7)' : isVault114 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(255, 223, 0, 0.7)'}` }}
        >
          CONGRATULATIONS!
        </h1>
        
        <p className={`text-xl md:text-2xl mb-3`} style={{ fontFamily: textFontFamily }}>
          You've successfully unlocked the {vaultName || 'vault'}!
        </p>
        
        {prizeAmount && (
          <p className={`text-2xl md:text-3xl ${prizeTextColor} mb-6`} style={{ fontFamily: textFontFamily }}>
            You've won ${prizeAmount}!
          </p>
        )}
        
        <p className={`text-lg md:text-xl mb-8`} style={{ fontFamily: textFontFamily }}>
          Your triumph has been recorded in the annals of the Candy Machine.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/vault"
            className={button1Classes}
            style={{ fontFamily: textFontFamily }}
          >
            Explore More Vaults
          </Link>
          <button
            onClick={handleShareWithImage}
            className={button2Classes}
            style={{ fontFamily: textFontFamily }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
        </div>
      </main>

      {/* Footer JSX was removed by user, so not re-adding it here */}
    </div>
  );
} 