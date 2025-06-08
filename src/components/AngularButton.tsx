"use client";

import React from 'react';
import Link from 'next/link';
import ClickIcon from './ClickIcon';

interface AngularButtonProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  bgColor?: string;
  borderColor?: string;
  buttonWidth?: string;
  buttonHeight?: string;
  textColor?: string;
  isLoading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
}

export default function AngularButton({ 
  href = "#",
  className = '', 
  children, 
  bgColor = 'from-yellow-500 to-orange-500',
  borderColor = 'from-slate-400 to-slate-500',
  buttonWidth = 'auto',
  buttonHeight = 'auto',
  textColor = 'text-black',
  isLoading = false,
  loadingText = 'LOADING',
  disabled = false,
  onClick,
  type
}: AngularButtonProps) {
  
  const isDisabled = disabled || isLoading;
  const opacity = isDisabled ? 'opacity-60' : 'opacity-80';
  
  // Handle button or link rendering
  const renderContent = () => (
    <div className="relative group" style={{ height: buttonHeight }}>
      {/* Outer border glow */}
      <div
        className={`absolute -inset-[4px] bg-gradient-to-r ${borderColor} opacity-40`}
        style={{
          clipPath: "polygon(0% 10px, 10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px))"
        }}
      ></div>
      
      {/* Main background with gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${bgColor} ${opacity}`}
        style={{
          clipPath: "polygon(0% 9px, 9px 0%, calc(100% - 9px) 0%, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0% calc(100% - 9px))"
        }}
      ></div>

      {/* Inset highlights on all sides */}
      <div className={`absolute inset-[2px] opacity-0 ${isDisabled ? '' : 'group-hover:opacity-30'} transition-opacity duration-200 bg-white`}
        style={{
          clipPath: "polygon(0% 10px, 10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px))"
        }}
      ></div>
      
      {/* Button content */}
      <div 
        className={`py-3 relative px-2 flex items-center justify-center ${textColor} font-bold tracking-wider uppercase z-10 transition-transform duration-200 ${isDisabled ? '' : 'group-hover:scale-[1.03]'} text-3xl md:text-4xl`}
        style={{
          clipPath: "polygon(0% 12px, 12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px))",
          textShadow: "0 1px 0 rgba(255,255,255,0.3)",
          height: '100%',
          width: '100%'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-t-2 border-b-2 border-current rounded-full animate-spin mr-2"></div>
            <span className="text-2xl">{loadingText}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1">
            {(() => {
              // Get text content to check if we should show the icon
              const childText = typeof children === 'string' ? children : 
                               React.isValidElement(children) && typeof children.props.children === 'string' ? children.props.children :
                               children?.toString() || '';
              
              // Only show icon for text containing "proceed", not for "START CHALLENGE" or "proceed to vault"
              const shouldShowIcon = childText.toLowerCase().includes('proceed') && 
                                    !childText.toLowerCase().includes('start challenge') &&
                                    !childText.toLowerCase().includes('proceed to vault');
              
              if (shouldShowIcon && childText.includes('[') && childText.includes(']')) {
                const parts = childText.split(']');
                if (parts.length >= 2) {
                  return (
                    <>
                      <span>{parts[0]}</span>
                      <ClickIcon size={28} className="text-current mx-1" />
                      <span>]{parts.slice(1).join(']')}</span>
                    </>
                  );
                }
              }
              
              if (shouldShowIcon) {
                return (
                  <>
                    {children}
                    <ClickIcon size={28} className="text-current ml-2" />
                  </>
                );
              }
              
              // No icon for START CHALLENGE, proceed to vault, or other text
              return children;
            })()}
          </div>
        )}
      </div>
      
      {/* Hover effect overlay */}
      {!isDisabled && (
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${bgColor.replace('500', '400')} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          style={{
            clipPath: "polygon(0% 12px, 12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px))"
          }}
        ></div>
      )}
    </div>
  );
  
  // Render as button or link based on props
  if (type || onClick) {
    return (
      <button 
        type={type || 'button'} 
        className={`relative px-2 inline-block ${className}`} 
        style={{ width: buttonWidth }}
        onClick={!isDisabled ? onClick : undefined}
        disabled={isDisabled}
      >
        {renderContent()}
      </button>
    );
  }
  
  // Default render as link
  return (
    <Link 
      href={isDisabled ? '#' : href}
      className={`relative px-2 inline-block ${className} ${isDisabled ? 'pointer-events-none' : ''}`} 
      style={{ width: buttonWidth }}
      onClick={isDisabled ? (e) => e.preventDefault() : undefined}
    >
      {renderContent()}
    </Link>
  );
} 