import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, RefreshCw, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface FilterOption {
  label: string;
  value: string;
}

interface SearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  filterOptions?: FilterOption[];
  selectedFilter?: string;
  onFilterChange?: (value: string) => void;
  rightSlot?: React.ReactNode;
}

export const SearchToolbar: React.FC<SearchToolbarProps> = ({
  value,
  onChange,
  placeholder = 'Search',
  onRefresh,
  isRefreshing = false,
  filterOptions,
  selectedFilter = '',
  onFilterChange,
  rightSlot,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Pill-shaped Search Input matching minimalist design */}
      <div className="relative flex-1 max-w-2xl">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white border border-transparent focus:border-neutral-300 rounded-full pl-10 pr-9 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 rounded-full hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Icon & Popover */}
      {filterOptions && onFilterChange && (
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            title="Filter by status"
            aria-label="Filter"
            className={cn(
              'p-2 rounded-full transition-colors relative',
              selectedFilter
                ? 'text-neutral-900 bg-neutral-200/70'
                : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
            )}
          >
            <Filter className="w-4 h-4" />
            {selectedFilter && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 mt-1.5 w-40 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Filter Status
              </div>
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onFilterChange(opt.value);
                    setIsFilterOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between',
                    selectedFilter === opt.value
                      ? 'bg-neutral-100 text-neutral-900 font-medium'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                >
                  <span>{opt.label}</span>
                  {selectedFilter === opt.value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refresh Icon Button */}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          aria-label="Refresh"
          className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-neutral-700')} />
        </button>
      )}

      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
};
