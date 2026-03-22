import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../store/AppContext';
import { ChevronRight, Star, Users, MapPin, CheckCircle2, Search, Share2, Heart, Instagram, FileText, Camera, Mail, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DetectingAnimation } from '../import/DetectingAnimation';
import { Logo } from '../Logo';
import { auth, googleProvider, db } from '../../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { useToast } from '../../store/ToastContext';
export const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const { setOnboarded } = useApp();
  const { showToast } = useToast();

  const handleGoogleSignIn = async () => {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        role: 'user'
      }, { merge: true });
      handleNext();
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      if (error.code === 'auth/internal-error') {
        showToast("Internal authentication error. Please ensure Google Sign-in is enabled in your Firebase Console.");
      } else {
        showToast(`Error signing in with Google: ${error.message}`);
      }
    }
  };

  const handleEmailAuth = async () => {
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          createdAt: new Date().toISOString(),
          role: 'user'
        }, { merge: true });
      }
      handleNext();
    } catch (error: any) {
      console.error("Error with email auth", error);
      if (error.code === 'auth/email-already-in-use') {
        showToast("Email already in use. Please sign in instead.");
        setIsLogin(true);
      } else if (error.code === 'auth/operation-not-allowed') {
        showToast("Email/password authentication is not enabled. Please enable it in the Firebase console.");
      } else if (error.code === 'auth/invalid-email') {
        showToast("Invalid email address. Please check your email.");
      } else {
        showToast("Error with email auth. Please try again.");
      }
    }
  };

  const steps = [
    {
      title: <Logo className="scale-75 origin-bottom" />,
      subtitle: "Your favourite travel companion",
      content: (
        <div className="flex flex-col items-center gap-4 mt-8 w-full px-6">
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Sign in with Google
          </button>
          <div className="text-slate-400 text-sm">or</div>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all" />
          <button onClick={handleEmailAuth} className="w-full bg-brand text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand/20 hover:bg-brand-dark transition-all active:scale-95">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-brand font-medium">
            {isLogin ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
          <div className="relative w-64 h-64 mt-4">
            <motion.div 
              initial={{ rotate: -10, y: 20 }}
              animate={{ rotate: -5, y: 0 }}
              className="absolute inset-0 bg-white rounded-2xl shadow-xl border-4 border-white overflow-hidden"
            >
              <img src="https://loremflickr.com/400/600/travel,beach" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
            <motion.div 
              initial={{ rotate: 10, y: 40 }}
              animate={{ rotate: 5, y: 20 }}
              className="absolute inset-0 bg-white rounded-2xl shadow-xl border-4 border-white overflow-hidden"
            >
              <img src="https://loremflickr.com/400/600/travel,city" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-4 -left-4 bg-red-500 text-white p-3 rounded-full shadow-lg"
            >
              <MapPin size={24} />
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full px-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
              <div className="text-2xl font-bold">1M+</div>
              <div className="text-xs text-slate-500">Happy travellers</div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
              <div className="text-2xl font-bold">2M+</div>
              <div className="text-xs text-slate-500">Trips Created</div>
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 w-full mx-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-xl font-bold text-amber-900">4.9</div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
              </div>
            </div>
            <div className="text-xs font-medium text-amber-800">App Rating</div>
          </div>
        </div>
      )
    },
    {
      title: "How old are you?",
      subtitle: "We only use this information to personalize your experience",
      options: ["24 and under", "25-34", "35-44", "45-54", "55+"]
    },
    {
      title: "Do you have a trip coming up?",
      subtitle: "We will personalize your experience",
      options: [
        { label: "Yes, I have a trip", sub: "I'm ready to start planning", icon: <CheckCircle2 className="text-emerald-500" /> },
        { label: "No, not yet", sub: "I'm just exploring for now", icon: <Search className="text-slate-400" /> }
      ]
    },
    {
      title: "Where do you save places you want to visit?",
      subtitle: "Let us know so we can personalize your experience.",
      options: [
        { label: "Social Media", sub: "Save folder on Tiktok or Inst...", icon: <Instagram className="text-pink-500" /> },
        { label: "I write them in my notes", sub: "Notes, Notion, Docs, & more", icon: <FileText className="text-orange-500" /> },
        { label: "I save them in my photos", sub: "Screenshots, images, & more", icon: <Camera className="text-emerald-500" /> },
        { label: "I don't save any places", sub: "Bring on the chaos!", icon: <Heart className="text-red-500" /> }
      ]
    },
    {
      title: "How are we doing?",
      subtitle: "1M+ Wayfinder Users",
      content: (
        <div className="mt-8 w-full px-6 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left">
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400" />)}
              <span className="ml-2 font-bold">4.9</span>
            </div>
            <p className="text-slate-600 text-sm italic">"This is life-changing! I currently manually save travel content to notes and pin locations on Google Maps. The app automates exactly what I do now"</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="text-xs font-bold">Viktoria B</div>
            </div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-300" />)}
            </div>
            <div className="text-xs font-bold text-emerald-800"><span className="text-lg">93%</span> of users say they'll never plan trips the old way again</div>
          </div>
        </div>
      )
    },
    {
      title: "We're setting everything up for you",
      subtitle: "Setting your preferences...",
      content: (
        <div className="mt-12">
          <DetectingAnimation />
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setOnboarded(true);
    }
  };

  const current = steps[step];

  return (
    <div className="fixed inset-0 bg-brand-light flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col h-full relative">
        <div className="flex-1 flex flex-col pt-16 px-6 overflow-y-auto no-scrollbar">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col items-center text-center"
        >
          <h1 className={cn(
            "font-display font-bold text-slate-900",
            step === 0 ? "text-5xl text-brand" : "text-3xl"
          )}>
            {current.title}
          </h1>
          <p className="text-slate-500 mt-2 max-w-[280px]">
            {current.subtitle}
          </p>

          {current.content}

          {current.options && (
            <div className="w-full mt-12 space-y-3">
              {current.options.map((opt: any, i: number) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNext()}
                  className="w-full bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between text-left shadow-sm hover:border-brand transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {opt.icon && <div className="p-2 bg-slate-50 rounded-xl">{opt.icon}</div>}
                    <div>
                      <div className="font-semibold text-slate-800">{typeof opt === 'object' ? opt.label : opt}</div>
                      {typeof opt === 'object' && opt.sub && <div className="text-xs text-slate-500">{opt.sub}</div>}
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 bg-white/50 backdrop-blur-xl">
          {step !== 0 && (
            <button
              onClick={handleNext}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Continue
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
