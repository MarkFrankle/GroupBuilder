/**
 * Firebase client SDK initialization and auth helpers
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

// Validate config - fail fast with clear message
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase config. Ensure REACT_APP_FIREBASE_API_KEY, ' +
    'REACT_APP_FIREBASE_AUTH_DOMAIN, and REACT_APP_FIREBASE_PROJECT_ID are set in .env'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Send magic link to user's email
 */
export async function sendMagicLink(email: string): Promise<void> {
  const actionCodeSettings = {
    // URL to redirect to after email link click
    url: window.location.origin + '/auth/verify',
    handleCodeInApp: true,
  };

  console.log('🔥 Firebase: Attempting to send magic link to:', email);
  console.log('🔥 Firebase: Config:', {
    apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId
  });
  console.log('🔥 Firebase: Action code settings:', actionCodeSettings);

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    console.log('✅ Firebase: Magic link sent successfully!');

    // Save email to localStorage for verification step
    window.localStorage.setItem('emailForSignIn', email);
  } catch (error: any) {
    console.error('❌ Firebase: Failed to send magic link:', error);
    console.error('❌ Firebase: Error code:', error.code);
    console.error('❌ Firebase: Error message:', error.message);
    throw error;
  }
}

/**
 * Complete sign-in with email link
 */
export async function completeMagicLinkSignIn(
  emailLink: string
): Promise<User> {
  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new Error('Invalid sign-in link');
  }

  // Get email from localStorage
  let email = window.localStorage.getItem('emailForSignIn');

  if (!email) {
    // Prompt user to enter email if not found
    email = window.prompt('Please provide your email for confirmation');
  }

  if (!email) {
    throw new Error('Email required for sign-in');
  }

  const result = await signInWithEmailLink(auth, email, emailLink);

  // Clear email from storage
  window.localStorage.removeItem('emailForSignIn');

  return result.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Get current user's ID token for API requests
 */
export async function getCurrentUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  return await user.getIdToken();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export { auth };
