'use client';

import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BorderFrame from '@/components/BorderFrame';
import AngularButton from '@/components/AngularButton';
import { WalletConnect } from '@/components/WalletConnect';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useMobileDetect } from '@/lib/mobileDetectStore';
import { prefetchVaultAssets } from '@/utils/prefetch';

// Lazy load heavy components
const LazyMascotContainer = lazy(() => import('./MascotContainer'));

const WebView = ({ frame }) => (
  <div className="flex-1 flex flex-col md:flex-row items-center justify-between px-10 pt-0 pb-0 md:pt-0 md:px-12 relative z-30 -mt-2 md:-mt-2">
    {/* Text content container - Improved left alignment */}
    <div className="md:w-1/2 lg:w-[48%] z-30 text-center md:text-left md:ml-6 lg:ml-12">
      <h1
        className="text-white text-7xl md:text-8xl lg:text-[100px] leading-none"
        style={{ fontFamily: 'VT323, monospace', letterSpacing: '0.001em' }}
      >
        <span className="block">convince zura</span>
        <span className="block">to 
          <span 
            className="inline-block px-2" 
            style={{ 
              background: 'linear-gradient(to right, #FF6B00, #FF9900)', 
              WebkitBackgroundClip: 'text', 
              backgroundClip: 'text', 
              color: 'transparent' 
            }}
          > unlock</span>
        </span>
        <span className="block">the vault</span>
        <span className="block text-5xl md:text-6xl lg:text-8xl">win upto <span 
            className="inline-block px-2 " 
            style={{ 
              background: 'linear-gradient(to right, #FF6B00, #FF9900)', 
              WebkitBackgroundClip: 'text', 
              backgroundClip: 'text', 
              color: 'transparent' 
            }}
          > 10000$  </span></span>
      </h1>
      <WalletConnect redirectPath="/vault" checkExistingUser={true}>
        <AngularButton
          buttonWidth="320px"
          buttonHeight="50px"
          className="font-bold mt-1"
          href="#"
          isLoading={false}
        >
          [START CHALLENGE]
        </AngularButton>
      </WalletConnect>
      
      {/* Built over Aptos - improved alignment */}
      <div className="flex items-center justify-center md:justify-centre mx-auto md:mx-0 mt-4 text-white text-base md:text-2xl" style={{ maxWidth: "320px" }}>
        <span className="mr-2">Built over</span>
        <Image
          src="/Aptos_mark_WHT.png"
          alt="Aptos"
          width={32}
          height={32}
        />
      </div>
    </div>
    
    {/* Zura head container - Centered and sized better */}
    <Suspense fallback={<div className="flex justify-center items-center w-full xs:w-1/3 md:w-1/2 lg:w-[52%]">Loading...</div>}>
      <LazyMascotContainer frame={frame} isMobile={false} />
    </Suspense>
  </div>
);

const MobileView = ({ frame }) => (
  <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 px-6 pt-4 pb-0 md:pt-0 md:px-12 relative z-30 md:-mt-40">
    {/* Zura head container first - Centered and sized better for all devices */}
    <div className="mt-6 md:mt-0">
      <Suspense fallback={<div className="flex justify-center items-center w-full xs:w-1/3 md:w-1/2 lg:w-[52%]">Loading...</div>}>
        <LazyMascotContainer frame={frame} isMobile={true} />
      </Suspense>
    </div>

    {/* Text content container below mascot - Adjusted for tablet */}
    <div className="w-full md:w-1/2 lg:w-[48%] z-30 text-center md:text-left md:ml-6 lg:ml-12 py-0 md:py-0 -mt-18">
      <h1
        className="text-white text-4xl md:text-7xl lg:text-[100px] leading-tight"
        style={{ fontFamily: 'VT323, monospace', letterSpacing: '0.001em' }}
      >
        <span className="block">convince zura</span>
        <span className="block">to
          <span 
            className="inline-block px-2" 
            style={{ 
              background: 'linear-gradient(to right, #FF6B00, #FF9900)', 
              WebkitBackgroundClip: 'text', 
              backgroundClip: 'text', 
              color: 'transparent' 
            }}
          > unlock</span>
        </span>
        <span className="block">the vault</span>
        <span className="block text-3xl md:text-5xl lg:text-6xl">win upto <span 
            className="inline-block px-2" 
            style={{ 
              background: 'linear-gradient(to right, #FF6B00, #FF9900)', 
              WebkitBackgroundClip: 'text', 
              backgroundClip: 'text', 
              color: 'transparent' 
            }}
          > 10000$</span></span>
      </h1>
    </div>

    <div className="w-full md:w-1/2 lg:w-[48%] z-30 text-center md:text-left md:ml-6 lg:ml-12 mb-8">
      <WalletConnect redirectPath="/vault" checkExistingUser={true}>
        <AngularButton
          buttonWidth="70vw"
          buttonHeight="50px"
          className="font-bold mt-1 text-[10px] sm:text-xs md:text-sm"
          href="#"
          isLoading={false}
        >
          <span style={{ fontSize: '25px' }}>[START CHALLENGE]</span>
        </AngularButton>
      </WalletConnect>
      
      {/* Built over Aptos - improved alignment */}
      <div className="flex items-center justify-center mx-auto mt-8 text-white text-base md:text-lg" style={{ maxWidth: "70vw" }}>
        <span className="mr-2">Built over</span>
        <Image
          src="/Aptos_mark_WHT.png"
          alt="Aptos"
          width={32}
          height={32}
        />
      </div>
    </div>
  </div>
);

const frames = [
  { src: '/frames/1.webp', width: 850, height: 850 },
  { src: '/frames/2.webp', width: 850, height: 850 },
  { src: '/frames/3.webp', width: 850, height: 850 },
  // { src: '/frames/4.webp', width: 650, height: 650 },
];
export default function Home() {
  const [frame, setFrame] = useState(frames[0]);
  // Use the global mobile state from our store
  const { isMobile } = useMobileDetect();

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % frames.length;
      setFrame(frames[index]);
    }, 1000);

    // Prefetch vault page assets for smoother experience
    prefetchVaultAssets();

    return () => clearInterval(interval);
  }, []);

  return (
    <BorderFrame>
      {/* Prefetch the vault page route and related routes */}
      <Link href="/vault" prefetch={true} style={{ display: 'none' }} />
      <Link href="/verify" prefetch={true} style={{ display: 'none' }} />
      <Link href="/chat" prefetch={true} style={{ display: 'none' }} />
      
      {/* Main Content - Adjusted padding/margins */}
      {isMobile ? <MobileView frame={frame} /> : <WebView frame={frame} />}
    </BorderFrame>
  );
}
