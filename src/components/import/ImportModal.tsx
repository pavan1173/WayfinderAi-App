import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Instagram, MessageSquare, FileText, Camera, Search, Link as LinkIcon, ChevronLeft, Check, Video, Sparkles } from 'lucide-react';
import { DetectingAnimation } from './DetectingAnimation';
import { geminiService, Spot } from '../../services/geminiService';
import { useApp } from '../../store/AppContext';
import { useToast } from '../../store/ToastContext';
import { cn } from '../../lib/utils';

export const ImportModal = ({ isOpen, onClose, onPlanManual }: { isOpen: boolean; onClose: () => void; onPlanManual: () => void }) => {
  const [step, setStep] = useState<'options' | 'input' | 'detecting' | 'results'>('options');
  const [inputType, setInputType] = useState<'link' | 'notes' | 'screenshot' | 'social' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [detectedSpots, setDetectedSpots] = useState<Spot[]>([]);
  const [socialPosts, setSocialPosts] = useState<{id: number, platform: string, author: string, image: string, caption: string}[]>([]);
  const [isSearchingSocial, setIsSearchingSocial] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { addSavedSpots } = useApp();
  const { showToast } = useToast();

  const TRENDING = [
    { label: 'Sapa itinerary for two days', icon: '🔥' },
    { label: 'Istanbul places to visit', icon: '📍' },
    { label: 'Best cafes in Bali', icon: '☕' },
  ];

  const handleSocialSearch = async (query: string) => {
    if (!query) return;
    setInputValue(query);
    setIsSearchingSocial(true);
    // Simulate fetching social posts
    setTimeout(() => {
      setSocialPosts([
        { id: 1, platform: 'TikTok', author: '@travelwithme', image: `https://picsum.photos/seed/${query}1/400/600`, caption: `Top 5 hidden gems in ${query}! 🌟 #travel #hiddenGems` },
        { id: 2, platform: 'Instagram', author: '@wanderlust', image: `https://picsum.photos/seed/${query}2/400/600`, caption: `My 3-day itinerary for ${query} ✈️ You can't miss these spots!` },
        { id: 3, platform: 'TikTok', author: '@foodie_travels', image: `https://picsum.photos/seed/${query}3/400/600`, caption: `Best street food spots in ${query} 🍜 #foodie` },
        { id: 4, platform: 'Instagram', author: '@scenic_views', image: `https://picsum.photos/seed/${query}4/400/600`, caption: `Breathtaking views in ${query} 📸 Save this for your next trip!` },
      ]);
      setIsSearchingSocial(false);
    }, 1500);
  };

  const handleExtractFromSocial = async () => {
    setStep('detecting');
    try {
      const spots = await geminiService.extractSpotsFromText(`Extract travel spots from these social media posts about ${inputValue}. Posts: ${socialPosts.map(p => p.caption).join(' | ')}`);
      setDetectedSpots(spots);
      setStep('results');
    } catch (e) {
      setStep('options');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setPreviewImage(reader.result as string);
      setStep('detecting');
      
      try {
        let spots: Spot[] = [];
        if (file.type.startsWith('video/')) {
          spots = await geminiService.analyzeReelVideo(base64, file.type);
        } else {
          const result = await geminiService.analyzeImageForSpots(base64);
          if (result.isAiGenerated) {
            showToast("AI-generated image detected. No travel spots extracted.");
            setStep('options');
            return;
          }
          spots = result.spots;
        }
        
        if (spots.length === 0) {
          showToast("No spots found in the image.");
          setStep('options');
          return;
        }

        setDetectedSpots(spots);
        setStep('results');
      } catch (e) {
        showToast("Error analyzing image.");
        setStep('options');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImport = async () => {
    setStep('detecting');
    try {
      const spots = await geminiService.extractSpotsFromText(inputValue);
      setDetectedSpots(spots);
      setStep('results');
    } catch (e) {
      setStep('options');
    }
  };

  const handleSpotImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setDetectedSpots(prev => prev.map((spot, i) => 
        i === index ? { ...spot, imageUrl: base64 } : spot
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    addSavedSpots(detectedSpots);
    onClose();
    setStep('options');
    setDetectedSpots([]);
    setInputValue('');
    setPreviewImage(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full max-w-lg bg-white rounded-t-[2.5rem] md:rounded-3xl p-6 pb-12 md:pb-6 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          {step !== 'options' && (
            <button onClick={() => { setStep('options'); setPreviewImage(null); }} className="p-2 hover:bg-slate-100 rounded-full">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold text-slate-800">
              {step === 'options' ? 'Add Spots' : step === 'input' ? `Import via ${inputType}` : step === 'detecting' ? 'Detecting Spots' : 'Import Locations'}
            </h2>
          </div>
          <button onClick={() => { onClose(); setPreviewImage(null); }} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {step === 'options' && (
            <motion.div 
              key="options"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { id: 'instagram', label: 'Import from Instagram', icon: <Instagram className="text-pink-500" />, sub: 'Paste Instagram Link' },
                { id: 'tiktok', label: 'Import from TikTok', icon: <Video className="text-black" />, sub: 'Paste TikTok Link' },
                { id: 'link', label: 'Import from Link', icon: <LinkIcon className="text-blue-500" />, sub: 'Articles, blogs, etc.' },
                { id: 'screenshot', label: 'Import from Screenshot', icon: <Camera className="text-emerald-500" />, sub: 'Extract from Images' },
              ].map(opt => (
                <div key={opt.id} className="relative col-span-2">
                  {opt.id === 'screenshot' && (
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                  )}
                  <button 
                    onClick={() => {
                      if (opt.id !== 'screenshot') {
                        setInputType(opt.id === 'instagram' || opt.id === 'tiktok' ? 'social' : opt.id as 'link' | 'notes' | 'social');
                        setStep('input');
                      }
                    }}
                    className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      {opt.icon}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.sub}</div>
                    </div>
                  </button>
                </div>
              ))}
              <button 
                onClick={() => {
                  onClose();
                  onPlanManual();
                }}
                className="col-span-2 mt-4 bg-slate-50 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <Search className="text-slate-400" size={20} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">Search Location</div>
                  <div className="text-[10px] text-slate-500">Find on Google Maps</div>
                </div>
              </button>
            </motion.div>
          )}

          {step === 'input' && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {inputType === 'social' ? (
                <div className="space-y-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSocialSearch(inputValue)}
                      placeholder="Search TikToks & Instagram for travel spots..."
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-lg focus:ring-2 focus:ring-brand/20"
                    />
                    <button 
                      onClick={() => handleSocialSearch(inputValue)}
                      disabled={isSearchingSocial || !inputValue}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand text-white p-2 rounded-xl disabled:opacity-50"
                    >
                      {isSearchingSocial ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={20} />}
                    </button>
                  </div>
                  
                  {socialPosts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Found {socialPosts.length} posts</h3>
                        <button 
                          onClick={handleExtractFromSocial}
                          className="text-xs font-bold text-brand bg-brand-light px-3 py-1.5 rounded-full flex items-center gap-1"
                        >
                          <Sparkles size={14} />
                          Extract Spots
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto no-scrollbar pb-4">
                        {socialPosts.map(post => (
                          <div key={post.id} className="relative rounded-2xl overflow-hidden group">
                            <img src={post.image} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-between">
                              <div className="flex justify-end">
                                {post.platform === 'Instagram' ? <Instagram size={16} className="text-white" /> : <Video size={16} className="text-white" />}
                              </div>
                              <div>
                                <div className="text-white text-[10px] font-bold mb-1">{post.author}</div>
                                <div className="text-white/90 text-xs line-clamp-2 leading-tight">{post.caption}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trending</h3>
                      <div className="space-y-2">
                        {TRENDING.map((t, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSocialSearch(t.label.replace(' itinerary for two days', '').replace(' places to visit', '').replace('Best cafes in ', ''))}
                            className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                          >
                            <span className="text-lg">{t.icon}</span>
                            <span className="text-sm font-medium text-slate-700">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-100">
                    <textarea 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={inputType === 'link' ? "Paste link here..." : "Paste your notes here..."}
                      className="w-full bg-transparent border-none focus:ring-0 text-lg min-h-[120px] resize-none"
                    />
                  </div>
                  {inputType === 'notes' && (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={16} className="text-orange-600" />
                        <h4 className="text-[10px] font-bold text-orange-900 uppercase tracking-wider">Tips</h4>
                      </div>
                      <p className="text-[10px] text-orange-800 leading-relaxed">Works best with lists like:<br/>• Eiffel Tower, Paris<br/>• Louvre Museum<br/>• Café de Flore</p>
                    </div>
                  )}
                  <button 
                    onClick={handleImport}
                    disabled={!inputValue}
                    className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20 disabled:opacity-50"
                  >
                    Import Spots
                  </button>
                </>
              )}
            </motion.div>
          )}

          {step === 'detecting' && (
            <motion.div key="detecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
              {previewImage && (
                <div className="mb-6 relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                </div>
              )}
              <DetectingAnimation className={previewImage ? "py-4" : "py-12"} />
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="max-h-[400px] overflow-y-auto no-scrollbar space-y-4">
                {detectedSpots.map((spot, i) => (
                  <div key={i} className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 group">
                      <img src={spot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={16} className="text-white" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleSpotImageChange(i, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{spot.name}</div>
                      <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{spot.description}</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20"
              >
                Save {detectedSpots.length} spots to my list
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
