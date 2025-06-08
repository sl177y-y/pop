import Image from "next/image";
import Link from "next/link";
import ButtonWithBorder from "./ButtonWithBorder";
import { usePathname } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMobileDetect } from "@/lib/mobileDetectStore";
import { useState, useEffect } from "react";
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

export default function Navbar() {
  const pathname = usePathname();
  const { connected } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();
  const { isMobile } = useMobileDetect();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [whitepaperLink, setWhitepaperLink] = useState<string | null>(null);
  
  // Fetch vault data to get whitepaper link
  useEffect(() => {
    const fetchVaultData = async () => {
      const selectedVaultId = localStorage.getItem('selectedVaultId');
      if (selectedVaultId) {
        try {
          const res = await fetch(`/api/vaults?id=${selectedVaultId}`);
          if (res.ok) {
            const vault = await res.json();
            setWhitepaperLink(vault?.whitepaper_link || null);
          }
        } catch (error) {
          console.error('Error fetching vault data for whitepaper:', error);
        }
      } else {
        setWhitepaperLink(null);
      }
    };

    fetchVaultData();
  }, [pathname]); // Re-fetch when route changes
  
  // Supabase: Get user session
  useEffect(() => {
    const getUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    };
    getUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);
  
  // Check if we're on the verify page and user has connected Twitter (Supabase)
  const isVerifyPage = pathname === '/verify';
  const isTwitterConnected = !authLoading && user !== null; // Supabase check
  const showTwitterLogout = isVerifyPage && isTwitterConnected;

  // Handle Twitter logout (Supabase)
  const handleTwitterLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // console.error("Error signing out with Supabase:", error);
      }
    } catch (error) {
      // console.error("Error signing out with Supabase:", error);
    }
    // Close sidebar if open
    setSidebarOpen(false);
  };
  
  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);
  
  // Close sidebar when pressing Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
  
  // Prevent body scrolling when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);
  
  // Check if current page is the landing page
  const isLandingPage = pathname === '/';
  // Check if current page is vault or chat page
  const needsBlurredHeader = pathname.includes('/verify') || pathname.includes('/chat');
  const isChatPage = pathname === "/chat"; // Added for clarity
  
  // Check if device is tablet or mobile (under 769x1025)
  const [isTabletOrMobile, setIsTabletOrMobile] = useState(false);
  
  // Detect screen size on client side only
  useEffect(() => {
    const checkScreenSize = () => {
      setIsTabletOrMobile(window.innerWidth < 769 || window.innerHeight < 1025);
    };
    
    // Initial check
    checkScreenSize();
    
    // Add listener for window resize
    window.addEventListener('resize', checkScreenSize);
    
    // Clean up
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  return (
    <>
      <header
        className={`flex justify-between items-center px-4 md:px-20 pt-6 md:pt-10 z-40 w-full ${isMobile ? 'fixed top-0 left-0 bg-transparent' : 'relative'}`}
        style={isMobile ? { 
          minHeight: 64,
          ...(needsBlurredHeader || sidebarOpen ? {
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            boxShadow: '0 0 10px rgba(0,0,0,0.2)'
          } : {})
        } : {}}
      >
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/candylogo.png"
            alt="Candy Machine Logo"
            width={200}
            height={60}
            priority
          />
        </Link>
        
        {isChatPage && !isMobile && (
          <div className="flex-grow flex justify-center items-center">
            <h1
              className={`text-yellow-500 text-xl xs:text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center p-1`}
              style={{
                fontFamily: "vt323",
                textShadow: "0 0 10px rgba(255, 193, 7, 0.5)",
                letterSpacing: "0.04em",
                lineHeight: "1.2",
              }}
            >
              CONVINCE ZURA TO UNLOCK VAULT
            </h1>
          </div>
        )}
        
        {/* Desktop navigation */}
        <div className="hidden md:flex gap-3 md:gap-2 items-center">
          {connected && (
            <ButtonWithBorder href="/vault">
              VAULTS
            </ButtonWithBorder>
          )}
          
          <ButtonWithBorder href="https://cluster-protocol-content.notion.site/candy-machine" target="_blank" rel="noopener noreferrer">
            DOCS
          </ButtonWithBorder>
          
          {whitepaperLink && isVerifyPage && (
            <ButtonWithBorder href={whitepaperLink} target="_blank" rel="noopener noreferrer">
              {(() => {
                const selectedVaultId = localStorage.getItem('selectedVaultId');
                return selectedVaultId === '114' ? 'PAI3 Whitepaper' : 'dFusion AI Whitepaper';
              })()}
            </ButtonWithBorder>
          )}
          
          {showTwitterLogout && (
            <ButtonWithBorder 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                handleTwitterLogout();
              }}
            >
              LOGOUT
            </ButtonWithBorder>
          )}
        </div>
        
        {/* Hamburger menu for mobile */}
        <button 
          className="md:hidden z-[60] relative"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="transition-opacity hover:opacity-80"
          >
            <path 
              d="M3 12H21M3 6H21M3 18H21" 
              stroke="#FFD700" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      
      {/* Mobile sidebar */}
      {/* Backdrop overlay - visible when sidebar is open */}
      <div 
        className={`sidebar-overlay md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar content with animation classes */}
      <div className={`mobile-sidebar md:hidden ${sidebarOpen ? 'visible' : ''}`}>
        <div className="flex flex-col p-6 h-full">
          {/* Close button */}
          <div className="flex justify-end mb-8">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="text-white p-2 hover:opacity-80 transition-opacity"
              aria-label="Close menu"
            >
              <svg className="w-8 h-8" fill="none" stroke="#FFD700" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          {/* Navigation links */}
          <div className="flex flex-col gap-4">
            {connected && (
              <Link 
                href="/vault" 
                className="bg-transparent border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors duration-300 py-3 px-6 rounded text-center font-vt323 tracking-wide uppercase"
                onClick={() => setSidebarOpen(false)}
              >
                Projects
              </Link>
            )}
            
            <Link 
              href="https://cluster-protocol-content.notion.site/candy-machine" 
              className="bg-transparent border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors duration-300 py-3 px-6 rounded text-center font-vt323 tracking-wide uppercase"
              onClick={() => setSidebarOpen(false)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </Link>
            
            {whitepaperLink && isVerifyPage && (
              <Link 
                href={whitepaperLink} 
                className="bg-transparent border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors duration-300 py-3 px-6 rounded text-center font-vt323 tracking-wide uppercase"
                onClick={() => setSidebarOpen(false)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {(() => {
                  const selectedVaultId = localStorage.getItem('selectedVaultId');
                  return selectedVaultId === '114' ? 'PAI3 Whitepaper' : 'Whitepaper';
                })()}
              </Link>
            )}
            
            {showTwitterLogout && (
              <button
                onClick={handleTwitterLogout}
                className="bg-transparent border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors duration-300 py-3 px-6 rounded text-center font-vt323 tracking-wide uppercase"
              >
                Logout Twitter
              </button>
            )}
          </div>
          
          {/* Logo at bottom */}
          <div className="mt-auto mb-8 flex justify-center">
            <Image
              src="/candylogo.png"
              alt="Candy Machine Logo"
              width={150}
              height={45}
              priority
            />
          </div>
        </div>
      </div>
    </>
  );
}
