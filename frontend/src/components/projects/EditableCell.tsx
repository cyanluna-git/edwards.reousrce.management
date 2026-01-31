/**
 * EditableCell - Reusable editable cell component with multiple variants
 * Supports Text, Select, RelationSelect (cascading), and Month input types
 *
 * Optimizations applied:
 * - rerender-memo: All cell components memoized
 * - rerender-dependencies: Primitive dependencies in useEffect
 * - rendering-hoist-jsx: Static elements hoisted
 */
import React, { useEffect, memo, useCallback, useMemo } from 'react';
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

// [rerender-memo] Memoized TextCell
export const TextCell = memo<TextCellProps>(({
  value,
  onChange,
  placeholder,
  error,
  required,
  className
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="w-full">
      <Input
        value={value || ''}
        onChange={handleChange}
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
});

// Select Cell (generic)
interface SelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

// [rerender-memo] Memoized SelectCell
export const SelectCell = memo<SelectCellProps>(({
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
));

// Month Input Cell (YYYY-MM)
interface MonthCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

// [rerender-memo] Memoized MonthCell
export const MonthCell = memo<MonthCellProps>(({
  value,
  onChange,
  error,
  className
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="w-full">
      <Input
        type="month"
        value={value || ''}
        onChange={handleChange}
        className={cn('h-8 text-xs', error && 'border-red-500', className)}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
});

// User Select Cell (PM)
interface UserSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  users: Array<{ id: string; name: string }>;
}

const NONE_VALUE = '__NONE__';

// [rerender-memo] Memoized UserSelectCell
export const UserSelectCell = memo<UserSelectCellProps>(({
  value,
  onChange,
  users,
  error,
  className,
}) => {
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  }, [onChange]);

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
});

// Business Unit Select Cell
interface BusinessUnitSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  businessUnits: Array<{ id: string; name: string }>;
  onBusinessUnitChange?: (buId: string) => void; // For cascading to Product Line
}

// [rerender-memo] Memoized BusinessUnitSelectCell
export const BusinessUnitSelectCell = memo<BusinessUnitSelectCellProps>(({
  value,
  onChange,
  businessUnits,
  onBusinessUnitChange,
  error,
  className,
}) => {
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    onBusinessUnitChange?.(newValue);
  }, [onChange, onBusinessUnitChange]);

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
});

// Internal IO Select Cell
interface InternalIOSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  internalIOs: Array<{ id: string; io_number: string; name?: string }>;
}

// [rerender-memo] Memoized InternalIOSelectCell
export const InternalIOSelectCell = memo<InternalIOSelectCellProps>(({
  value,
  onChange,
  internalIOs,
  error,
  className,
}) => {
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  }, [onChange]);

  return (
    <div className="w-full">
      <Select value={value || NONE_VALUE} onValueChange={handleChange}>
        <SelectTrigger className={cn('h-8 text-xs', error && 'border-red-500', className)}>
          <SelectValue placeholder="Select Internal IO" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-gray-500">None</SelectItem>
          {internalIOs.map((io) => (
            <SelectItem key={io.id} value={io.id} className="text-xs">
              {io.io_number}{io.name ? ` - ${io.name}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
});

// Recharge IO Select Cell
interface RechargeIOSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  rechargeIOs: Array<{ id: string; io_number: string; name?: string }>;
}

// [rerender-memo] Memoized RechargeIOSelectCell
export const RechargeIOSelectCell = memo<RechargeIOSelectCellProps>(({
  value,
  onChange,
  rechargeIOs,
  error,
  className,
}) => {
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  }, [onChange]);

  return (
    <div className="w-full">
      <Select value={value || NONE_VALUE} onValueChange={handleChange}>
        <SelectTrigger className={cn('h-8 text-xs', error && 'border-red-500', className)}>
          <SelectValue placeholder="Select Recharge IO" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE} className="text-xs text-gray-500">None</SelectItem>
          {rechargeIOs.map((io) => (
            <SelectItem key={io.id} value={io.id} className="text-xs">
              {io.io_number}{io.name ? ` - ${io.name}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
});

// Product Line Select Cell (filtered by Business Unit)
interface ProductLineSelectCellProps extends BaseEditableCellProps {
  value: string | undefined;
  onChange: (value: string) => void;
  productLines: Array<{ id: string; name: string; business_unit_id?: string }>;
  selectedBusinessUnitId?: string;
}

// [rerender-memo] Memoized ProductLineSelectCell
export const ProductLineSelectCell = memo<ProductLineSelectCellProps>(({
  value,
  onChange,
  productLines,
  selectedBusinessUnitId,
  error,
  className,
}) => {
  // [rerender-dependencies] Memoize filtered list to stabilize reference
  const filteredProductLines = useMemo(() => {
    return selectedBusinessUnitId
      ? productLines.filter(pl => pl.business_unit_id === selectedBusinessUnitId)
      : productLines;
  }, [productLines, selectedBusinessUnitId]);

  // [rerender-dependencies] Use primitive for dependency check
  // Check if current value exists in filtered list
  const valueExistsInFiltered = useMemo(() => {
    return value ? filteredProductLines.some(pl => pl.id === value) : true;
  }, [value, filteredProductLines]);

  // Reset value only when it becomes invalid
  useEffect(() => {
    if (value && !valueExistsInFiltered) {
      onChange('');
    }
  }, [value, valueExistsInFiltered, onChange]);

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  }, [onChange]);

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
});
