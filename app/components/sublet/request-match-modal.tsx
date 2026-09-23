'use client';

import { useState } from 'react';
import { HandshakeIcon } from 'lucide-react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MOCK_MATCH_REQUESTS, CURRENT_USER_ID } from '@/app/lib/mock-data';

interface RequestMatchModalProps {
  subletId: string;
  subletTitle: string;
  ownerName: string;
}

export default function RequestMatchModal({
  subletId,
  subletTitle,
  ownerName,
}: RequestMatchModalProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check if current user already has a request for this sublet
  const existingRequest = MOCK_MATCH_REQUESTS.find(
    (r) => r.subletId === subletId && r.requesterId === CURRENT_USER_ID
  );

  const handleSubmit = async () => {
    setLoading(true);
    // TODO: call API — simulate network delay
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  };

  if (existingRequest) {
    let statusLabel: string;
    let statusColor: string;
    switch (existingRequest.status) {
      case 'pending':
        statusLabel = 'Request sent — waiting for owner response';
        statusColor = 'bg-violet-50 border-violet-200 text-violet-800';
        break;
      case 'accepted':
        statusLabel = 'Match accepted! Check your messages.';
        statusColor = 'bg-green-50 border-green-200 text-green-800';
        break;
      case 'confirmed':
        statusLabel = 'Sublet confirmed';
        statusColor = 'bg-green-50 border-green-200 text-green-800';
        break;
      case 'declined':
        statusLabel = 'Request declined';
        statusColor = 'bg-red-50 border-red-200 text-red-700';
        break;
      case 'cancelled':
        statusLabel = 'Request withdrawn';
        statusColor = 'bg-gray-50 border-gray-200 text-gray-600';
        break;
      case 'listing_removed':
        statusLabel = 'This listing was removed';
        statusColor = 'bg-gray-50 border-gray-200 text-gray-600';
        break;
    }

    return (
      <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${statusColor}`}>
        <CheckCircleIcon className="size-5 shrink-0" />
        <p className="text-sm font-medium">{statusLabel}</p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setMessage(''); setSubmitted(false); } }}>
      <DialogTrigger asChild>
        <button className="w-full px-5 py-2.5 bg-violet-800 text-white text-sm font-semibold rounded-xl hover:bg-violet-900 transition-colors shadow-sm">
          Request Match
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="size-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircleIcon className="size-7 text-green-600" />
            </div>
            <div>
              <DialogTitle>Request sent!</DialogTitle>
              <DialogDescription className="mt-1.5">
                Your match request for <strong>{subletTitle}</strong> has been sent to{' '}
                <strong>{ownerName}</strong>. You&apos;ll be notified when they respond.
              </DialogDescription>
            </div>
            <Button onClick={() => setOpen(false)} className="w-full">Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <HandshakeIcon className="size-5 text-violet-700" />
                <DialogTitle>Request to match</DialogTitle>
              </div>
              <DialogDescription>
                Send a match request to <strong>{ownerName}</strong> for{' '}
                <strong>{subletTitle}</strong>. Add an optional message to introduce yourself.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <label className="text-xs font-medium text-gray-700">
                Message <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder={`Hi ${ownerName}, I'm interested in your listing…`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none text-sm mt-2"
              />
              <p className="text-[11px] text-gray-400 text-right">{message.length}/500</p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Sending…' : 'Send request'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
