/**
 * Modal for managing program details, members, and invites
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiRequest } from '../../utils/apiClient';
import { useProgramDetails } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';

interface ManageProgramModalProps {
  open: boolean;
  onClose: () => void;
  programId: string | null;
}

export function ManageProgramModal({ open, onClose, programId }: ManageProgramModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; email: string } | null>(null);
  const [failedInviteLink, setFailedInviteLink] = useState<string | null>(null);

  const { data: programDetails = null, isLoading: loading, error: fetchError } = useProgramDetails(programId, open);

  const handleAddInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId || !newInviteEmail.trim()) return;

    setSendingInvite(true);
    setError(null);
    setFailedInviteLink(null);

    try {
      const response = await apiRequest<{
        invites: Array<{ email: string; invite_link: string; email_sent: boolean; error?: string }>;
      }>(`/api/admin/programs/${programId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilitator_emails: [newInviteEmail.trim()],
        }),
      });

      setNewInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['admin-program-details', programId] });

      // Show invite link if email delivery failed
      const invite = response.invites?.[0];
      if (invite && !invite.email_sent) {
        setFailedInviteLink(invite.invite_link);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!programId) return;

    setRevokingInviteId(inviteId);
    setError(null);

    try {
      await apiRequest(`/api/admin/programs/${programId}/invites/${inviteId}`, {
        method: 'DELETE',
      });

      await queryClient.invalidateQueries({ queryKey: ['admin-program-details', programId] }); // Reload to update invite status
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invite');
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!programId) return;

    setConfirmRemove({ userId, email });
  };

  const confirmRemoveMember = async () => {
    if (!programId || !confirmRemove) return;

    setRemovingMemberId(confirmRemove.userId);
    setError(null);

    try {
      await apiRequest(`/api/admin/programs/${programId}/members/${confirmRemove.userId}`, {
        method: 'DELETE',
      });

      await queryClient.invalidateQueries({ queryKey: ['admin-program-details', programId] }); // Reload to update members list
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
      setConfirmRemove(null);
    }
  };

  const formatDate = (timestamp: string | number) => {
    // Handle Unix timestamps (numbers) by converting to milliseconds
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
      revoked: 'bg-red-100 text-red-800',
      removed: 'bg-orange-100 text-orange-800'
    };

    const style = styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${style}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleClose = () => {
    setError(null);
    setNewInviteEmail('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {programDetails?.name || 'Program Details'}
          </DialogTitle>
          <DialogDescription>
            View members and invites for this program
          </DialogDescription>
        </DialogHeader>

        {(fetchError || error) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {fetchError?.message || error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading details...</p>
          </div>
        ) : programDetails ? (
          <div className="space-y-6">
            {/* Members Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Members ({programDetails.members.length})
              </h3>
              {programDetails.members.length === 0 ? (
                <p className="text-gray-500 text-sm">No members yet</p>
              ) : (
                <div className="space-y-2">
                  {programDetails.members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{member.email}</p>
                        <p className="text-sm text-gray-600">
                          Joined {formatDate(member.joined_at)} • {member.role}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user_id, member.email)}
                        disabled={removingMemberId === member.user_id}
                        className="text-red-600 hover:bg-red-50"
                      >
                        {removingMemberId === member.user_id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invites Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Invites ({programDetails.invites.length})
              </h3>

              {/* Add Invite Form */}
              <form onSubmit={handleAddInvite} className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add New Invite
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    placeholder="facilitator@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sendingInvite}
                  />
                  <Button type="submit" variant="outline" disabled={sendingInvite || !newInviteEmail.trim()}>
                    {sendingInvite ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>
              </form>

              {failedInviteLink && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">
                    The email couldn't be delivered. You can copy the invite link below and send it to them directly.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all flex-1">
                      {failedInviteLink}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(failedInviteLink);
                      }}
                    >
                      Copy link
                    </Button>
                  </div>
                </div>
              )}

              {programDetails.invites.length === 0 ? (
                <p className="text-gray-500 text-sm">No invites sent yet</p>
              ) : (
                <div className="space-y-2">
                  {programDetails.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-gray-600">
                          Sent {formatDate(invite.created_at)}
                          {invite.status === 'accepted' && invite.accepted_at && (
                            <> • Accepted {formatDate(invite.accepted_at)}</>
                          )}
                          {invite.status === 'removed' && invite.removed_at && (
                            <> • Removed {formatDate(invite.removed_at)}</>
                          )}
                          {invite.status === 'pending' && (
                            <> • Expires {formatDate(invite.expires_at)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(invite.status)}
                        {invite.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeInvite(invite.id)}
                            disabled={revokingInviteId === invite.id}
                            className="text-red-600 hover:bg-red-50"
                          >
                            {revokingInviteId === invite.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Confirmation dialog for removing members */}
      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        description={`Remove ${confirmRemove?.email} from this program?`}
        confirmText="Remove"
        variant="danger"
      />
    </Dialog>
  );
}
