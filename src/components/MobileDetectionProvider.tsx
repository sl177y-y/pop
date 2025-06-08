'use client';

import React from 'react';
import { useMobileDetection } from '@/hooks/useMobileDetection';

interface MobileDetectionProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that initializes mobile detection
 * for the entire application.
 */
export function MobileDetectionProvider({ children }: MobileDetectionProviderProps) {
  // Initialize mobile detection
  useMobileDetection();
  
  // This component doesn't render anything additional, just acts as a hook initializer
  return <>{children}</>;
} 