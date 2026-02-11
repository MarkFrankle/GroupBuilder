/**
 * Login page with magic link email input
 */
import React, { useState, useEffect } from 'react';
import { sendMagicLink } from '../services/firebase';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
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
      await sendMagicLink(email);
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>Check your email</h1>
          <p style={{ textAlign: 'center', color: '#4b5563', marginBottom: '1rem' }}>
            We've sent a sign-in link to <strong>{email}</strong>
          </p>
          <p style={{ fontSize: '0.875rem', textAlign: 'center', color: '#6b7280', marginBottom: '1rem' }}>
            Click the link in the email to sign in. The link expires in 60 minutes.
          </p>
          <button
            onClick={handleResend}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#2563eb',
              border: '1px solid #2563eb',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>GroupBuilder</h1>
          <p style={{ color: '#4b5563' }}>
            Sign in to create balanced and diverse groups
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              placeholder="your@email.com"
            />
          </div>

          {error && (
            <div style={{ fontSize: '0.875rem', color: '#dc2626', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '0.375rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {loading ? 'Sending...' : 'Send me a login link'}
          </button>
        </form>

        <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#6b7280', marginTop: '1rem' }}>
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
