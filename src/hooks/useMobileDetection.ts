import { useEffect } from 'react';
import { useMobileDetect } from '@/lib/mobileDetectStore';

/**
 * Custom hook to initialize and handle mobile detection
 * This hook should be used in a root/layout component to ensure mobile detection
 * is properly initialized and updated when the window is resized
 */
export function useMobileDetection() {
  const { checkIfMobile } = useMobileDetect();

  useEffect(() => {
    // Initial check
    checkIfMobile();
    
    // Set up resize event handler
    const handleResize = () => {
      checkIfMobile();
    };
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Also check on orientation change for mobile devices
    window.addEventListener('orientationchange', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [checkIfMobile]);
} 