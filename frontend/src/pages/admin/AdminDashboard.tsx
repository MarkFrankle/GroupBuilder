/**
 * Admin dashboard for organization management
 */
import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CreateOrgModal } from './CreateOrgModal';
import { ManageOrgModal } from './ManageOrgModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiRequest } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminOrganizations } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingOrgId, setManagingOrgId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: rawOrganizations = [], isLoading: loading, error: fetchError } = useAdminOrganizations(showInactive);

  // Sort by created date (newest first)
  const organizations = [...rawOrganizations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
  };

  const handleDelete = (orgId: string, orgName: string) => {
    setConfirmDelete({ id: orgId, name: orgName });
  };

  const confirmDeleteOrg = async () => {
    if (!confirmDelete) return;

    setDeletingOrgId(confirmDelete.id);
    setError(null);

    try {
      await apiRequest(`/api/admin/organizations/${confirmDelete.id}`, {
        method: 'DELETE',
      });

      await queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
    } catch (err: any) {
      setError(err.message || 'Failed to delete organization');
    } finally {
      setDeletingOrgId(null);
      setConfirmDelete(null);
    }
  };

  const formatDate = (timestamp: string | number) => {
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
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

        <div className="mb-4 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show deleted organizations</span>
          </label>
        </div>

        {(fetchError || error) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {fetchError?.message || error}
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
              <Card key={org.id} className={`p-6 ${org.active === false ? 'bg-gray-100 opacity-75' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold">{org.name}</h3>
                      {org.active === false && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-300 text-gray-700 rounded">
                          Deleted
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Created {formatDate(org.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {org.member_count} member{org.member_count !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setManagingOrgId(org.id)}
                      >
                        Manage
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(org.id, org.name)}
                        disabled={deletingOrgId === org.id || org.active === false}
                        className="text-red-600 hover:bg-red-50"
                      >
                        {deletingOrgId === org.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
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

      {/* Manage Organization Modal */}
      <ManageOrgModal
        open={managingOrgId !== null}
        onClose={() => setManagingOrgId(null)}
        orgId={managingOrgId}
      />

      {/* Confirmation dialog for deleting organizations */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteOrg}
        title="Delete Organization"
        description={`Are you sure you want to delete "${confirmDelete?.name}"? This will hide the organization from the list but preserve all data.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
