"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WalletStatus } from "@/components/WalletStatus";
import { useMobileDetect } from "@/lib/mobileDetectStore";

interface BorderFrameProps {
  children: React.ReactNode;
  vaultId?: string | null;
}

export default function BorderFrame({ children, vaultId: vaultIdProp }: BorderFrameProps) {
  // Use the global mobile detection instead of local state
  const { isMobile } = useMobileDetect();
  const pathname = usePathname();
  const isLandingPage = pathname === "/" || pathname === "";
  const isChatPage = pathname === "/chat";
  const isVerifyPage = pathname === "/verify";
  
  // State for localStorage value
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  
  // Effect to get localStorage value on client side
  useEffect(() => {
    console.log('useEffect running...');
    if (typeof window !== 'undefined') {
      // The correct key is 'selectedVaultId' as used in verify page
      const vault = localStorage.getItem('selectedVaultId');
      setSelectedVault(vault);
      
      console.log('Debug - pathname:', pathname);
      console.log('Debug - selectedVaultId from localStorage:', vault);
      console.log('Debug - isVerifyPage:', pathname === "/verify");
      console.log('Debug - vault === "113":', vault === '113');
    }
  }, [pathname]); // Re-run when pathname changes
  
  // Additional effect to listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined') {
        const vault = localStorage.getItem('selectedVaultId');
        console.log('Storage changed - selectedVaultId:', vault);
        setSelectedVault(vault);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Check if we should hide Yellow Cure and use colored grid
  const shouldHideYellowCure = isVerifyPage && (selectedVault === '113' || selectedVault === '114');
  const shouldUseBluGrid = isVerifyPage && selectedVault === '113';
  const shouldUseGreenGrid = isVerifyPage && selectedVault === '114';
  
  console.log('Debug - Final values:');
  console.log('  pathname:', pathname);
  console.log('  isVerifyPage:', isVerifyPage);
  console.log('  selectedVault:', selectedVault);
  console.log('  shouldHideYellowCure:', shouldHideYellowCure);
  console.log('  shouldUseBluGrid:', shouldUseBluGrid);
  console.log('  shouldUseGreenGrid:', shouldUseGreenGrid);

  return (
    <div className="!h-screen relative overflow-hidden flex flex-col">
      {/* SVG filter for sharpening video */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="sharpen">
          <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" divisor="1" preserveAlpha="true" />
        </filter>
      </svg>
      {/* Amber background image */}
      {/* <Image 
        src="/landingbggrid.png" 
        alt="Amber Background" 
        fill 
        className="object-cover" 
       
        priority 
      /> */}

      {/* Frame border overlay */}
      <div className="absolute inset-1 md:inset-0 z-20 pointer-events-none hidden md:block">
        <Image 
          src={
            (isChatPage || isVerifyPage) && selectedVault === "113" 
              ? "/dfusion/borderrm.png" 
              : (isChatPage || isVerifyPage) && selectedVault === "114" 
                ? "/PAI/borderrmg.jpg" 
                : isChatPage 
                  ? "/borderrm.png" 
                  : "/border2.png"
          }
          alt="Frame Border" 
          fill 
          className="object-fill"
          style={{ 
            mixBlendMode: 'normal',
            opacity: 100
          }}
          priority 
        />
      </div>

      {/* Centered border background image */}
      <div className="fixed inset-0 flex items-center justify-center z-10 pointer-events-none" style={{ alignItems: 'flex-start', top: isMobile ? '-8vh' : '0' }}>
        <Image
          src={isMobile ? "/borderbgmobile.png" : "/borderbg.png"}
          alt="Border Background"
          width={isMobile ? 600 : 900}
          height={isMobile ? 600 : 900}
          className="object-contain transition-all duration-300"
          priority
          style={{
            maxWidth: isMobile ? '90vw' : '70vw',
            maxHeight: isMobile ? '60vh' : '80vh',
            minWidth: isMobile ? '200px' : '400px',
            minHeight: isMobile ? '200px' : '400px',
          }}
        />
      </div>

      {/* Mobile frame border overlay */}
      {isMobile && isLandingPage && (
        <div className="fixed inset-0 z-20 pointer-events-none block md:hidden w-screen h-screen">
          <div className="absolute inset-x-2 inset-y-2 w-[calc(100%-16px)] h-[calc(100%-16px)]">
            <Image 
              src="/mobileborder.png" 
              alt="Mobile Frame Border" 
              fill 
              sizes="100vw"
              className="object-fill"
              style={{ 
                position: 'absolute',
                width: '100%',
                height: '100%'
              }}
              priority 
            />
          </div>
        </div>
      )}
      
      {/* Header */}
      <Navbar />

      {/* Grid background with CSS */}
      {!isChatPage && (
        <div className={`${isMobile ? 'fixed' : 'absolute'} inset-0 z-[25] pointer-events-none mx-0 mb-8`}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full h-full relative overflow-hidden">
              <div className="absolute inset-0 opacity-100" style={{
                backgroundImage: `linear-gradient(to right, ${
                  shouldUseBluGrid 
                    ? 'rgba(0, 123, 255, 0.7)' 
                    : shouldUseGreenGrid 
                      ? 'rgba(34, 197, 94, 0.7)' 
                      : 'rgba(255, 204, 0, 0.7)'
                } 1px, transparent 1px), linear-gradient(to bottom, ${
                  shouldUseBluGrid 
                    ? 'rgba(0, 123, 255, 0.7)' 
                    : shouldUseGreenGrid 
                      ? 'rgba(34, 197, 94, 0.7)' 
                      : 'rgba(255, 204, 0, 0.7)'
                } 1px, transparent 1px)`,
                backgroundSize: isMobile ? '30px 30px' : '50px 50px',
                transform: 'perspective(100px) rotateX(30deg) scale(2, 1.5)',
                transformOrigin: 'center bottom',
                animation: 'gridMove 25s linear infinite',
                clipPath: isMobile ? 'polygon(10% 0%, 90% 0%, 90% 100%, 10% 100%)' : 'polygon(20% 0%, 80% 0%, 80% 100%, 20% 100%)',
                opacity: 0.3
              }}>
              </div>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes gridMove {
              0% {
                background-position: 0px 0px;
              }
              100% {
                background-position: 0px 120px;
              }
            }
          `}} />
        </div>
      )}

      {/* Yellow Cure Image */}
      {!isChatPage && !shouldHideYellowCure && (
        <div className="absolute inset-0 z-[26] pointer-events-none flex items-end justify-center">
          <div className="relative w-full h-2/5 ">
            <Image 
              src="/yellowcurve.png" 
              alt="Yellow Cure" 
              fill 
              className="object-contain"
              priority 
              style={{
                opacity: 0.7
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 relative z-30 ${isMobile ? 'pt-20' : ''}`}>
        {children}
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}