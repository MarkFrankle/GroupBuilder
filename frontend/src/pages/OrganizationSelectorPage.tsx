/**
 * Organization selector page for users who belong to multiple organizations
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';

export default function OrganizationSelectorPage() {
  const navigate = useNavigate();
  const { organizations, setCurrentOrg } = useOrganization();

  const handleSelectOrg = (org: any) => {
    setCurrentOrg(org);
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '40px',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Select Your Organization
        </h1>
        <p style={{
          color: '#666',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          You're a facilitator for multiple cohorts. Which one are you working on?
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              style={{
                padding: '16px 20px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '16px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2196F3';
                e.currentTarget.style.backgroundColor = '#f0f8ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              {org.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
