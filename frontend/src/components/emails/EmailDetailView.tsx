import React, { useState } from 'react';
import {
  ArrowLeft,
  Star,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import type { ScheduledEmail } from '../../types';

interface EmailDetailViewProps {
  email: ScheduledEmail;
  onBack: () => void;
  onCancel?: (email: ScheduledEmail) => void;
  isStarred?: boolean;
  onToggleStar?: () => void;
}

function formatDetailTimestamp(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '-';
    return format(date, 'MMM d, h:mm a');
  } catch {
    return '-';
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'File';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  onBack,
  onCancel,
  isStarred = false,
  onToggleStar,
}) => {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  const senderName = email.sender?.displayName || user?.name || 'Outbox Sender';
  const senderEmail = email.sender?.email || user?.email || 'sender@outbox.app';
  const senderInitial = senderName.charAt(0).toUpperCase() || 'O';
  const recipientDisplay = email.recipientName
    ? `${email.recipientName} <${email.recipient}>`
    : email.recipient;
  const displayTimestamp = formatDetailTimestamp(email.sentAt || email.scheduledAt);
  const attachments = Array.isArray(email.attachments) ? email.attachments : [];

  const handleOpenAttachment = async (
    att: NonNullable<ScheduledEmail['attachments']>[number],
    index: number,
    forceDownload = false
  ) => {
    try {
      let blob: Blob;
      const mime = att.contentType || 'application/octet-stream';

      if (att.content) {
        const byteChars = atob(att.content);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
      } else {
        const response = await api.get(`/emails/${email.id}/attachments/${index}`, {
          params: { preview: forceDownload ? '0' : '1' },
          responseType: 'blob',
        });
        blob = response.data;
      }

      const blobUrl = URL.createObjectURL(blob);
      const isInlinePreviewable =
        !forceDownload &&
        (mime.startsWith('image/') ||
          mime === 'application/pdf' ||
          mime.startsWith('text/'));

      if (isInlinePreviewable) {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = att.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      toast.error(`File content unavailable for "${att.filename}". Schedule a new email to test downloads.`);
    }
  };

  return (
    <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Top Action & Subject Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            title="Back to list"
            aria-label="Back to list"
            className="p-1.5 -ml-1.5 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base sm:text-lg font-medium text-neutral-900 truncate">
            {email.subject}
          </h2>
          <div className="hidden sm:block shrink-0">
            <Badge status={email.status} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleStar && (
            <button
              type="button"
              onClick={onToggleStar}
              title="Star"
              aria-label="Star email"
              className="p-1.5 rounded-full text-neutral-400 hover:text-amber-400 hover:bg-neutral-100 transition-colors"
            >
              <Star
                className={cn(
                  'w-4 h-4',
                  isStarred && 'fill-amber-400 text-amber-400'
                )}
              />
            </button>
          )}

          {email.etherealUrl && (
            <a
              href={email.etherealUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Ethereal"
              className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {onCancel && email.status === 'scheduled' && (
            <button
              type="button"
              onClick={() => onCancel(email)}
              title="Cancel scheduled email"
              aria-label="Cancel scheduled email"
              className="p-1.5 rounded-full text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="pl-1.5">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover border border-neutral-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-700 font-medium text-xs flex items-center justify-center border border-neutral-200">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Content Area */}
      <div className="p-5 sm:p-7 space-y-5">
        {/* Sender Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#00a84d] text-white font-semibold text-sm flex items-center justify-center shrink-0">
              {senderInitial}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-semibold text-neutral-900">
                  {senderName}
                </span>
                <span className="text-xs text-neutral-400 font-normal">
                  &lt;{senderEmail}&gt;
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 mt-0.5 transition-colors"
              >
                <span>to {email.recipientName || email.recipient}</span>
                {showDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showDetails && (
                <div className="mt-2 p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 text-xs space-y-1 text-neutral-600 max-w-md">
                  <div>
                    <span className="text-neutral-400 inline-block w-20">From:</span>
                    <span className="text-neutral-800">{senderName} &lt;{senderEmail}&gt;</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 inline-block w-20">To:</span>
                    <span className="text-neutral-800">{recipientDisplay}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 inline-block w-20">Scheduled:</span>
                    <span className="text-neutral-800">{formatDetailTimestamp(email.scheduledAt)}</span>
                  </div>
                  {email.sentAt && (
                    <div>
                      <span className="text-neutral-400 inline-block w-20">Sent:</span>
                      <span className="text-neutral-800">{formatDetailTimestamp(email.sentAt)}</span>
                    </div>
                  )}
                  {email.smtpMessageId && (
                    <div className="truncate">
                      <span className="text-neutral-400 inline-block w-20">Message ID:</span>
                      <span className="font-mono text-[11px] text-neutral-700">{email.smtpMessageId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-neutral-400 whitespace-nowrap shrink-0 pt-0.5">
            {displayTimestamp}
          </div>
        </div>

        {/* Email Body */}
        <div className="pl-12 text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap break-words">
          {email.body}
        </div>

        {/* Error diagnostic if failed */}
        {email.errorMessage && (
          <div className="ml-12 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <span className="font-semibold">Delivery Error:</span> {email.errorMessage}
          </div>
        )}

        {/* Attachments Grid */}
        {attachments.length > 0 && (
          <div className="pl-12 pt-2 flex flex-wrap gap-3">
            {attachments.map((att, idx) => {
              const isImage = att.contentType?.startsWith('image/') && att.content;
              return (
                <div
                  key={idx}
                  onClick={() => handleOpenAttachment(att, idx)}
                  title={`Click to open ${att.filename}`}
                  className="w-52 rounded-xl border border-neutral-200/80 bg-neutral-50/60 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all group cursor-pointer hover:border-neutral-300 hover:shadow-sm"
                >
                  {isImage ? (
                    <img
                      src={`data:${att.contentType};base64,${att.content}`}
                      alt={att.filename}
                      className="w-full h-28 object-cover bg-neutral-100"
                    />
                  ) : (
                    <div className="h-24 flex items-center justify-center bg-neutral-100/70 border-b border-neutral-200/50 relative">
                      <FileText className="w-7 h-7 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                    </div>
                  )}
                  <div className="p-2.5 bg-white flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-800 truncate" title={att.filename}>
                        {att.filename}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {formatBytes(att.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAttachment(att, idx, true);
                      }}
                      title={`Download ${att.filename}`}
                      aria-label={`Download ${att.filename}`}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
