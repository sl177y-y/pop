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
}

export default function StartButton({
  href,
  children,
  className = '',
  onClick,
  disabled = false,
  imageSrc = '/vaultstart.png',
  imageClassName = '' // Add this line with default value
}: StartButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="relative min-w-[160px] md:min-w-[220px] h-[52px] md:h-[70px] flex items-center justify-center">
          <Image
            src={imageSrc}
            alt="Start Button"
            width={160}
            height={52}
            className={`absolute inset-0 w-full h-full object-contain ${disabled ? 'grayscale' : ''} md:w-[220px] md:h-[70px] ${imageClassName}`}
            priority
          />
          <div className="px-6 py-2 relative z-10 w-full h-full flex items-center justify-center">
            <span className="text-white font-bold uppercase tracking-wider transition-colors duration-200 text-xl">
              {!isProcessing && children}
              {isProcessing && (
                <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
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