/**
 * Page for accepting organization invites
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { apiRequest } from '../utils/apiClient';

interface InviteDetails {
  org_id: string;
  org_name: string;
  invited_email: string;
  expires_at: string;
  status: string;
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshOrganizations } = useOrganization();

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invite details on mount
  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/invites/${token}`);
        
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

      // Refresh organizations to get the newly joined org
      await refreshOrganizations();

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
  if (loading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <p style={{ textAlign: 'center', color: '#4b5563' }}>Loading invite...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#10b981' }}>
              Invite Accepted!
            </h1>
            <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
              You've successfully joined <strong>{inviteDetails?.org_name}</strong>
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ef4444' }}>
              Invite Error
            </h1>
            <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              You're Invited!
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '1rem' }}>
              Join <strong>{inviteDetails.org_name}</strong> on GroupBuilder
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Invited as: <strong>{inviteDetails.invited_email}</strong>
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Expires: {new Date(inviteDetails.expires_at).toLocaleDateString()}
            </p>
          </div>

          <div style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderRadius: '0.375rem',
            marginBottom: '1.5rem',
            border: '1px solid #fbbf24'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#92400e', textAlign: 'center' }}>
              Please sign in to accept this invite
            </p>
          </div>

          <button
            onClick={() => navigate('/login', { state: { returnTo: `/invite/${token}` } })}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              You're Invited!
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '1rem' }}>
              Join <strong>{inviteDetails.org_name}</strong> as a facilitator
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Invited as: <strong>{inviteDetails.invited_email}</strong>
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Signed in as: <strong>{user.email}</strong>
            </p>
          </div>

          {emailMismatch && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              borderRadius: '0.375rem',
              marginBottom: '1.5rem',
              border: '1px solid #ef4444'
            }}>
              <p style={{ fontSize: '0.875rem', color: '#991b1b', textAlign: 'center' }}>
                ⚠️ This invite is for {inviteDetails.invited_email}, but you're signed in as {user.email}. 
                Please sign in with the correct email address.
              </p>
            </div>
          )}

          <button
            onClick={handleAcceptInvite}
            disabled={accepting || emailMismatch}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: emailMismatch ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: emailMismatch ? 'not-allowed' : 'pointer',
              opacity: accepting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!emailMismatch && !accepting) {
                e.currentTarget.style.backgroundColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (!emailMismatch) {
                e.currentTarget.style.backgroundColor = '#10b981';
              }
            }}
          >
            {accepting ? 'Accepting...' : emailMismatch ? 'Wrong Email Address' : 'Accept Invite'}
          </button>

          {emailMismatch && (
            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'white',
                color: '#3b82f6',
                border: '1px solid #3b82f6',
                borderRadius: '0.375rem',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
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
