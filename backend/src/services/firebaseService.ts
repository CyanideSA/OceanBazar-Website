import axios from 'axios';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAsLuUVSdDRgynoSJIx3jOJgkQgGUevg3w';

export interface FirebaseUserInfo {
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
  picture?: string;
  provider: 'google.com' | 'facebook.com' | 'password' | 'phone';
  emailVerified: boolean;
}

/**
 * Verify a Firebase ID token using the accounts:lookup REST endpoint.
 * Supports Google, Facebook, Email/Password, and Phone OTP sign-ins.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUserInfo | null> {
  try {
    const { data } = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { idToken }
    );

    if (!data.users || data.users.length === 0) return null;
    const user = data.users[0];
    const providerData = user.providerUserInfo?.[0];

    // Detect provider — phone sign-ins use providerId = 'phone'
    const rawProvider = (providerData?.providerId || 'password') as string;
    const provider = (['google.com', 'facebook.com', 'phone'].includes(rawProvider)
      ? rawProvider
      : 'password') as FirebaseUserInfo['provider'];

    return {
      uid: user.localId,
      email: user.email || undefined,
      phone: user.phoneNumber || providerData?.phoneNumber || undefined,
      name: user.displayName || providerData?.displayName || undefined,
      picture: user.photoUrl || providerData?.photoUrl || undefined,
      provider,
      emailVerified: user.emailVerified || false,
    };
  } catch (err: any) {
    console.error('[firebase] Token verification failed:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

/**
 * Exchange a Firebase refresh token for a fresh ID token.
 * Used for server-side session renewal.
 */
export async function exchangeRefreshToken(refreshToken: string): Promise<{ idToken: string; refreshToken: string } | null> {
  try {
    const { data } = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      { grant_type: 'refresh_token', refresh_token: refreshToken }
    );
    return { idToken: data.id_token, refreshToken: data.refresh_token };
  } catch (err: any) {
    console.error('[firebase] Refresh token exchange failed:', err.message);
    return null;
  }
}
