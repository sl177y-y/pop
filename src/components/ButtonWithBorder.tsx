import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ButtonWithBorderProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
}

export default function ButtonWithBorder({ href, children, className = '', onClick, target, rel }: ButtonWithBorderProps) {
  const [buttonWidth, setButtonWidth] = useState(105);
  const textRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (textRef.current) {
      // Get text width and add padding
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(105, textWidth + 30); // Minimum width of 105px, padding of 30px
      setButtonWidth(newWidth);
    }
  }, [children]);

  return (
    <Link href={href} className={`relative inline-block ${className}`} onClick={onClick} target={target} rel={rel}>
      <div className="relative min-w-[105px] h-[30px] flex items-center justify-center">
        <svg 
          width={buttonWidth} 
          height="30" 
          viewBox={`0 0 ${buttonWidth} 30`} 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full"
        >
          <path 
            d={`M${buttonWidth - 0.5} 25.2568L${buttonWidth - 0.616} 25.3955L${buttonWidth - 3.904} 29.3213L${buttonWidth - 4.054} 29.5H4.28223L4.13379 29.333L0.626953 25.4082L0.5 25.2656V4.73438L0.626953 4.5918L4.13379 0.666992L4.28223 0.5H${buttonWidth - 4.054}L${buttonWidth - 3.904} 0.678711L${buttonWidth - 0.616} 4.60449L${buttonWidth - 0.5} 4.74316V25.2568Z`} 
            stroke="white"
          />
        </svg>
        <div className="px-5 py-2 relative z-10 w-full h-full flex items-center justify-center">
          <span 
            ref={textRef} 
            style={{ fontSize: '17px' }} 
            className="text-white font-medium uppercase tracking-wider hover:text-white transition-colors duration-200"
          >
            {children}
          </span>
        </div>
      </div>
    </Link>
  );
} 