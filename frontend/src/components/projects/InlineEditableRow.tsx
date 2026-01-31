/**
 * InlineEditableRow - Row component with View/Edit mode toggling
 * Displays project data with inline editing capabilities
 *
 * Optimizations applied:
 * - rerender-memo: Wrapped with React.memo
 * - rendering-hoist-jsx: Static JSX hoisted outside
 * - js-index-maps: Map for O(1) lookups
 */
import React, { useState, memo, useCallback } from 'react';
import { TableRow, TableCell, Button } from '@/components/ui';
import { Edit2, Save, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import {
  TextCell,
  SelectCell,
  MonthCell,
  UserSelectCell,
  BusinessUnitSelectCell,
  ProductLineSelectCell,
  InternalIOSelectCell,
  RechargeIOSelectCell,
  STATUS_OPTIONS,
  SCALE_OPTIONS,
  CATEGORY_OPTIONS,
  FUNDING_ENTITY_OPTIONS,
  RECHARGE_STATUS_OPTIONS,
} from './EditableCell';

// [rendering-hoist-jsx] Static placeholder JSX
const EmptyPlaceholder = <span className="text-gray-400">-</span>;

// [js-index-maps] Build Map for O(1) lookups instead of .find() each render
const FUNDING_ENTITY_MAP = new Map(
  FUNDING_ENTITY_OPTIONS.map(o => [o.value, o.label])
);

// Column width type matching COLUMN_CONFIG keys
type ColumnWidths = {
  internal_io: number;
  recharge_io: number;
  name: number;
  category: number;
  status: number;
  business_unit: number;
  product_line: number;
  pm: number;
  scale: number;
  customer: number;
  product: number;
  start_month: number;
  end_month: number;
  funding_entity: number;
  recharge_status: number;
};

interface InlineEditableRowProps {
  project: Project;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: () => Promise<boolean>;
  onCancel: () => void;
  onDelete: () => void;
  editState: {
    fields: any;
    errors: Record<string, string>;
  };
  updateField: (field: keyof import('@/types').ProjectUpdate, value: any) => void;
  isSaving: boolean;
  canEdit: boolean;
  showFinancialColumns: boolean;
  // Reference data
  businessUnits: Array<{ id: string; name: string }>;
  productLines: Array<{ id: string; name: string; business_unit_id?: string }>;
  users: Array<{ id: string; name: string }>;
  internalIOs: Array<{ id: string; io_number: string; name?: string }>;
  rechargeIOs: Array<{ id: string; io_number: string; name?: string }>;
  // Column widths for resizing
  columnWidths: ColumnWidths;
}

// [rerender-memo] Memoized row component to prevent unnecessary re-renders
const InlineEditableRowInner: React.FC<InlineEditableRowProps> = ({
  project,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  editState,
  updateField,
  isSaving,
  canEdit,
  showFinancialColumns,
  businessUnits,
  productLines,
  users,
  internalIOs,
  rechargeIOs,
  columnWidths,
}) => {
  const [selectedBU, setSelectedBU] = useState<string>(
    editState.fields.program_id || project.program?.business_unit_id || ''
  );

  // [rerender-functional-setstate] Memoized handlers
  const handleSave = useCallback(async () => {
    const success = await onSave();
    if (!success) {
      // Stay in edit mode if save failed
      return;
    }
  }, [onSave]);

  const handleBusinessUnitChange = useCallback((buId: string) => {
    setSelectedBU(buId);
    // Find program for this BU (simplified - in real app, fetch programs by BU)
    const bu = businessUnits.find(b => b.id === buId);
    if (bu) {
      // Note: This is simplified. In production, you'd need to fetch/filter programs by BU
      updateField('program_id', project.program_id); // Keep existing for now
    }
  }, [businessUnits, updateField, project.program_id]);

  if (isEditing) {
    return (
      <TableRow className="bg-blue-50 border-l-4 border-blue-500">
        {/* Internal IO */}
        <TableCell style={{ width: columnWidths.internal_io }}>
          <InternalIOSelectCell
            value={editState.fields.internal_io_id}
            onChange={(value) => updateField('internal_io_id', value)}
            internalIOs={internalIOs}
            error={editState.errors.internal_io_id}
          />
        </TableCell>

        {/* Recharge IO */}
        <TableCell style={{ width: columnWidths.recharge_io }}>
          <RechargeIOSelectCell
            value={editState.fields.recharge_io_id}
            onChange={(value) => updateField('recharge_io_id', value)}
            rechargeIOs={rechargeIOs}
            error={editState.errors.recharge_io_id}
          />
        </TableCell>

        {/* Name */}
        <TableCell style={{ width: columnWidths.name }}>
          <TextCell
            value={editState.fields.name}
            onChange={(value) => updateField('name', value)}
            error={editState.errors.name}
            required
            placeholder="Project name"
            className="w-full"
          />
        </TableCell>

        {/* Category */}
        <TableCell style={{ width: columnWidths.category }}>
          <SelectCell
            value={editState.fields.category}
            onChange={(value) => updateField('category', value)}
            options={CATEGORY_OPTIONS}
            error={editState.errors.category}
          />
        </TableCell>

        {/* Status */}
        <TableCell style={{ width: columnWidths.status }}>
          <SelectCell
            value={editState.fields.status}
            onChange={(value) => updateField('status', value)}
            options={STATUS_OPTIONS}
            error={editState.errors.status}
          />
        </TableCell>

        {/* Business Unit */}
        <TableCell style={{ width: columnWidths.business_unit }}>
          <BusinessUnitSelectCell
            value={selectedBU}
            onChange={(value) => handleBusinessUnitChange(value)}
            businessUnits={businessUnits}
            error={editState.errors.program_id}
          />
        </TableCell>

        {/* Product Line */}
        <TableCell style={{ width: columnWidths.product_line }}>
          <ProductLineSelectCell
            value={editState.fields.product_line_id}
            onChange={(value) => updateField('product_line_id', value)}
            productLines={productLines}
            selectedBusinessUnitId={selectedBU}
            error={editState.errors.product_line_id}
          />
        </TableCell>

        {/* PM */}
        <TableCell style={{ width: columnWidths.pm }}>
          <UserSelectCell
            value={editState.fields.pm_id}
            onChange={(value) => updateField('pm_id', value)}
            users={users}
            error={editState.errors.pm_id}
          />
        </TableCell>

        {/* Scale */}
        <TableCell style={{ width: columnWidths.scale }}>
          <SelectCell
            value={editState.fields.scale}
            onChange={(value) => updateField('scale', value)}
            options={SCALE_OPTIONS}
            placeholder="Select scale"
            error={editState.errors.scale}
          />
        </TableCell>

        {/* Customer */}
        <TableCell style={{ width: columnWidths.customer }}>
          <TextCell
            value={editState.fields.customer}
            onChange={(value) => updateField('customer', value)}
            placeholder="Customer"
            className="w-full"
          />
        </TableCell>

        {/* Product */}
        <TableCell style={{ width: columnWidths.product }}>
          <TextCell
            value={editState.fields.product}
            onChange={(value) => updateField('product', value)}
            placeholder="Product"
            className="w-full"
          />
        </TableCell>

        {/* Start Month */}
        <TableCell style={{ width: columnWidths.start_month }}>
          <MonthCell
            value={editState.fields.start_month}
            onChange={(value) => updateField('start_month', value)}
            error={editState.errors.start_month}
          />
        </TableCell>

        {/* End Month */}
        <TableCell style={{ width: columnWidths.end_month }}>
          <MonthCell
            value={editState.fields.end_month}
            onChange={(value) => updateField('end_month', value)}
            error={editState.errors.end_month}
          />
        </TableCell>

        {/* Financial Columns (conditional) */}
        {showFinancialColumns && (
          <>
            <TableCell style={{ width: columnWidths.funding_entity }}>
              <SelectCell
                value={editState.fields.funding_entity_id}
                onChange={(value) => updateField('funding_entity_id', value)}
                options={FUNDING_ENTITY_OPTIONS}
                placeholder="Select entity"
              />
            </TableCell>
            <TableCell style={{ width: columnWidths.recharge_status }}>
              <SelectCell
                value={editState.fields.recharge_status}
                onChange={(value) => updateField('recharge_status', value)}
                options={RECHARGE_STATUS_OPTIONS}
                placeholder="Select status"
              />
            </TableCell>
          </>
        )}

        {/* Actions - sticky right, icon-only buttons */}
        <TableCell className="sticky right-0 bg-blue-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
          <div className="flex gap-1 justify-center">
            <Button
              size="icon"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 w-7"
              title={isSaving ? 'Saving...' : 'Save'}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="h-7 w-7"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // View Mode
  return (
    <TableRow className="bg-white hover:bg-slate-50">
      {/* Internal IO */}
      <TableCell className="font-mono text-xs text-gray-900 truncate" style={{ width: columnWidths.internal_io }}>
        {project.internal_io?.io_number || '-'}
      </TableCell>

      {/* Recharge IO */}
      <TableCell className="font-mono text-xs text-gray-900 truncate" style={{ width: columnWidths.recharge_io }}>
        {project.recharge_io?.io_number || '-'}
      </TableCell>

      {/* Name */}
      <TableCell className="font-medium text-gray-900 truncate" style={{ width: columnWidths.name }}>
        {project.name}
      </TableCell>

      {/* Category */}
      <TableCell style={{ width: columnWidths.category }}>
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
            project.category === 'PRODUCT'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          )}
        >
          {project.category === 'PRODUCT' ? 'Product' : 'Functional'}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell style={{ width: columnWidths.status }}>
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
            project.status === 'InProgress' && 'bg-green-100 text-green-800',
            project.status === 'Planned' && 'bg-blue-100 text-blue-800',
            project.status === 'Prospective' && 'bg-yellow-100 text-yellow-800',
            project.status === 'OnHold' && 'bg-orange-100 text-orange-800',
            project.status === 'Completed' && 'bg-gray-200 text-gray-700',
            project.status === 'Cancelled' && 'bg-red-100 text-red-800'
          )}
        >
          {project.status}
        </span>
      </TableCell>

      {/* Business Unit */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.business_unit }}>
        {project.program?.business_unit?.name || EmptyPlaceholder}
      </TableCell>

      {/* Product Line */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.product_line }}>
        {project.product_line?.name || EmptyPlaceholder}
      </TableCell>

      {/* PM */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.pm }}>
        {project.pm?.name || EmptyPlaceholder}
      </TableCell>

      {/* Scale */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.scale }}>
        {project.scale || EmptyPlaceholder}
      </TableCell>

      {/* Customer */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.customer }}>
        {project.customer || EmptyPlaceholder}
      </TableCell>

      {/* Product */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.product }}>
        {project.product || EmptyPlaceholder}
      </TableCell>

      {/* Start Month */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.start_month }}>
        {project.start_month || EmptyPlaceholder}
      </TableCell>

      {/* End Month */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.end_month }}>
        {project.end_month || EmptyPlaceholder}
      </TableCell>

      {/* Financial Columns (conditional) */}
      {showFinancialColumns && (
        <>
          <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.funding_entity }}>
            {/* [js-index-maps] O(1) lookup instead of .find() */}
            {FUNDING_ENTITY_MAP.get(project.funding_entity_id ?? '') || EmptyPlaceholder}
          </TableCell>
          <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.recharge_status }}>
            {project.recharge_status || EmptyPlaceholder}
          </TableCell>
        </>
      )}

      {/* Actions - sticky right, icon-only buttons */}
      <TableCell className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex gap-1 justify-center">
          <Button
            size="icon"
            variant="outline"
            onClick={onStartEdit}
            disabled={!canEdit}
            className="h-7 w-7"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onDelete}
            disabled={!canEdit}
            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// [rerender-memo] Export memoized component
// Only re-renders when props actually change
export const InlineEditableRow = memo(InlineEditableRowInner);
