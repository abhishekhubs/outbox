import React, { useState, useEffect } from 'react';
import { useSentEmails } from '../../hooks/useEmails';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { SearchToolbar } from '../ui/SearchToolbar';
import { EmailDetailView } from './EmailDetailView';
import { formatScheduleBadgeDate } from '../../utils/formatters';
import { Send, ExternalLink, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ScheduledEmail } from '../../types';

export const SentEmailsTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});
  const [activeEmail, setActiveEmail] = useState<ScheduledEmail | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, refetch } = useSentEmails({
    page,
    limit: 15,
    search: debouncedSearch || undefined,
  });

  const toggleStar = (id: string) => {
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return <TableSkeleton rows={8} />;
  }

  const emails = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  if (activeEmail) {
    return (
      <EmailDetailView
        email={activeEmail}
        onBack={() => setActiveEmail(null)}
        isStarred={!!starredIds[activeEmail.id]}
        onToggleStar={() => toggleStar(activeEmail.id)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Refresh Bar */}
      <div className="flex items-center justify-between bg-white border border-neutral-200/80 p-2.5 px-3.5 rounded-xl text-xs">
        <SearchToolbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search"
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          rightSlot={
            <div className="text-neutral-400 whitespace-nowrap pl-2">
              Total Sent: <span className="font-semibold text-neutral-800">{total}</span>
            </div>
          }
        />
      </div>

      {/* Minimalist Gmail-Style Sent Email Rows */}
      {emails.length === 0 ? (
        <EmptyState
          title="No delivery history"
          description={
            debouncedSearch
              ? `No sent emails match "${debouncedSearch}".`
              : 'Emails delivered via SMTP will appear here with test preview links.'
          }
          icon={<Send className="w-4 h-4 text-neutral-400" />}
        />
      ) : (
        <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="divide-y divide-neutral-100">
            {emails.map((email) => {
              const isStarred = !!starredIds[email.id];
              const isFailed = email.status === 'failed';
              return (
                <div
                  key={email.id}
                  onClick={() => setActiveEmail(email)}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50/70 transition-colors group cursor-pointer"
                >
                  {/* To: Recipient */}
                  <div
                    className="w-44 sm:w-56 shrink-0 truncate text-xs font-semibold text-neutral-900"
                    title={email.recipient}
                  >
                    To: {email.recipientName || email.recipient}
                  </div>

                  {/* Status + Sent Time Pill */}
                  <div className="shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap',
                        isFailed
                          ? 'bg-rose-50/90 text-rose-600 border-rose-200/80'
                          : 'bg-emerald-50/90 text-emerald-600 border-emerald-200/80'
                      )}
                      title={email.errorMessage || undefined}
                    >
                      {isFailed ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      <span>
                        {isFailed ? 'Failed' : formatScheduleBadgeDate(email.sentAt)}
                      </span>
                    </span>
                  </div>

                  {/* Subject - Body Preview */}
                  <div className="flex-1 min-w-0 truncate text-xs">
                    <span className="font-semibold text-neutral-900">{email.subject}</span>
                    {email.body && (
                      <span className="text-neutral-400 font-normal"> - {email.body}</span>
                    )}
                  </div>

                  {/* Ethereal View Link & Star */}
                  <div className="flex items-center gap-2 shrink-0">
                    {email.etherealUrl && (
                      <a
                        href={email.etherealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 font-medium px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors"
                        title="Open Ethereal preview"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(email.id);
                      }}
                      aria-label="Star email"
                      className="p-1 text-neutral-300 hover:text-amber-400 transition-colors"
                    >
                      <Star
                        className={cn(
                          'w-4 h-4',
                          isStarred && 'fill-amber-400 text-amber-400'
                        )}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={15}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};
