import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase.config';
import { 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    updateProfile 
} from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mail, Lock, ArrowRight, Github, Chrome } from 'lucide-react';

// Helper for User Icon
const UserIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
);

const SignIn = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            console.error(err);
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error(err);
            setError("Failed to sign in with Google.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-8 w-full max-w-md space-y-8 relative overflow-hidden"
            >
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto border border-primary-500/20 mb-4 rotate-3 group-hover:rotate-0 transition-transform">
                        <Bot className="w-8 h-8 text-primary-400" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isSignUp ? 'Join VisionTalk AI today' : 'Enter your details to sign in'}
                    </p>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {isSignUp && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 ml-1">Full Name</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl font-semibold transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isSignUp ? 'Sign Up' : 'Sign In'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[var(--bg-main)] px-2 text-slate-500">Or continue with</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="flex items-center justify-center gap-3 bg-white/5 border border-[var(--border)] py-3 rounded-xl font-medium hover:bg-white/10 transition-all transform active:scale-[0.98]"
                    >
                         <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c3.11 0 5.71-1.02 7.61-2.77l-3.57-2.77c-1.01.69-2.31 1.12-4.04 1.12-3.11 0-5.75-2.09-6.7-4.89H1.1v2.85C2.98 19.46 7.14 23 12 23z" fill="#34A853"/>
                            <path d="M5.3 13.7c-.24-.71-.38-1.47-.38-2.26s.14-1.55.38-2.26V6.33H1.1C.4 7.74 0 9.32 0 11s.4 3.26 1.1 4.67L5.3 13.7z" fill="#FBBC05"/>
                            <path d="M12 4.48c1.69 0 3.21.58 4.41 1.71l3.3-3.3C17.71 1.15 15.11 0 12 0 7.14 0 2.98 3.54 1.1 8.33L5.3 11.18C6.25 8.39 8.89 6.3 12 6.3c1.33 0 2.53.48 3.48 1.41l3.3-3.3c-1.9-1.75-4.5-2.73-7.6-2.73z" fill="#EA4335"/>
                        </svg>
                        <span>Google</span>
                    </button>
                </div>

                <p className="text-center text-sm text-slate-400">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-primary-400 hover:text-primary-300 font-semibold"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </motion.div>
        </div>
    );
};

export default SignIn;
