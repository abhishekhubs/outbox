import React from 'react';
import { MailQuestion } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-xl border border-neutral-200/80">
      <div className="w-9 h-9 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-center text-neutral-400 mb-3">
        {icon || <MailQuestion className="w-4 h-4 text-neutral-400" />}
      </div>
      <h3 className="text-xs font-semibold text-neutral-900">{title}</h3>
      <p className="text-xs text-neutral-400 max-w-xs mt-0.5 mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
