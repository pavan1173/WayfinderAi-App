import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Bookmark, MapPin, Instagram, Video, X, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { geminiService } from '../services/geminiService';
import { useToast } from '../store/ToastContext';

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
  const [isDoubleTapping, setIsDoubleTapping] = useState(false);
  const lastTap = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { savedReels, toggleSavedReel, addSavedSpots } = useApp();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveLocation = async (location: string) => {
    setIsSaving(true);
    try {
      const spots = await geminiService.extractSpotsFromText(location);
      if (spots.length > 0) {
        addSavedSpots(spots);
        showToast(`Saved ${spots[0].name} to your spots!`);
      } else {
        showToast("Could not find a specific spot in this location.");
      }
    } catch (error) {
      showToast("Failed to save location.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTap = (post: Reel) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      if (!post.isLiked) {
        // Toggle like logic here
        setIsDoubleTapping(true);
        setTimeout(() => setIsDoubleTapping(false), 1000);
      }
    }
    lastTap.current = now;
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black">
      <button onClick={onClose} className="absolute top-6 left-6 z-10 text-white p-2 bg-black/20 rounded-full backdrop-blur-md">
        <X size={24} />
      </button>
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {posts.map((post) => (
          <div key={post.id} className="h-full w-full snap-start relative" onClick={() => handleTap(post)}>
            <img 
              src={post.image} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/travel/600/800'; }}
            />
            {isDoubleTapping && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Heart size={100} className="text-red-500 fill-red-500" />
              </motion.div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-6 flex flex-col justify-end">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white/20">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}`} 
                    alt="avatar" 
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'; }}
                  />
                </div>
                <div className="text-white font-bold text-lg">{post.author}</div>
              </div>
              <div className="text-white text-sm mb-4 line-clamp-3">{post.caption}</div>
              <div className="flex items-center gap-2 text-white/90 text-sm mb-8 font-medium">
                <MapPin size={16} /> {post.location}
                <button 
                  onClick={() => handleSaveLocation(post.location)}
                  disabled={isSaving}
                  className="ml-2 bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="absolute right-6 bottom-24 flex flex-col gap-8">
                <button className="flex flex-col items-center gap-1 text-white hover:scale-110 transition-transform">
                  <Heart size={36} className={post.isLiked ? "fill-red-500 text-red-500" : ""} />
                  <span className="text-sm font-medium">{post.likes}</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-white hover:scale-110 transition-transform">
                  <MessageCircle size={36} />
                  <span className="text-sm font-medium">{post.comments}</span>
                </button>
                <button 
                  onClick={() => toggleSavedReel(post.id)}
                  className="flex flex-col items-center gap-1 text-white hover:scale-110 transition-transform"
                >
                  <Bookmark size={36} className={savedReels.includes(post.id) ? "fill-white text-white" : ""} />
                </button>
                <button className="flex flex-col items-center gap-1 text-white hover:scale-110 transition-transform">
                  <Instagram size={36} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
