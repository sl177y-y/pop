'use client';

import React from 'react';
import { MousePointerClick } from 'lucide-react';

interface ClickIconProps {
  className?: string;
  size?: number;
}

export default function ClickIcon({ className = '', size = 24 }: ClickIconProps) {
  return (
    <MousePointerClick 
      size={size} 
      className={`animate-pulse ${className}`}
    />
  );
} 