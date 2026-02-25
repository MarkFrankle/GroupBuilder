/**
 * Admin dashboard for program management
 */
import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CreateProgramModal } from './CreateProgramModal';
import { ManageProgramModal } from './ManageProgramModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiRequest } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminPrograms, useIsAdmin } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingProgramId, setManagingProgramId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(!!user);
  const { data: rawPrograms = [], isLoading: loading, error: fetchError } = useAdminPrograms(showInactive, isAdmin === true);

  // Show access denied page for non-admins — check useIsAdmin first to avoid flashing the page shell
  if (!adminLoading && isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground">
            The account <strong>{user?.email}</strong> does not have admin access.
            If you have another account with admin privileges, you can switch to it.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button variant="outline" onClick={() => signOut()}>
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Sort by created date (newest first)
  const programs = [...rawPrograms].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
  };

  const handleDelete = (programId: string, programName: string) => {
    setConfirmDelete({ id: programId, name: programName });
  };

  const confirmDeleteProgram = async () => {
    if (!confirmDelete) return;

    setDeletingProgramId(confirmDelete.id);
    setError(null);

    try {
      await apiRequest(`/api/admin/programs/${confirmDelete.id}`, {
        method: 'DELETE',
      });

      await queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
    } catch (err: any) {
      setError(err.message || 'Failed to delete program');
    } finally {
      setDeletingProgramId(null);
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
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/help" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              Admin Help
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Programs</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create Program
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
            <span className="text-sm text-gray-700">Show deleted programs</span>
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
            <p className="mt-4 text-gray-600">Loading programs...</p>
          </div>
        ) : programs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600 mb-4">No programs yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create your first program
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {programs.map((program) => (
              <Card key={program.id} className={`p-6 ${program.active === false ? 'bg-gray-100 opacity-75' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold">{program.name}</h3>
                      {program.active === false && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-300 text-gray-700 rounded">
                          Deleted
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Created {formatDate(program.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {program.member_count} member{program.member_count !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManagingProgramId(program.id)}
                      >
                        Manage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(program.id, program.name)}
                        disabled={deletingProgramId === program.id || program.active === false}
                        className="text-red-600 hover:bg-red-50"
                      >
                        {deletingProgramId === program.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Program Modal */}
      <CreateProgramModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Manage Program Modal */}
      <ManageProgramModal
        open={managingProgramId !== null}
        onClose={() => setManagingProgramId(null)}
        programId={managingProgramId}
      />

      {/* Confirmation dialog for deleting programs */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteProgram}
        title="Delete Program"
        description={`Are you sure you want to delete "${confirmDelete?.name}"? This will hide the program from the list but preserve all data.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
