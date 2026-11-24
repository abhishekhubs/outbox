import React from 'react';
import { cn } from '../../utils/cn';
import { getStatusBadgeClasses, getStatusDotColor } from '../../utils/formatters';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  status,
  variant,
  children,
  ...props
}) => {
  let badgeStyle = '';
  let dotColor = '';

  if (status) {
    badgeStyle = getStatusBadgeClasses(status);
    dotColor = getStatusDotColor(status);
  } else {
    switch (variant) {
      case 'success':
        badgeStyle = 'text-emerald-700 bg-emerald-50/60 border border-emerald-200/50';
        dotColor = 'bg-emerald-400';
        break;
      case 'warning':
        badgeStyle = 'text-amber-700 bg-amber-50/60 border border-amber-200/50';
        dotColor = 'bg-amber-400';
        break;
      case 'error':
        badgeStyle = 'text-rose-700 bg-rose-50/60 border border-rose-200/50';
        dotColor = 'bg-rose-400';
        break;
      case 'info':
        badgeStyle = 'text-blue-700 bg-blue-50/60 border border-blue-200/50';
        dotColor = 'bg-blue-400';
        break;
      default:
        badgeStyle = 'text-neutral-700 bg-neutral-100/60 border border-neutral-200/50';
        dotColor = 'bg-neutral-400';
        break;
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium capitalize select-none',
        badgeStyle,
        className
      )}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      {children || status}
    </span>
  );
};
