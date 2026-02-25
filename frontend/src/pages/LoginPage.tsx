/**
 * Login page with magic link email input
 */
import React, { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendMagicLink } from '../services/firebase';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if there's a pending magic link (user clicked back)
  useEffect(() => {
    const pendingEmail = localStorage.getItem('emailForSignIn');
    if (pendingEmail) {
      setEmail(pendingEmail);
      setSent(true);
    }
  }, []);

  // Redirect if already logged in (after all hooks)
  if (!authLoading && user) {
    const returnTo = searchParams.get('returnTo') || '/';
    return <Navigate to={returnTo} replace />;
  }

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email format
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await sendMagicLink(email, searchParams.get('returnTo') || undefined);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    // Clear pending email and allow user to try again
    localStorage.removeItem('emailForSignIn');
    setSent(false);
    setError(null);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <h1 className="text-2xl font-bold text-center mb-4">Check your email</h1>
          <p className="text-center text-gray-600 mb-4">
            We've sent a sign-in link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-center text-gray-500 mb-4">
            Click the link in the email to sign in. The link expires in 60 minutes.
          </p>
          <button
            onClick={handleResend}
            className="w-full px-4 py-2 bg-transparent text-blue-600 border border-blue-600 rounded-md font-medium hover:bg-blue-50 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold">GroupBuilder</h1>
          <p className="text-gray-600">
            Sign in to create balanced and diverse groups
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="your@email.com"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 text-white rounded-md font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
          >
            {loading ? 'Sending...' : 'Send me a login link'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500 mt-4">
          By signing in, you agree to our{' '}
          <Link to="/legal" className="underline hover:text-gray-700">terms of service and privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
