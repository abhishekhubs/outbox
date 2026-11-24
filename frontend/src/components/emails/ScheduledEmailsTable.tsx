import React, { useState, useEffect } from 'react';
import { useScheduledEmails, useCancelEmail } from '../../hooks/useEmails';
import { Button } from '../ui/Button';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { ConfirmModal } from '../modals/ConfirmModal';
import { SearchToolbar } from '../ui/SearchToolbar';
import { EmailDetailView } from './EmailDetailView';
import { formatScheduleBadgeDate } from '../../utils/formatters';
import { Clock, Star } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ScheduledEmail } from '../../types';

export const ScheduledEmailsTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});
  const [activeEmail, setActiveEmail] = useState<ScheduledEmail | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, refetch } = useScheduledEmails({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const cancelMutation = useCancelEmail();

  const toggleStar = (id: string) => {
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCancel = (email: ScheduledEmail) => {
    setSelectedEmail(email);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedEmail) return;
    try {
      await cancelMutation.mutateAsync(selectedEmail.id);
      setIsCancelModalOpen(false);
      setSelectedEmail(null);
    } catch {
      // handled by mutation
    }
  };

  if (isLoading) {
    return <TableSkeleton rows={8} />;
  }

  const emails = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  if (activeEmail) {
    return (
      <>
        <EmailDetailView
          email={activeEmail}
          onBack={() => setActiveEmail(null)}
          onCancel={handleOpenCancel}
          isStarred={!!starredIds[activeEmail.id]}
          onToggleStar={() => toggleStar(activeEmail.id)}
        />
        <ConfirmModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={async () => {
            await handleConfirmCancel();
            setActiveEmail(null);
          }}
          title="Cancel Email"
          message={`Remove scheduled email to ${selectedEmail?.recipient} from the BullMQ queue?`}
          confirmLabel="Remove"
          variant="danger"
          isLoading={cancelMutation.isPending}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search, Filter & Refresh Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-neutral-200/80 p-2.5 px-3.5 rounded-xl text-xs">
        <SearchToolbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search"
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          selectedFilter={statusFilter}
          onFilterChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          filterOptions={[
            { label: 'All Statuses', value: '' },
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'Processing', value: 'processing' },
            { label: 'Retrying', value: 'retrying' },
          ]}
          rightSlot={
            <div className="text-neutral-400 whitespace-nowrap pl-2">
              Total: <span className="font-semibold text-neutral-800">{total}</span>
            </div>
          }
        />
      </div>

      {/* Minimalist Gmail-Style Scheduled Email Rows */}
      {emails.length === 0 ? (
        <EmptyState
          title="No scheduled emails"
          description={
            debouncedSearch || statusFilter
              ? `No scheduled emails match your current search or filter.`
              : 'There are currently no emails waiting in the BullMQ queue.'
          }
          icon={<Clock className="w-4 h-4 text-neutral-400" />}
        />
      ) : (
        <div className="bg-white border border-neutral-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="divide-y divide-neutral-100">
            {emails.map((email) => {
              const isStarred = !!starredIds[email.id];
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

                  {/* Orange Clock Time Pill */}
                  <div className="shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap',
                        email.status === 'processing'
                          ? 'bg-blue-50 text-blue-600 border-blue-200/70 animate-pulse'
                          : 'bg-orange-50/90 text-orange-600 border-orange-200/80'
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{formatScheduleBadgeDate(email.scheduledAt)}</span>
                    </span>
                  </div>

                  {/* Subject - Body Preview */}
                  <div className="flex-1 min-w-0 truncate text-xs">
                    <span className="font-semibold text-neutral-900">{email.subject}</span>
                    {email.body && (
                      <span className="text-neutral-400 font-normal"> - {email.body}</span>
                    )}
                  </div>

                  {/* Right Actions & Star */}
                  <div className="flex items-center gap-2 shrink-0">
                    {email.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCancel(email);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-rose-600 h-6 px-2 text-[11px] font-normal"
                        title="Cancel scheduled email"
                      >
                        Cancel
                      </Button>
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

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Email"
        message={`Remove scheduled email to ${selectedEmail?.recipient} from the BullMQ queue?`}
        confirmLabel="Remove"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
};
