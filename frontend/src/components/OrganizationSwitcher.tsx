/**
 * Organization switcher component - shows current org and allows switching for multi-org users
 */
import React, { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';

export function OrganizationSwitcher() {
  const { currentOrg, organizations, setCurrentOrg } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show if no org selected or only one org
  if (!currentOrg || organizations.length <= 1) {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontWeight: '500' }}>{currentOrg.name}</span>
        <span style={{ fontSize: '12px', color: '#666' }}>▼</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />

          {/* Dropdown menu */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: '200px',
              zIndex: 1000,
            }}
          >
            <div style={{ padding: '8px 0' }}>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrg(org);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    backgroundColor: org.id === currentOrg.id ? '#f0f8ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: org.id === currentOrg.id ? '600' : '400',
                    color: org.id === currentOrg.id ? '#2196F3' : '#333',
                  }}
                  onMouseEnter={(e) => {
                    if (org.id !== currentOrg.id) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (org.id !== currentOrg.id) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {org.name}
                  {org.id === currentOrg.id && (
                    <span style={{ marginLeft: '8px', color: '#2196F3' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
