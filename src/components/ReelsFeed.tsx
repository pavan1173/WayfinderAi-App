import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Bookmark, MapPin, Instagram, Video, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../store/AppContext';

interface Reel {
  id: string;
  platform: string;
  author: string;
  image: string;
  caption: string;
  likes: string;
  location: string;
  comments: string;
  isLiked: boolean;
}

export const ReelsFeed = ({ posts, onClose }: { posts: Reel[], onClose: () => void }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { savedReels, toggleSavedReel } = useApp();

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        setActiveIndex(index);
      }
    };
    containerRef.current?.addEventListener('scroll', handleScroll);
    return () => containerRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] bg-black">
      <button onClick={onClose} className="absolute top-6 left-6 z-10 text-white p-2 bg-black/50 rounded-full backdrop-blur-md">
        <X size={24} />
      </button>
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {posts.map((post) => (
          <div key={post.id} className="h-full w-full snap-start relative">
            <img src={post.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
              <div className="flex items-center gap-2 mb-2 drop-shadow-md">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-white/20">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}`} alt="avatar" />
                </div>
                <div className="text-white font-bold text-shadow-sm">{post.author}</div>
              </div>
              <div className="text-white text-sm mb-4 line-clamp-3 drop-shadow-md">{post.caption}</div>
              <div className="flex items-center gap-2 text-white/90 text-xs mb-6 drop-shadow-md font-medium">
                <MapPin size={14} /> {post.location}
              </div>
              <div className="absolute right-6 bottom-20 flex flex-col gap-6">
                <button className="flex flex-col items-center gap-1 text-white">
                  <Heart size={32} className={post.isLiked ? "fill-red-500 text-red-500" : ""} />
                  <span className="text-xs font-medium">{post.likes}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white">
                  <MessageCircle size={32} />
                  <span className="text-xs font-medium">{post.comments}</span>
                </button>
                <button 
                  onClick={() => toggleSavedReel(post.id)}
                  className="flex flex-col items-center gap-1 text-white"
                >
                  <Bookmark size={32} className={savedReels.includes(post.id) ? "fill-white text-white" : ""} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
