import React from 'react';

export const Logo = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative mb-3 flex items-center justify-center">
        {/* New logo design based on user input */}
        <svg width="150" height="150" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Rope/Wheel */}
          <circle cx="100" cy="100" r="85" stroke="#1E3A8A" strokeWidth="10" fill="#2563EB" />
          <circle cx="100" cy="100" r="75" stroke="#48C4D3" strokeWidth="8" fill="none" />
          
          {/* Wheel Handles */}
          <path d="M100 15 L100 35 M100 165 L100 185 M15 100 L35 100 M165 100 L185 100" stroke="#1E3A8A" strokeWidth="12" strokeLinecap="round" />
          
          {/* Compass Star */}
          <path d="M100 40 L115 85 L160 100 L115 115 L100 160 L85 115 L40 100 L85 85 Z" fill="#48C4D3" stroke="#1E3A8A" strokeWidth="4" />
          
          {/* Center */}
          <circle cx="100" cy="100" r="15" fill="#1E3A8A" />
          <circle cx="100" cy="100" r="8" fill="#48C4D3" />
        </svg>
      </div>
      
      <div className="flex items-center justify-between w-full max-w-[160px] text-[#1E3A8A] text-[12px] font-bold tracking-widest mb-1">
        <span>SINCE</span>
        <span>2026</span>
      </div>
      
      <h1 className="text-5xl font-display font-black text-[#1E3A8A] tracking-tighter leading-none mb-1">
        WAYFINDER
      </h1>
      
      <div className="text-[#1E3A8A] text-[10px] font-bold tracking-[0.2em] uppercase mt-2">
        DRIVEN BY ADVENTURE
      </div>
    </div>
  );
};

