/**
 * InlineEditableRow - Row component with View/Edit mode toggling
 * Displays project data with inline editing capabilities
 */
import React, { useState } from 'react';
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
  STATUS_OPTIONS,
  SCALE_OPTIONS,
  CATEGORY_OPTIONS,
  FUNDING_ENTITY_OPTIONS,
  RECHARGE_STATUS_OPTIONS,
} from './EditableCell';

// Column width type matching COLUMN_CONFIG keys
type ColumnWidths = {
  code: number;
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
  // Column widths for resizing
  columnWidths: ColumnWidths;
}

export const InlineEditableRow: React.FC<InlineEditableRowProps> = ({
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
  columnWidths,
}) => {
  const [selectedBU, setSelectedBU] = useState<string>(
    editState.fields.program_id || project.program?.business_unit_id || ''
  );

  const handleSave = async () => {
    const success = await onSave();
    if (!success) {
      // Stay in edit mode if save failed
      return;
    }
  };

  const handleBusinessUnitChange = (buId: string) => {
    setSelectedBU(buId);
    // Find program for this BU (simplified - in real app, fetch programs by BU)
    const bu = businessUnits.find(b => b.id === buId);
    if (bu) {
      // Note: This is simplified. In production, you'd need to fetch/filter programs by BU
      updateField('program_id', project.program_id); // Keep existing for now
    }
  };

  if (isEditing) {
    return (
      <TableRow className="bg-blue-50 border-l-4 border-blue-500">
        {/* Code */}
        <TableCell style={{ width: columnWidths.code }}>
          <TextCell
            value={editState.fields.code}
            onChange={(value) => updateField('code', value)}
            error={editState.errors.code}
            placeholder="Code"
            className="font-mono w-full"
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

        {/* Actions */}
        <TableCell>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 px-2 text-xs"
            >
              <Save className="h-3 w-3 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // View Mode
  return (
    <TableRow className="bg-white hover:bg-slate-50">
      {/* Code */}
      <TableCell className="font-mono text-xs text-gray-900 truncate" style={{ width: columnWidths.code }}>
        {project.code}
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
        {project.program?.business_unit?.name || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Product Line */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.product_line }}>
        {project.product_line?.name || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* PM */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.pm }}>
        {project.pm?.name || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Scale */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.scale }}>
        {project.scale || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Customer */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.customer }}>
        {project.customer || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Product */}
      <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.product }}>
        {project.product || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Start Month */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.start_month }}>
        {project.start_month || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* End Month */}
      <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.end_month }}>
        {project.end_month || <span className="text-gray-400">-</span>}
      </TableCell>

      {/* Financial Columns (conditional) */}
      {showFinancialColumns && (
        <>
          <TableCell className="text-sm text-gray-900 truncate" style={{ width: columnWidths.funding_entity }}>
            {FUNDING_ENTITY_OPTIONS.find(o => o.value === project.funding_entity_id)?.label || <span className="text-gray-400">-</span>}
          </TableCell>
          <TableCell className="text-sm text-gray-900" style={{ width: columnWidths.recharge_status }}>
            {project.recharge_status || <span className="text-gray-400">-</span>}
          </TableCell>
        </>
      )}

      {/* Actions - sticky right */}
      <TableCell className="sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onStartEdit}
            disabled={!canEdit}
            className="h-7 px-2 text-xs font-medium"
          >
            <Edit2 className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={!canEdit}
            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
