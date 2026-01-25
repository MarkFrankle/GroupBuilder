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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', color: '#dc2626', marginBottom: '1rem' }}>
            Sign-in failed
          </h1>
          <p style={{ textAlign: 'center', color: '#4b5563', marginBottom: '1rem' }}>{error}</p>
          <a href="/login" style={{ display: 'block', textAlign: 'center', color: '#2563eb', textDecoration: 'underline' }}>
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '2px solid #2563eb',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <p style={{ textAlign: 'center', color: '#4b5563' }}>Signing you in...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default AuthVerifyPage;
