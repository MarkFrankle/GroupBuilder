/**
 * Admin dashboard for organization management
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CreateOrgModal } from './CreateOrgModal';
import { apiRequest } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadOrganizations = async () => {
    setLoading(true);
    setError(null);

    try {
      const orgs = await apiRequest<Organization[]>('/api/admin/organizations');
      // Sort by created date (newest first)
      orgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrganizations(orgs);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleCreateSuccess = () => {
    loadOrganizations();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">GroupBuilder Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Organizations</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create Organization
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading organizations...</p>
          </div>
        ) : organizations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">No organizations yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create your first organization
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <Card key={org.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{org.name}</h3>
                    <p className="text-sm text-gray-600">
                      Created {formatDate(org.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {org.member_count} member{org.member_count !== 1 ? 's' : ''}
                    </span>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Organization Modal */}
      <CreateOrgModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
