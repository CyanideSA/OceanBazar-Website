'use client';

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAsLuUVSdDRgynoSJIx3jOJgkQgGUevg3w',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'oceanbazarbd.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'oceanbazarbd',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:749559457588:web:f67ca8249309c0887ae761',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth: Auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const facebookProvider = new FacebookAuthProvider();

/**
 * Sign in with Google via Firebase popup and return the Firebase ID token.
 */
export async function signInWithGoogle(): Promise<string> {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

/**
 * Sign in with Facebook via Firebase popup and return the Firebase ID token.
 */
export async function signInWithFacebook(): Promise<string> {
  const result = await signInWithPopup(firebaseAuth, facebookProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

/**
 * Sign out from Firebase (client-side cleanup).
 */
export async function firebaseSignOut(): Promise<void> {
  await fbSignOut(firebaseAuth);
}
