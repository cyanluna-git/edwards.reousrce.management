/**
 * ProjectTableFilters - Multi-select filter bar for project inline table
 * Supports Category and Status filtering with active filter count badge
 */
import React from 'react';
import { Button, Badge } from '@/components/ui';
import { X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

const CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'FUNCTIONAL', label: 'Functional' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Planned', label: 'Planned' },
  { value: 'Prospective', label: 'Prospective' },
  { value: 'OnHold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

interface ProjectTableFiltersProps {
  selectedCategories: string[];
  selectedStatuses: string[];
  onCategoryChange: (categories: string[]) => void;
  onStatusChange: (statuses: string[]) => void;
  onClearAll: () => void;
}

export const ProjectTableFilters: React.FC<ProjectTableFiltersProps> = ({
  selectedCategories,
  selectedStatuses,
  onCategoryChange,
  onStatusChange,
  onClearAll,
}) => {
  const activeFilterCount = selectedCategories.length + selectedStatuses.length;

  const toggleCategory = (value: string) => {
    if (selectedCategories.includes(value)) {
      onCategoryChange(selectedCategories.filter(c => c !== value));
    } else {
      onCategoryChange([...selectedCategories, value]);
    }
  };

  const toggleStatus = (value: string) => {
    if (selectedStatuses.includes(value)) {
      onStatusChange(selectedStatuses.filter(s => s !== value));
    } else {
      onStatusChange([...selectedStatuses, value]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-100 border-b border-slate-200">
      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          Category:
        </span>
        <div className="flex gap-1">
          {CATEGORY_OPTIONS.map(option => (
            <Button
              key={option.value}
              variant={selectedCategories.includes(option.value) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => toggleCategory(option.value)}
              className={`h-7 text-xs font-semibold ${
                selectedCategories.includes(option.value)
                  ? 'bg-blue-200 text-blue-900 hover:bg-blue-300'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          Status:
        </span>
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map(option => (
            <Button
              key={option.value}
              variant={selectedStatuses.includes(option.value) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => toggleStatus(option.value)}
              className={`h-7 text-xs font-semibold ${
                selectedStatuses.includes(option.value)
                  ? 'bg-blue-200 text-blue-900 hover:bg-blue-300'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Active Filter Count & Clear All */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="h-6 bg-blue-100 text-blue-800 border-blue-300">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs font-semibold text-gray-700 hover:text-gray-900"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
};
