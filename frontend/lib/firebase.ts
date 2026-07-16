'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

function readFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '',
  };
}

function isComplete(cfg: ReturnType<typeof readFirebaseConfig>): boolean {
  return !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

/** Values copied verbatim from `.env.example` break Firebase and confuse local dev */
function looksLikeExamplePlaceholder(cfg: ReturnType<typeof readFirebaseConfig>): boolean {
  return (
    cfg.apiKey === 'your_firebase_api_key' ||
    cfg.authDomain === 'your_project.firebaseapp.com' ||
    cfg.projectId === 'your_firebase_project_id' ||
    cfg.appId === 'your_firebase_app_id'
  );
}

let cachedApp: FirebaseApp | null | undefined;
let warnedMissing = false;
let phoneVerifier: RecaptchaVerifier | null = null;
let phoneConfirmation: ConfirmationResult | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp !== undefined) return cachedApp;

  const cfg = readFirebaseConfig();
  const usable = isComplete(cfg) && !looksLikeExamplePlaceholder(cfg);

  if (!usable) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !warnedMissing) {
      warnedMissing = true;
      console.warn(
        '[Oceanbazar] Firebase client env not configured (or still using .env.example placeholders). ' +
          'Copy frontend/.env.example → .env.local and set NEXT_PUBLIC_FIREBASE_* . Social login stays disabled until then.'
      );
    }
    cachedApp = null;
    return null;
  }

  try {
    cachedApp = getApps().length === 0 ? initializeApp(cfg) : getApps()[0];
  } catch (e) {
    console.error('[Oceanbazar] Firebase initializeApp failed:', e);
    cachedApp = null;
  }

  return cachedApp ?? null;
}

function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const facebookProvider = new FacebookAuthProvider();

const missingConfigMessage =
  'Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* to frontend/.env.local (see .env.example).';

/**
 * Sign in with Google via Firebase popup and return the Firebase ID token.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error(missingConfigMessage);
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

/**
 * Sign in with Facebook via Firebase popup and return the Firebase ID token.
 */
export async function signInWithFacebook(): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error(missingConfigMessage);
  const result = await signInWithPopup(auth, facebookProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

/**
 * Start Firebase Phone Auth with an invisible reCAPTCHA bound to the submit
 * button. Firebase creates and manages the underlying reCAPTCHA client keys.
 */
export async function startPhoneSignIn(
  phoneNumber: string,
  buttonId: string,
  languageCode = 'bn',
): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error(missingConfigMessage);

  auth.languageCode = languageCode;
  phoneVerifier?.clear();
  phoneVerifier = new RecaptchaVerifier(auth, buttonId, {
    size: 'invisible',
    'expired-callback': () => {
      phoneVerifier?.clear();
      phoneVerifier = null;
    },
  });

  try {
    phoneConfirmation = await signInWithPhoneNumber(auth, phoneNumber, phoneVerifier);
  } catch (error) {
    phoneVerifier.clear();
    phoneVerifier = null;
    phoneConfirmation = null;
    throw error;
  }
}

/** Confirm the Firebase SMS code and return the ID token for the Node BFF. */
export async function confirmPhoneSignIn(code: string): Promise<string> {
  if (!phoneConfirmation) {
    throw new Error('Request a new verification code before continuing.');
  }

  const result = await phoneConfirmation.confirm(code);
  const idToken = await result.user.getIdToken();
  phoneConfirmation = null;
  phoneVerifier?.clear();
  phoneVerifier = null;
  return idToken;
}

export function resetPhoneSignIn(): void {
  phoneConfirmation = null;
  phoneVerifier?.clear();
  phoneVerifier = null;
}

/**
 * Sign out from Firebase (client-side cleanup).
 */
export async function firebaseSignOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await fbSignOut(auth);
}

export function isFirebaseClientConfigured(): boolean {
  return getFirebaseAuth() !== null;
}
