import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useScheduledEmails, useSearchEmails } from '../../hooks/useEmails';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { SearchToolbar } from '../ui/SearchToolbar';
import { EmailDetailView } from '../emails/EmailDetailView';
import { formatScheduleBadgeDate } from '../../utils/formatters';
import { ArrowRight, Clock, Star, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ScheduledEmail } from '../../types';

export const RecentEmails: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});
  const [activeEmail, setActiveEmail] = useState<ScheduledEmail | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleStar = (id: string) => {
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isSearching = debouncedSearch.length > 0 || statusFilter.length > 0;

  const recentQuery = useScheduledEmails({ limit: 8 });
  const searchQuery = useSearchEmails(
    debouncedSearch || ' ',
    statusFilter ? { status: statusFilter } : undefined
  );

  const activeQuery = isSearching && debouncedSearch.length > 0 ? searchQuery : recentQuery;
  const isLoading = activeQuery.isLoading;

  const rawEmails = activeQuery.data?.data || [];
  const emails = statusFilter
    ? rawEmails.filter((e) => e.status === statusFilter)
    : rawEmails;

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
      {/* Minimalist Pill Search Bar matching design */}
      <div className="bg-white border border-neutral-200/80 p-2.5 px-3.5 rounded-xl">
        <SearchToolbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search"
          onRefresh={() => activeQuery.refetch()}
          isRefreshing={activeQuery.isFetching}
          selectedFilter={statusFilter}
          onFilterChange={setStatusFilter}
          filterOptions={[
            { label: 'All Statuses', value: '' },
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'Processing', value: 'processing' },
            { label: 'Sent', value: 'sent' },
            { label: 'Failed', value: 'failed' },
          ]}
        />
      </div>

      <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              {debouncedSearch ? `Search Results (${emails.length})` : 'Recent Activity'}
            </h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {debouncedSearch
                ? `Showing matches for "${debouncedSearch}"`
                : 'Upcoming scheduled and recently queued emails'}
            </p>
          </div>
          <Link
            to="/dashboard/scheduled"
            className="text-xs text-neutral-500 hover:text-neutral-900 font-medium flex items-center gap-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : emails.length === 0 ? (
          <EmptyState
            title={debouncedSearch ? 'No matching emails' : 'No emails in queue'}
            description={
              debouncedSearch
                ? `No emails found matching "${debouncedSearch}".`
                : 'Schedule your first batch of emails to see queue execution.'
            }
            icon={<Clock className="w-4 h-4 text-neutral-400" />}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {emails.map((email) => {
              const isStarred = !!starredIds[email.id];
              const isSent = email.status === 'sent';
              const isFailed = email.status === 'failed';
              return (
                <div
                  key={email.id}
                  onClick={() => setActiveEmail(email)}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50/70 transition-colors cursor-pointer"
                >
                  <div
                    className="w-44 sm:w-56 shrink-0 truncate text-xs font-semibold text-neutral-900"
                    title={email.recipient}
                  >
                    To: {email.recipientName || email.recipient}
                  </div>
                  <div className="shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap',
                        isSent
                          ? 'bg-emerald-50/90 text-emerald-600 border-emerald-200/80'
                          : isFailed
                            ? 'bg-rose-50/90 text-rose-600 border-rose-200/80'
                            : 'bg-orange-50/90 text-orange-600 border-orange-200/80'
                      )}
                    >
                      {isSent ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isFailed ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{formatScheduleBadgeDate(email.scheduledAt)}</span>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 truncate text-xs">
                    <span className="font-semibold text-neutral-900">{email.subject}</span>
                    {email.body && (
                      <span className="text-neutral-400 font-normal"> - {email.body}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(email.id);
                    }}
                    aria-label="Star email"
                    className="p-1 text-neutral-300 hover:text-amber-400 transition-colors shrink-0"
                  >
                    <Star
                      className={cn(
                        'w-4 h-4',
                        isStarred && 'fill-amber-400 text-amber-400'
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
