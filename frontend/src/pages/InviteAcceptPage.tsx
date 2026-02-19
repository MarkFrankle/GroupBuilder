/**
 * Page for accepting program invites
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useProgram } from '../contexts/ProgramContext';
import { apiRequest } from '../utils/apiClient';
import { API_BASE_URL } from '../config/api';

interface InviteDetails {
  program_id: string;
  program_name: string;
  invited_email: string;
  expires_at: string;
  status: string;
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshPrograms } = useProgram();

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const magicLinkAttempted = useRef(false);

  // Fetch invite details on mount
  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/invites/${token}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Invite not found');
          } else if (response.status === 410) {
            const data = await response.json();
            throw new Error(data.detail || 'This invite has expired or has already been used');
          } else {
            throw new Error('Failed to load invite details');
          }
        }

        const data: InviteDetails = await response.json();
        setInviteDetails(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    };

    fetchInviteDetails();
  }, [token]);

  // Auto-complete Firebase magic link sign-in if the URL contains sign-in params
  useEffect(() => {
    if (magicLinkAttempted.current || !inviteDetails || user) return;

    const fullUrl = window.location.href;
    if (!isSignInWithEmailLink(auth, fullUrl)) return;

    magicLinkAttempted.current = true;
    setSigningIn(true);

    signInWithEmailLink(auth, inviteDetails.invited_email, fullUrl)
      .then(() => {
        // Strip Firebase query params from URL so refresh doesn't re-trigger
        navigate(`/invite/${token}`, { replace: true });
      })
      .catch((err) => {
        setError(`Sign-in failed: ${err.message}`);
      })
      .finally(() => {
        setSigningIn(false);
      });
  }, [inviteDetails, user, token, navigate]);

  const handleAcceptInvite = async () => {
    if (!token || !user) return;

    setAccepting(true);
    setError(null);

    try {
      await apiRequest('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      setSuccess(true);

      // Refresh programs to get the newly joined program
      await refreshPrograms();

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || authLoading || signingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <p className="text-center text-gray-600">
            {signingIn ? 'Signing you in...' : 'Loading invite...'}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-4 text-green-500">
              Invite Accepted!
            </h1>
            <p className="text-gray-600 mb-4">
              You've successfully joined <strong>{inviteDetails?.program_name}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you to the app...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4 text-red-500">
              Invite Error
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!user && inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">
              You're Invited!
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Join <strong>{inviteDetails.program_name}</strong> on GroupBuilder
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Invited as: <strong>{inviteDetails.invited_email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Expires: {new Date(inviteDetails.expires_at).toLocaleDateString()}
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-md mb-6 border border-amber-400">
            <p className="text-sm text-amber-800 text-center">
              Please sign in to accept this invite
            </p>
          </div>

          <button
            onClick={() => navigate('/login', { state: { returnTo: `/invite/${token}` } })}
            className="w-full py-3 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition-colors"
          >
            Sign In to Accept
          </button>
        </div>
      </div>
    );
  }

  // Logged in - show accept button
  if (user && inviteDetails) {
    // Check if user email matches invite email
    const emailMismatch = user.email?.toLowerCase() !== inviteDetails.invited_email.toLowerCase();

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">
              You're Invited!
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Join <strong>{inviteDetails.program_name}</strong> as a facilitator
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Invited as: <strong>{inviteDetails.invited_email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Signed in as: <strong>{user.email}</strong>
            </p>
          </div>

          {emailMismatch && (
            <div className="p-4 bg-red-50 rounded-md mb-6 border border-red-500">
              <p className="text-sm text-red-800 text-center">
                ⚠️ This invite is for {inviteDetails.invited_email}, but you're signed in as {user.email}.
                Please sign in with the correct email address.
              </p>
            </div>
          )}

          <button
            onClick={handleAcceptInvite}
            disabled={accepting || emailMismatch}
            className={`w-full py-3 text-white rounded-md font-medium transition-colors ${
              emailMismatch
                ? 'bg-gray-400 cursor-not-allowed'
                : accepting
                ? 'bg-green-500 opacity-70 cursor-wait'
                : 'bg-green-500 hover:bg-green-600 cursor-pointer'
            }`}
          >
            {accepting ? 'Accepting...' : emailMismatch ? 'Wrong Email Address' : 'Accept Invite'}
          </button>

          {emailMismatch && (
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-3 py-3 bg-white text-blue-500 border border-blue-500 rounded-md font-medium hover:bg-blue-50 transition-colors"
            >
              Sign In with Different Email
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default InviteAcceptPage;
