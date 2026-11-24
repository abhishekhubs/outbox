import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Clock,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Check,
  User,
  ChevronDown,
  Undo2,
  Redo2,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  ListOrdered,
  List,
  Outdent,
  Indent,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { parseEmailFile } from '../../utils/csv-parser';
import { lookupRecipient } from '../../services/email.service';
import { useScheduleEmails } from '../../hooks/useEmails';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import type { EmailAttachment } from '../../types';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttachedFileItem {
  filename: string;
  size: number;
  content: string; // base64
  contentType?: string;
}

function getTomorrowAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const scheduleMutation = useScheduleEmails();

  const [fromEmail, setFromEmail] = useState(user?.email || 'sender@outbox.app');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [recipientParams, setRecipientParams] = useState<Record<string, Record<string, string>>>({});
  const [manualInput, setManualInput] = useState('');
  const [lookedUpName, setLookedUpName] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState<string>('2000');
  const [hourlyLimit, setHourlyLimit] = useState<string>('200');

  const [attachments, setAttachments] = useState<AttachedFileItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [attachedNotification, setAttachedNotification] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Send Later popover state
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [draftStartTime, setDraftStartTime] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const sendLaterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.email) {
      setFromEmail(user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sendLaterRef.current && !sendLaterRef.current.contains(e.target as Node)) {
        setIsSendLaterOpen(false);
      }
    };
    if (isSendLaterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSendLaterOpen]);

  // Live saved-name lookup while typing an email
  useEffect(() => {
    const trimmed = manualInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setLookedUpName(null);
      setIsLookingUp(false);
      return;
    }

    let cancelled = false;
    setIsLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await lookupRecipient(trimmed);
        if (!cancelled) setLookedUpName(res.name || null);
      } catch {
        if (!cancelled) setLookedUpName(null);
      } finally {
        if (!cancelled) setIsLookingUp(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [manualInput]);

  const attachFileDirectly = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1] || '';
      setAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          size: file.size,
          content: base64Data,
          contentType: file.type || 'application/octet-stream',
        },
      ]);
      setAttachedNotification(`"${file.name}" attached to email`);
      setParseErrors([]);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadList = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isLeadText =
        file.name.endsWith('.csv') ||
        file.name.endsWith('.txt') ||
        file.type.includes('text') ||
        file.type.includes('csv');

      if (!isLeadText) {
        attachFileDirectly(file);
        return;
      }

      const result = await parseEmailFile(file);
      if (result.emails.length > 0) {
        setRecipients((prev) => Array.from(new Set([...prev, ...result.emails])));
        if (result.recipientParams) {
          setRecipientParams((prev) => ({ ...prev, ...result.recipientParams }));
        }
        const validErrors = result.errors.filter(
          (err) => !err.toLowerCase().includes('no email addresses')
        );
        setParseErrors(validErrors);
        setDuplicateCount(result.duplicates);
        setAttachedNotification(null);
      } else {
        attachFileDirectly(file);
      }
    } catch {
      attachFileDirectly(file);
    } finally {
      e.target.value = '';
    }
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => attachFileDirectly(file));
    e.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddManualEmail = async () => {
    const raw = manualInput.replace(/,$/, '').trim().toLowerCase();
    if (!raw) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(raw)) {
      setParseErrors(['Invalid email format']);
      return;
    }
    if (recipients.includes(raw)) {
      setDuplicateCount((c) => c + 1);
    } else {
      let resolvedName = lookedUpName;
      if (!resolvedName) {
        try {
          const res = await lookupRecipient(raw);
          resolvedName = res.name;
        } catch {
          // ignore
        }
      }
      if (resolvedName) {
        setRecipientParams((prev) => ({
          ...prev,
          [raw]: { ...(prev[raw] || {}), Name: resolvedName! },
        }));
      }
      setRecipients((prev) => [...prev, raw]);
      setParseErrors([]);
    }
    setManualInput('');
    setLookedUpName(null);
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBodyText(editorRef.current.innerText || '');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleConfirmSendLater = () => {
    if (draftStartTime) {
      setScheduledStartTime(draftStartTime);
    }
    setIsSendLaterOpen(false);
  };

  const handleClearSendLater = () => {
    setScheduledStartTime(null);
    setDraftStartTime('');
    setIsSendLaterOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveRecipients = [...recipients];
    const pendingEmail = manualInput.trim().toLowerCase();
    if (
      pendingEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail) &&
      !effectiveRecipients.includes(pendingEmail)
    ) {
      effectiveRecipients.push(pendingEmail);
    }

    if (effectiveRecipients.length === 0) {
      setParseErrors(['Please enter or import at least one recipient email address']);
      return;
    }

    if (!subject.trim()) {
      setParseErrors(['Subject is required']);
      return;
    }

    const plainBody = (editorRef.current?.innerText || bodyText).trim();
    if (!plainBody) {
      setParseErrors(['Email body is required']);
      return;
    }

    try {
      let isoStartTime: string;
      if (scheduledStartTime) {
        const d = new Date(scheduledStartTime);
        isoStartTime = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } else {
        isoStartTime = new Date().toISOString();
      }

      const emailAttachments: EmailAttachment[] = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));

      const parsedDelay = Math.max(500, Number(delayBetweenEmails) || 2000);
      const parsedLimit = Math.max(1, Math.min(2000, Number(hourlyLimit) || 200));

      const result = await scheduleMutation.mutateAsync({
        subject: subject.trim(),
        body: plainBody,
        recipients: effectiveRecipients,
        recipientParams: Object.keys(recipientParams).length > 0 ? recipientParams : undefined,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        startTime: isoStartTime,
        delayBetweenEmails: parsedDelay,
        hourlyLimit: parsedLimit,
      });

      setSuccessMessage(
        scheduledStartTime
          ? `Scheduled ${result.emailCount} email(s) successfully`
          : `Queued ${result.emailCount} email(s) for delivery`
      );
      toast.success(
        scheduledStartTime
          ? `Scheduled ${result.emailCount} email(s)`
          : `Queued ${result.emailCount} email(s)`
      );

      setTimeout(() => {
        setRecipients([]);
        setRecipientParams({});
        setAttachments([]);
        setSubject('');
        setBodyText('');
        setManualInput('');
        setScheduledStartTime(null);
        setDraftStartTime('');
        setAttachedNotification(null);
        setSuccessMessage(null);
        onClose();
      }, 1400);
    } catch (err: any) {
      const details = err.response?.data?.error?.details;
      if (Array.isArray(details) && details.length > 0) {
        setParseErrors(details.map((d: any) => `${d.field}: ${d.message}`));
      } else {
        setParseErrors([err.response?.data?.error?.message || err.message || 'Scheduling failed']);
      }
    }
  };

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, 3);
  const extraCount = recipients.length - 3;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email"
      description="Queue delayed emails with rich formatting, attachments, and rate limits"
      size="xl"
    >
      {successMessage ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-900">{successMessage}</h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            BullMQ jobs enqueued with Redis persistence.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* From Selector Row */}
          <div className="flex items-center gap-3">
            <label className="w-16 text-xs font-medium text-neutral-600 shrink-0">From</label>
            <div className="relative inline-flex items-center">
              <select
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="appearance-none bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-neutral-800 focus:outline-none focus:border-neutral-400 cursor-pointer transition-colors"
              >
                <option value={user?.email || 'sender@outbox.app'}>
                  {user?.email || 'sender@outbox.app'}
                </option>
                <option value="kaitlyn.ledner66@ethereal.email">
                  kaitlyn.ledner66@ethereal.email
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Recipients (To) Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-neutral-700">
                To ({recipients.length})
              </label>
              <div className="flex items-center gap-3">
                {duplicateCount > 0 && (
                  <span className="text-[11px] text-amber-600">
                    {duplicateCount} duplicate(s) omitted
                  </span>
                )}
                <label className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 cursor-pointer border border-neutral-200 px-2.5 py-1 rounded-md bg-white hover:bg-neutral-50 transition-colors">
                  <Upload className="w-3 h-3 text-neutral-500" />
                  <span>Upload List (.csv / .txt)</span>
                  <input
                    type="file"
                    accept="*/*"
                    onChange={handleUploadList}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Inline Recipient Chips + Manual Email Input */}
            <div className="bg-white border border-neutral-200 rounded-lg p-2 flex flex-wrap items-center gap-1.5 focus-within:border-neutral-900 transition-colors">
              {visibleRecipients.map((email, idx) => {
                const savedName = recipientParams[email]?.Name || recipientParams[email]?.name;
                return (
                  <span
                    key={idx}
                    title={email}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 text-[11px] text-neutral-800 border border-neutral-200"
                  >
                    <span>{savedName ? `${savedName} (${email})` : email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(idx)}
                      className="text-neutral-400 hover:text-neutral-900"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}

              {!showAllRecipients && extraCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllRecipients(true)}
                  className="px-2 py-0.5 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-700 border border-neutral-200 hover:bg-neutral-200/70"
                >
                  +{extraCount}
                </button>
              )}

              <input
                type="email"
                placeholder={recipients.length === 0 ? 'name@example.com' : 'Add recipient...'}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddManualEmail();
                  }
                }}
                className="flex-1 min-w-[160px] text-xs text-neutral-800 placeholder-neutral-400 bg-transparent focus:outline-none px-1 py-0.5"
              />

              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddManualEmail}
                className="h-6 px-2.5 text-[11px]"
              >
                Add
              </Button>
            </div>

            {(isLookingUp || lookedUpName) && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-neutral-500">
                <User className="w-3 h-3 text-emerald-600 shrink-0" />
                {isLookingUp ? (
                  <span>Looking up saved name...</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddManualEmail}
                    className="text-emerald-700 hover:underline font-medium truncate"
                  >
                    Saved name: {lookedUpName} (click to add)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Subject</label>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors"
            />
          </div>

          {/* Rich Text Editor Content */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Content</label>
            <div className="bg-neutral-50/80 border border-neutral-200/80 rounded-xl p-3 flex flex-col">
              {/* Formatting Toolbar */}
              <div className="bg-white border border-neutral-200/70 rounded-lg px-2 py-1 inline-flex items-center gap-0.5 flex-wrap w-fit mb-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <button
                  type="button"
                  onClick={() => execFormat('undo')}
                  title="Undo"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('redo')}
                  title="Redo"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => execFormat('fontSize', '4')}
                  title="Text Size"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Type className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => execFormat('bold')}
                  title="Bold"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('italic')}
                  title="Italic"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('underline')}
                  title="Underline"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => execFormat('justifyLeft')}
                  title="Align Left"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('justifyCenter')}
                  title="Align Center"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => execFormat('insertOrderedList')}
                  title="Numbered List"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertUnorderedList')}
                  title="Bullet List"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('outdent')}
                  title="Decrease Indent"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Outdent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('indent')}
                  title="Increase Indent"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Indent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', 'blockquote')}
                  title="Quote"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('removeFormat')}
                  title="Clear Formatting"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <RemoveFormatting className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-neutral-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => execFormat('strikeThrough')}
                  title="Strikethrough"
                  className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Editable Area */}
              <div className="relative">
                {!bodyText && (
                  <div className="absolute top-0 left-0 text-xs text-neutral-400 pointer-events-none select-none">
                    Write your email body...
                  </div>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setBodyText(e.currentTarget.innerText || '')}
                  className="w-full min-h-[120px] max-h-[220px] overflow-y-auto text-xs text-neutral-800 leading-relaxed focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dedicated File Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-neutral-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                <span>File Attachments ({attachments.length})</span>
              </label>

              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className="cursor-pointer text-xs font-medium text-neutral-800 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-400 px-2.5 py-1 rounded-md bg-white hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Paperclip className="w-3 h-3 text-neutral-500" />
                <span>+ Attach files</span>
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={handleAttachmentUpload}
                className="hidden"
              />
            </div>

            {attachedNotification && (
              <div className="p-2 rounded-md bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1.5 border border-emerald-200/60">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{attachedNotification}</span>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 p-2.5 bg-neutral-50 rounded-lg border border-neutral-200/60">
                {attachments.map((file, idx) => {
                  const isImage = file.contentType?.startsWith('image/') && file.content;
                  return (
                    <div
                      key={idx}
                      className="w-40 rounded-lg border border-neutral-200 bg-white overflow-hidden relative group shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        title="Remove attachment"
                        className="absolute top-1 right-1 z-10 p-1 rounded-full bg-white/90 text-neutral-400 hover:text-rose-600 shadow-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {isImage ? (
                        <img
                          src={`data:${file.contentType};base64,${file.content}`}
                          alt={file.filename}
                          className="w-full h-20 object-cover bg-neutral-100"
                        />
                      ) : (
                        <div className="h-14 flex items-center justify-center bg-neutral-50 border-b border-neutral-100">
                          <FileText className="w-5 h-5 text-neutral-400" />
                        </div>
                      )}
                      <div className="p-2">
                        <div className="text-[11px] font-medium text-neutral-800 truncate" title={file.filename}>
                          {file.filename}
                        </div>
                        <div className="text-[10px] text-neutral-400">{formatFileSize(file.size)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Errors */}
          {parseErrors.length > 0 && (
            <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-600 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                {parseErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            </div>
          )}

          {/* Scheduling Configuration (Delay, Hourly Cap, Send Later Popover) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-100">
            {/* Send Later / Start Time */}
            <div className="relative" ref={sendLaterRef}>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Schedule Time
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!draftStartTime) {
                    setDraftStartTime(scheduledStartTime || getTomorrowAt(10, 0));
                  }
                  setIsSendLaterOpen((prev) => !prev);
                }}
                className="w-full flex items-center justify-between bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-2 text-xs text-neutral-800 transition-colors"
              >
                <span className="truncate flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>
                    {scheduledStartTime
                      ? new Date(scheduledStartTime).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Send Now (Immediate)'}
                  </span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              </button>

              {isSendLaterOpen && (
                <div className="absolute left-0 bottom-11 w-72 bg-white border border-neutral-200 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.1)] p-4 z-40">
                  <h3 className="text-xs font-semibold text-neutral-900 mb-2.5">Send Later</h3>
                  <div className="relative border-b border-neutral-200 pb-2 mb-2.5">
                    <input
                      type="datetime-local"
                      value={draftStartTime}
                      onChange={(e) => setDraftStartTime(e.target.value)}
                      className="w-full text-xs text-neutral-700 bg-transparent focus:outline-none pr-6"
                      aria-label="Pick date & time"
                    />
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute right-0 top-0.5 pointer-events-none" />
                  </div>

                  <div className="space-y-1 text-xs text-neutral-600 mb-3">
                    {[
                      {
                        label: 'Tomorrow',
                        value: getTomorrowAt(new Date().getHours(), new Date().getMinutes()),
                      },
                      { label: 'Tomorrow, 10:00 AM', value: getTomorrowAt(10, 0) },
                      { label: 'Tomorrow, 11:00 AM', value: getTomorrowAt(11, 0) },
                      { label: 'Tomorrow, 3:00 PM', value: getTomorrowAt(15, 0) },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setDraftStartTime(preset.value)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded-md transition-colors',
                          draftStartTime === preset.value
                            ? 'bg-neutral-100 text-neutral-900 font-medium'
                            : 'hover:bg-neutral-50 text-neutral-600'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearSendLater}>
                      Send Now
                    </Button>
                    <Button type="button" variant="primary" size="sm" onClick={handleConfirmSendLater}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Delay between 2 emails */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Delay between 2 emails (ms)
              </label>
              <input
                type="number"
                min={500}
                max={60000}
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
              />
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Hourly Limit
              </label>
              <input
                type="number"
                min={1}
                max={2000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={scheduleMutation.isPending}
              disabled={recipients.length === 0 && !manualInput.trim()}
            >
              {scheduledStartTime
                ? `Send Later${recipients.length > 0 ? ` (${recipients.length})` : ''}`
                : `Send${recipients.length > 0 ? ` (${recipients.length})` : ''}`}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
