import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Coffee, Utensils, Camera, Landmark, Bed, ShoppingBag, Music } from 'lucide-react';

const icons = [
  <Landmark className="text-brand" />,
  <MapPin className="text-emerald-500" />,
  <Music className="text-purple-500" />,
  <Coffee className="text-amber-600" />,
  <Bed className="text-blue-500" />,
  <Camera className="text-rose-500" />,
  <ShoppingBag className="text-orange-500" />,
  <Utensils className="text-slate-700" />
];

export const DetectingAnimation = ({ text = "Detecting...", className = "py-12" }: { text?: string, className?: string }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % icons.length);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-8 ${className}`}>
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 border-4 border-slate-100 rounded-[2rem]" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="absolute inset-0 border-4 border-t-brand border-r-transparent border-b-transparent border-l-transparent rounded-[2rem]"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 20 }}
              className="scale-[2]"
            >
              {icons[index]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xl font-bold text-slate-800">{text}</div>
        <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-1/2 h-full bg-brand rounded-full"
          />
        </div>
      </div>
    </div>
  );
};
