import React from 'react';

export const Logo = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative mb-3 flex items-center justify-center">
        {/* SVG representation of the ship wheel and compass */}
        <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Rope */}
          <circle cx="100" cy="100" r="75" stroke="#1E3A8A" strokeWidth="12" strokeDasharray="8 4" fill="#48C4D3" />
          
          {/* Wheel Handles */}
          <path d="M100 10 L100 25 M100 175 L100 190 M10 100 L25 100 M175 100 L190 100 M36 36 L47 47 M153 153 L164 164 M36 164 L47 153 M164 36 L153 47" stroke="#1E3A8A" strokeWidth="6" strokeLinecap="round" />
          
          {/* Inner Rings */}
          <circle cx="100" cy="100" r="60" stroke="#1E3A8A" strokeWidth="4" fill="none" />
          <circle cx="100" cy="100" r="50" stroke="#1E3A8A" strokeWidth="2" fill="none" />
          
          {/* Compass Star */}
          <path d="M100 30 L115 85 L170 100 L115 115 L100 170 L85 115 L30 100 L85 85 Z" fill="#48C4D3" stroke="#1E3A8A" strokeWidth="4" strokeLinejoin="round" />
          <path d="M100 30 L100 170 M30 100 L170 100" stroke="#1E3A8A" strokeWidth="2" />
          
          {/* Center Circle */}
          <circle cx="100" cy="100" r="12" fill="#1E3A8A" />
          <circle cx="100" cy="100" r="6" fill="#48C4D3" />
        </svg>
      </div>
      
      <div className="flex items-center justify-between w-full max-w-[140px] text-[#1E3A8A] text-[10px] font-medium tracking-widest mb-1">
        <span>SINCE</span>
        <span>2026</span>
      </div>
      
      <h1 className="text-4xl font-display font-black text-[#1E3A8A] tracking-tighter leading-none mb-1" style={{ transform: 'scaleY(1.3)' }}>
        WAYFINDER
      </h1>
      
      <div className="text-[#64748B] text-[9px] font-bold tracking-[0.15em] uppercase mt-2">
        DRIVEN BY ADVENTURE
      </div>
    </div>
  );
};

