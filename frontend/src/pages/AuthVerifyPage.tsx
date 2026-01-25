/**
 * Email link verification page
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { completeMagicLinkSignIn } from '../services/firebase';

export function AuthVerifyPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Prevent duplicate sign-in attempts if deps change during async operation
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Only attempt sign-in once
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const completeSignIn = async () => {
      try {
        await completeMagicLinkSignIn(window.location.href);

        // Check if there's a redirect URL
        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect') || '/';

        navigate(redirect);
      } catch (err: any) {
        setError(err.message || 'Failed to sign in');
      }
    };

    completeSignIn();
  }, [navigate, location]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <h1 className="text-2xl font-bold text-center text-red-600 mb-4">
            Sign-in failed
          </h1>
          <p className="text-center text-gray-600 mb-4">{error}</p>
          <a href="/login" className="block text-center text-blue-600 underline hover:text-blue-800">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-center text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}

export default AuthVerifyPage;
