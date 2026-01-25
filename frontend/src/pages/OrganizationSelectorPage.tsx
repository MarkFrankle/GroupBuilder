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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-10 max-w-lg w-full">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Select Your Organization
        </h1>
        <p className="text-gray-500 text-center mb-8">
          You're a facilitator for multiple cohorts. Which one are you working on?
        </p>

        <div className="flex flex-col gap-3">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelectOrg(org)}
              className="p-4 border-2 border-gray-200 rounded-lg bg-white text-left text-base font-medium transition-all hover:border-blue-500 hover:bg-blue-50"
            >
              {org.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
