/**
 * EditableCell - Reusable editable cell component with multiple variants
 * Supports Text, Select, RelationSelect (cascading), and Month input types
 */
import React, { useEffect } from 'react';
import { Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';
import type { ProjectScale, ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';

// Reuse constants from ProjectForm
export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'Prospective', label: 'Prospective' },
  { value: 'Planned', label: 'Planned' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'OnHold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export const SCALE_OPTIONS: { value: ProjectScale; label: string }[] = [
  { value: 'CIP', label: 'CIP' },
  { value: 'A&D', label: 'A&D' },
  { value: 'Simple', label: 'Simple' },
  { value: 'Complex', label: 'Complex' },
  { value: 'Platform', label: 'Platform' },
];

export const CATEGORY_OPTIONS: { value: 'PRODUCT' | 'FUNCTIONAL'; label: string }[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'FUNCTIONAL', label: 'Functional' },
];

export const FUNDING_ENTITY_OPTIONS = [
  { value: 'ENTITY_VSS', label: 'VSS Division' },
  { value: 'ENTITY_SUN', label: 'SUN Division' },
  { value: 'ENTITY_LOCAL_KR', label: 'Local Korea' },
  { value: 'ENTITY_SHARED', label: 'Shared Services' },
];

export const RECHARGE_STATUS_OPTIONS = [
  { value: 'BILLABLE', label: 'Billable' },
  { value: 'NON_BILLABLE', label: 'Non-Billable' },
  { value: 'INTERNAL', label: 'Internal' },
];

interface BaseEditableCellProps {
  error?: string;
  className?: string;
}

// Text Input Cell
interface TextCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const TextCell: React.FC<TextCellProps> = ({
  value,
  onChange,
  placeholder,
  error,
  required,
  className
}) => (
  <div className="w-full">
    <Input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-8 text-xs',
        error && 'border-red-500',
        className
      )}
      required={required}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

// Select Cell (generic)
interface SelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectCell: React.FC<SelectCellProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select',
  error,
  className,
}) => (
  <div className="w-full">
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className={cn('h-8 text-xs', error && 'border-red-500', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

// Month Input Cell (YYYY-MM)
interface MonthCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

export const MonthCell: React.FC<MonthCellProps> = ({
  value,
  onChange,
  error,
  className
}) => (
  <div className="w-full">
    <Input
      type="month"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-8 text-xs', error && 'border-red-500', className)}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

// User Select Cell (PM)
interface UserSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  users: Array<{ id: string; name: string }>;
}

const NONE_VALUE = '__NONE__';

export const UserSelectCell: React.FC<UserSelectCellProps> = ({
  value,
  onChange,
  users,
  error,
  className,
}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  };

  return (
    <div className="w-full">
      <Select value={value || NONE_VALUE} onValueChange={handleChange}>
        <SelectTrigger className={cn('h-8 text-xs', error && 'border-red-500', className)}>
          <SelectValue placeholder="Select PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-gray-500">None</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id} className="text-xs">
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

// Business Unit Select Cell
interface BusinessUnitSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  businessUnits: Array<{ id: string; name: string }>;
  onBusinessUnitChange?: (buId: string) => void; // For cascading to Product Line
}

export const BusinessUnitSelectCell: React.FC<BusinessUnitSelectCellProps> = ({
  value,
  onChange,
  businessUnits,
  onBusinessUnitChange,
  error,
  className,
}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue);
    onBusinessUnitChange?.(newValue);
  };

  return (
    <div className="w-full">
      <Select value={value || ''} onValueChange={handleChange}>
        <SelectTrigger className={cn('h-8 text-xs', error && 'border-red-500', className)}>
          <SelectValue placeholder="Select BU" />
        </SelectTrigger>
        <SelectContent>
          {businessUnits.map((bu) => (
            <SelectItem key={bu.id} value={bu.id} className="text-xs">
              {bu.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

// Product Line Select Cell (filtered by Business Unit)
interface ProductLineSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  productLines: Array<{ id: string; name: string; business_unit_id?: string }>;
  selectedBusinessUnitId?: string;
}

export const ProductLineSelectCell: React.FC<ProductLineSelectCellProps> = ({
  value,
  onChange,
  productLines,
  selectedBusinessUnitId,
  error,
  className,
}) => {
  // Filter product lines by selected business unit
  const filteredProductLines = selectedBusinessUnitId
    ? productLines.filter(pl => pl.business_unit_id === selectedBusinessUnitId)
    : productLines;

  // Reset value if it's not in filtered list
  useEffect(() => {
    if (value && !filteredProductLines.find(pl => pl.id === value)) {
      onChange('');
    }
  }, [selectedBusinessUnitId, value, filteredProductLines, onChange]);

  const handleChange = (newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  };

  return (
    <div className="w-full">
      <Select value={value || NONE_VALUE} onValueChange={handleChange}>
        <SelectTrigger
          className={cn('h-8 text-xs', error && 'border-red-500', className)}
          disabled={!selectedBusinessUnitId}
        >
          <SelectValue placeholder={selectedBusinessUnitId ? 'Select Product Line' : 'Select BU first'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-gray-500">None</SelectItem>
          {filteredProductLines.map((pl) => (
            <SelectItem key={pl.id} value={pl.id} className="text-xs">
              {pl.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
