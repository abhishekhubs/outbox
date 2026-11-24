import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return '-';
    return format(date, 'MMM d, yyyy h:mm a');
  } catch {
    return '-';
  }
}

export function formatScheduleBadgeDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return '-';
    return format(date, 'EEE h:mm:ss a');
  } catch {
    return '-';
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return '-';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '-';
  }
}

export function getStatusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'sent':
      return 'text-emerald-700 bg-emerald-50/70 border border-emerald-200/60';
    case 'scheduled':
      return 'text-blue-700 bg-blue-50/70 border border-blue-200/60';
    case 'processing':
      return 'text-amber-700 bg-amber-50/70 border border-amber-200/60 animate-pulse';
    case 'retrying':
      return 'text-yellow-700 bg-yellow-50/70 border border-yellow-200/60';
    case 'failed':
      return 'text-rose-700 bg-rose-50/70 border border-rose-200/60';
    case 'cancelled':
      return 'text-slate-600 bg-slate-100/70 border border-slate-200/60';
    default:
      return 'text-slate-600 bg-slate-100/70 border border-slate-200/60';
  }
}

export function getStatusDotColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'sent':
      return 'bg-emerald-400';
    case 'scheduled':
      return 'bg-blue-400';
    case 'processing':
      return 'bg-amber-400';
    case 'retrying':
      return 'bg-yellow-400';
    case 'failed':
      return 'bg-rose-400';
    case 'cancelled':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
}
