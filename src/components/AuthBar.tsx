import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, ShieldCheck, Database, Check } from 'lucide-react';

interface AuthBarProps {
  onUserChanged?: (user: User | null) => void;
}

export const AuthBar: React.FC<AuthBarProps> = ({ onUserChanged }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (onUserChanged) onUserChanged(user);

      if (user) {
        // Sync user document in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const existing = await getDoc(userDocRef);
          const now = new Date().toISOString();

          if (!existing.exists()) {
            await setDoc(userDocRef, {
              id: user.uid,
              email: user.email || 'anonymous@user.com',
              displayName: user.displayName || 'Surveyor',
              photoURL: user.photoURL || '',
              createdAt: now,
              updatedAt: now,
            });
          } else {
            await setDoc(
              userDocRef,
              {
                updatedAt: now,
                displayName: user.displayName || existing.data().displayName,
                photoURL: user.photoURL || existing.data().photoURL,
              },
              { merge: true }
            );
          }
        } catch (err) {
          console.error('Failed to sync user document:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [onUserChanged]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Sign in error:', err);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
        <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
        <span>Auth...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {currentUser ? (
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-lg object-cover border border-violet-500/40"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-violet-900/50 flex items-center justify-center text-violet-300">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="hidden sm:block text-left pr-2">
            <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[120px]">
              {currentUser.displayName || 'User'}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <Database className="w-2.5 h-2.5" />
              <span>Firestore Sync</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Google Sign-In</span>
        </button>
      )}
    </div>
  );
};
