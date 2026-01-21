/**
 * Organization context provider for managing user's organization selection
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { authenticatedFetch } from '../utils/apiClient';

interface Organization {
  id: string;
  name: string;
  created_at?: any;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  loading: boolean;
  needsOrgSelection: boolean;
  setCurrentOrg: (org: Organization) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ORG_STORAGE_KEY = 'groupbuilder_current_org';

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);

  // Fetch user's organizations from backend
  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/user/me/organizations');
      const data = await response.json();
      
      setOrganizations(data.organizations || []);

      // Auto-select organization
      if (data.organizations.length === 0) {
        // No organizations - user needs to be invited
        setCurrentOrgState(null);
        setNeedsOrgSelection(false);
      } else if (data.organizations.length === 1) {
        // Single org - auto-select
        const org = data.organizations[0];
        setCurrentOrgState(org);
        setNeedsOrgSelection(false);
        localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(org));
      } else {
        // Multiple orgs - check if user has a stored preference
        const storedOrgStr = localStorage.getItem(ORG_STORAGE_KEY);
        if (storedOrgStr) {
          try {
            const storedOrg = JSON.parse(storedOrgStr);
            // Verify stored org is still valid
            const stillValid = data.organizations.some((org: Organization) => org.id === storedOrg.id);
            if (stillValid) {
              setCurrentOrgState(storedOrg);
              setNeedsOrgSelection(false);
            } else {
              // Stored org is no longer valid
              setNeedsOrgSelection(true);
              setCurrentOrgState(null);
            }
          } catch (e) {
            // Invalid stored data
            setNeedsOrgSelection(true);
            setCurrentOrgState(null);
          }
        } else {
          // No stored preference - need selection
          setNeedsOrgSelection(true);
          setCurrentOrgState(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      setOrganizations([]);
      setCurrentOrgState(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch organizations when user logs in
  useEffect(() => {
    fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Clear organization data when user logs out
  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setNeedsOrgSelection(false);
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
  }, [user]);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    setNeedsOrgSelection(false);
    localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(org));
  };

  const refreshOrganizations = async () => {
    await fetchOrganizations();
  };

  return (
    <OrganizationContext.Provider 
      value={{ 
        currentOrg, 
        organizations, 
        loading, 
        needsOrgSelection,
        setCurrentOrg,
        refreshOrganizations
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
