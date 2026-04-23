import axios from 'axios';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAsLuUVSdDRgynoSJIx3jOJgkQgGUevg3w';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'oceanbazarbd';

export interface FirebaseUserInfo {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  provider: 'google.com' | 'facebook.com' | 'password';
  emailVerified: boolean;
}

/**
 * Verify a Firebase ID token using the public Google token-info endpoint.
 * For production, consider using Firebase Admin SDK instead.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUserInfo | null> {
  try {
    // Use Google's secure token verification endpoint
    const { data } = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { idToken }
    );

    if (!data.users || data.users.length === 0) return null;

    const user = data.users[0];
    const providerData = user.providerUserInfo?.[0];

    return {
      uid: user.localId,
      email: user.email,
      name: user.displayName || providerData?.displayName,
      picture: user.photoUrl || providerData?.photoUrl,
      provider: (providerData?.providerId || 'password') as FirebaseUserInfo['provider'],
      emailVerified: user.emailVerified || false,
    };
  } catch (err: any) {
    console.error('[firebase] Token verification failed:', err.response?.data?.error?.message || err.message);
    return null;
  }
}

/**
 * Exchange a Firebase custom token / refresh token for an ID token (useful for server-side flows).
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
