import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface StartButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  imageSrc?: string;
  imageClassName?: string;
  vaultType?: 'vault113' | 'vault114' | 'others';
}

// Define different dimensions for each vault type
const vaultDimensions = {
  vault113: {
    width: 140,
    height: 50,
    mdWidth: 210,
    mdHeight: 70,
    mobileWidth: 150,
    mobileHeight: 70
  },
  vault114: {
    width: 140,
    height: 50,
    mdWidth: 230,
    mdHeight: 90,
    mobileWidth: 140,
    mobileHeight: 85
  },
  others: {
    width: 120,
    height: 40,
    mdWidth: 220,
    mdHeight: 70,
    mobileWidth: 120,
    mobileHeight: 40
  }
};

export default function StartButton({
  href,
  children,
  className = '',
  onClick,
  disabled = false,
  imageSrc = '/vaultstart.png',
  imageClassName = '',
  vaultType = 'others'
}: StartButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get dimensions based on vault type
  const dimensions = vaultDimensions[vaultType];

  const handleClick = async (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    if (onClick) {
      e.preventDefault();

      if (isProcessing) return;

      setIsProcessing(true);
      setError(null);

      try {
        await onClick();
      } catch (err) {
        setError('Failed to start vault challenge. Please try again.');
        setTimeout(() => setError(null), 3000);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const disabledStyles = disabled ?
    'opacity-50 cursor-not-allowed' :
    'hover:brightness-110 transition-all duration-200';

  return (
    <div className="relative">
      <Link href={disabled ? '#' : href} className={`relative inline-block ${disabledStyles} ${className}`} onClick={handleClick}>
        <div 
          className="relative flex items-center justify-center transition-all duration-200"
          style={{
            '--mobile-width': `${dimensions.mobileWidth}px`,
            '--mobile-height': `${dimensions.mobileHeight}px`,
            '--desktop-width': `${dimensions.mdWidth}px`,
            '--desktop-height': `${dimensions.mdHeight}px`,
            minWidth: `var(--mobile-width)`,
            height: `var(--mobile-height)`
          } as React.CSSProperties & { [key: string]: string }}
        >
          <style>{`
            @media (min-width: 768px) {
              [style*="--mobile-width"] {
                min-width: var(--desktop-width) !important;
                height: var(--desktop-height) !important;
              }
            }
          `}</style>
          <Image
            src={imageSrc}
            alt="Start Button"
            width={dimensions.width}
            height={dimensions.height}
            className={`absolute inset-0 w-full h-full object-contain ${disabled ? 'grayscale' : ''} md:w-[${dimensions.mdWidth}px] md:h-[${dimensions.mdHeight}px] ${imageClassName}`}
            priority
          />
          <div className="px-4 py-1 md:px-6 md:py-2 relative z-10 w-full h-full flex items-center justify-center">
            <span className="text-white font-bold uppercase tracking-wider transition-colors duration-200 text-sm md:text-xl">
              {!isProcessing && children}
              {isProcessing && (
                <div className="w-4 h-4 md:w-5 md:h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
              )}
            </span>
          </div>
        </div>
      </Link>

      {error && (
        <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-red-600 text-white text-xs rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
