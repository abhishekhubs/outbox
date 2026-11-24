import React from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-neutral-600">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-900 transition-colors focus:outline-none focus:border-neutral-900 disabled:opacity-50 disabled:bg-neutral-50',
            error && 'border-rose-500 focus:border-rose-500',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white text-neutral-900">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
