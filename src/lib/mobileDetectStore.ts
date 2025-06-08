import { create } from 'zustand'

interface MobileDetectState {
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
  checkIfMobile: () => void;
}

// The standard breakpoint for mobile across the app is 768px
const MOBILE_BREAKPOINT = 768;

export const useMobileDetect = create<MobileDetectState>((set) => ({
  isMobile: false, // Default to false to avoid hydration issues
  
  setIsMobile: (isMobile: boolean) => set({ isMobile }),
  
  checkIfMobile: () => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      set({ isMobile: window.innerWidth < MOBILE_BREAKPOINT });
    }
  }
}));

// Optional: Subscribe to store changes if needed
// useMobileDetect.subscribe((state) => {
//   console.log('Mobile state changed:', state.isMobile);
// }); 