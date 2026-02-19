/**
 * Modal for creating a new program
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiRequest } from '../../utils/apiClient';

interface CreateProgramModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProgramModal({ open, onClose, onSuccess }: CreateProgramModalProps) {
  const [name, setName] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Array<{email: string, invite_link: string, email_sent: boolean, error?: string}>>([]);
  const [partialFailure, setPartialFailure] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Parse emails (one per line)
      const emailList = emails
        .split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      if (emailList.length === 0) {
        throw new Error('Please enter at least one email address');
      }

      const response = await apiRequest<{
        org_id: string;
        invites: Array<{email: string; invite_link: string; email_sent: boolean; error?: string}>;
        partial_failure: boolean;
      }>(
        '/api/admin/programs',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            facilitator_emails: emailList,
          }),
        }
      );

      setSuccess(true);
      setInviteLinks(response.invites);
      setPartialFailure(response.partial_failure);
    } catch (err: any) {
      setError(err.message || 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (success) {
      onSuccess();
    }
    setName('');
    setEmails('');
    setSuccess(false);
    setInviteLinks([]);
    setPartialFailure(false);
    setError(null);
    onClose();
  };

  if (success) {
    const sentCount = inviteLinks.filter(i => i.email_sent).length;
    const failedCount = inviteLinks.filter(i => !i.email_sent).length;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {partialFailure ? '⚠️ Program Created with Warnings' : '✓ Program Created'}
            </DialogTitle>
            <DialogDescription>
              {partialFailure
                ? 'Your program has been created, but some invites could not be sent.'
                : 'Your program has been created and invites have been sent.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p>
              <strong>{name}</strong> has been created.
            </p>

            {partialFailure && (
              <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                {failedCount} of {inviteLinks.length} invitation emails failed to send.
                You can share the invite links manually below.
              </div>
            )}

            <div>
              <p className="font-medium mb-2">
                Facilitator invitations ({sentCount} sent, {failedCount} failed):
              </p>
              <div className="space-y-2 text-sm">
                {inviteLinks.map((invite, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={invite.email_sent ? "text-green-600" : "text-red-600"}>
                      {invite.email_sent ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <span>{invite.email}</span>
                      {!invite.email_sent && (
                        <div className="mt-1">
                          <span className="text-red-600 text-xs">{invite.error || 'Email failed'}</span>
                          <div className="mt-1">
                            <span className="text-gray-500 text-xs">Manual link: </span>
                            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">
                              {invite.invite_link}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Program</DialogTitle>
          <DialogDescription>
            Set up a new group and invite facilitators to collaborate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Series Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Springfield Dialogue Series - Spring 2026"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emails">Facilitator Emails *</Label>
            <p className="text-sm text-gray-600">
              One email per line. We'll send them invites.
            </p>
            <textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="facilitator1@example.org&#10;facilitator2@example.org&#10;facilitator3@example.org"
              required
              rows={6}
              className="w-full px-3 py-2 border rounded-md resize-y"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={loading}>
              {loading ? 'Creating...' : 'Create & Send Invites'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
