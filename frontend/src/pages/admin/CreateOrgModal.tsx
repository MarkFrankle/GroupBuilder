/**
 * Modal for creating a new organization
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

interface CreateOrgModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOrgModal({ open, onClose, onSuccess }: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<Array<{email: string, invite_link: string}>>([]);

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

      const response = await apiRequest<{org_id: string, invites: Array<{email: string, invite_link: string}>}>(
        '/api/admin/organizations',
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
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
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
    setError(null);
    onClose();
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>✓ Organization Created</DialogTitle>
            <DialogDescription>
              Your organization has been created and invites have been sent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p>
              <strong>{name}</strong> has been created.
            </p>

            <div>
              <p className="font-medium mb-2">
                Invitation emails sent to {inviteLinks.length} facilitators:
              </p>
              <div className="space-y-1 text-sm">
                {inviteLinks.map((invite, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <span>{invite.email}</span>
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
          <DialogTitle>Create Organization</DialogTitle>
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
