/**
 * ProjectInlineTable - Excel-style inline editable table for projects
 * Main table component with sorting, filtering, and inline editing
 *
 * Optimizations applied:
 * - rerender-memo: Memoized row component
 * - rerender-functional-setstate: Stable resize callbacks
 * - js-combine-iterations: Combined filter + sort in single pass
 * - rendering-hoist-jsx: Static JSX hoisted outside component
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Project } from '@/types';
import { useInlineProjectEdit } from '@/hooks/useInlineProjectEdit';
import { useDeleteProject } from '@/hooks/useProjects';
import { ProjectTableFilters } from './ProjectTableFilters';
import { InlineEditableRow } from './InlineEditableRow';

// [rendering-hoist-jsx] Static JSX hoisted outside component
const SortIconDefault = <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
const SortIconAsc = <ArrowUp className="h-3 w-3 ml-1 text-gray-700" />;
const SortIconDesc = <ArrowDown className="h-3 w-3 ml-1 text-gray-700" />;

type SortField = 'name' | 'category' | 'status' | 'start_month' | 'end_month';
type SortDirection = 'asc' | 'desc' | null;

// Column definitions with default widths
const COLUMN_CONFIG = {
  internal_io: { label: 'Internal IO', minWidth: 80, defaultWidth: 100, sortable: false },
  recharge_io: { label: 'Recharge IO', minWidth: 80, defaultWidth: 100, sortable: false },
  name: { label: 'Name', minWidth: 120, defaultWidth: 180, sortable: true },
  category: { label: 'Category', minWidth: 80, defaultWidth: 100, sortable: true },
  status: { label: 'Status', minWidth: 80, defaultWidth: 100, sortable: true },
  business_unit: { label: 'Business Unit', minWidth: 100, defaultWidth: 150, sortable: false },
  product_line: { label: 'Product Line', minWidth: 100, defaultWidth: 150, sortable: false },
  pm: { label: 'PM', minWidth: 80, defaultWidth: 120, sortable: false },
  scale: { label: 'Scale', minWidth: 60, defaultWidth: 80, sortable: false },
  customer: { label: 'Customer', minWidth: 80, defaultWidth: 100, sortable: false },
  product: { label: 'Product', minWidth: 80, defaultWidth: 120, sortable: false },
  start_month: { label: 'Start Month', minWidth: 100, defaultWidth: 120, sortable: true },
  end_month: { label: 'End Month', minWidth: 100, defaultWidth: 120, sortable: true },
  funding_entity: { label: 'Funding Entity', minWidth: 100, defaultWidth: 140, sortable: false },
  recharge_status: { label: 'Recharge Status', minWidth: 80, defaultWidth: 120, sortable: false },
} as const;

type ColumnKey = keyof typeof COLUMN_CONFIG;

interface ProjectInlineTableProps {
  projects: Project[];
  businessUnits: Array<{ id: string; name: string }>;
  productLines: Array<{ id: string; name: string; business_unit_id?: string }>;
  users: Array<{ id: string; name: string }>;
  internalIOs: Array<{ id: string; io_number: string; name?: string }>;
  rechargeIOs: Array<{ id: string; io_number: string; name?: string }>;
  canManageProjects: boolean;
  showFinancialColumns: boolean;
}

export const ProjectInlineTable: React.FC<ProjectInlineTableProps> = ({
  projects,
  businessUnits,
  productLines,
  users,
  internalIOs,
  rechargeIOs,
  canManageProjects,
  showFinancialColumns,
}) => {
  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });

  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    const initial: Record<string, number> = {};
    Object.entries(COLUMN_CONFIG).forEach(([key, config]) => {
      initial[key] = config.defaultWidth;
    });
    return initial as Record<ColumnKey, number>;
  });

  // Resize refs
  const resizingRef = useRef<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Handle column resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, column: ColumnKey) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  // Handle column resize move
  // [rerender-functional-setstate] Using functional setState for stable callback
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { column, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(COLUMN_CONFIG[column].minWidth, startWidth + diff);
    setColumnWidths(prev => {
      if (prev[column] === newWidth) return prev; // Skip if no change
      return { ...prev, [column]: newWidth };
    });
  }, []);

  // Handle column resize end
  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  // Hooks
  const {
    editState,
    startEdit,
    updateField,
    saveEdit,
    cancelEdit,
    isEditing,
    hasActiveEdit,
    isSaving,
  } = useInlineProjectEdit();

  const deleteProjectMutation = useDeleteProject();

  // [js-combine-iterations] Combined filter + sort in single useMemo
  // This reduces array iterations from 3 (copy + filter + sort) to 1
  const sortedProjects = useMemo(() => {
    const hasCategories = selectedCategories.length > 0;
    const hasStatuses = selectedStatuses.length > 0;

    // Single-pass filter
    let result: Project[] = [];
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      // Category filter
      if (hasCategories && (!p.category || !selectedCategories.includes(p.category))) {
        continue;
      }
      // Status filter
      if (hasStatuses && !selectedStatuses.includes(p.status)) {
        continue;
      }
      result.push(p);
    }

    // Sort if needed
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [projects, selectedCategories, selectedStatuses, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction or reset
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render sort icon - using hoisted static JSX
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return SortIconDefault;
    if (sortDirection === 'asc') return SortIconAsc;
    return SortIconDesc;
  };

  // Render resizable header
  const renderResizableHeader = (
    column: ColumnKey,
    sortField?: SortField,
    showResize: boolean = true
  ) => {
    const config = COLUMN_CONFIG[column];
    const isSortable = config.sortable && sortField;

    return (
      <TableHead
        className={`relative select-none text-gray-900 font-semibold ${isSortable ? 'cursor-pointer' : ''}`}
        style={{ width: columnWidths[column], minWidth: config.minWidth }}
        onClick={isSortable ? () => handleSort(sortField) : undefined}
      >
        <div className="flex items-center pr-2">
          {config.label}
          {isSortable && renderSortIcon(sortField)}
        </div>
        {showResize && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 group"
            onMouseDown={(e) => handleResizeStart(e, column)}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 group-hover:bg-blue-400" />
          </div>
        )}
      </TableHead>
    );
  };

  // Handle delete
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.project) return;

    try {
      await deleteProjectMutation.mutateAsync(deleteConfirm.project.id);
      setDeleteConfirm({ open: false, project: null });
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filters */}
        <ProjectTableFilters
          selectedCategories={selectedCategories}
          selectedStatuses={selectedStatuses}
          onCategoryChange={setSelectedCategories}
          onStatusChange={setSelectedStatuses}
          onClearAll={handleClearFilters}
        />

        {/* Active edit warning */}
        {hasActiveEdit && (
          <Alert className="m-4 mb-0">
            <AlertDescription>
              You are currently editing a project. Save or cancel your changes before editing another project.
            </AlertDescription>
          </Alert>
        )}

        {/* Table - full width with horizontal scroll */}
        <div className="overflow-x-auto" ref={tableRef}>
          <Table className="w-full" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
            <TableHeader className="bg-slate-100">
              <TableRow>
                {renderResizableHeader('internal_io')}
                {renderResizableHeader('recharge_io')}
                {renderResizableHeader('name', 'name')}
                {renderResizableHeader('category', 'category')}
                {renderResizableHeader('status', 'status')}
                {renderResizableHeader('business_unit')}
                {renderResizableHeader('product_line')}
                {renderResizableHeader('pm')}
                {renderResizableHeader('scale')}
                {renderResizableHeader('customer')}
                {renderResizableHeader('product')}
                {renderResizableHeader('start_month', 'start_month')}
                {renderResizableHeader('end_month', 'end_month')}
                {showFinancialColumns && (
                  <>
                    {renderResizableHeader('funding_entity')}
                    {renderResizableHeader('recharge_status')}
                  </>
                )}
                <TableHead className="w-20 sticky right-0 bg-slate-100 text-gray-900 font-semibold shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showFinancialColumns ? 16 : 14}
                    className="text-center py-8 text-slate-500"
                  >
                    No projects found. {selectedCategories.length + selectedStatuses.length > 0 && 'Try adjusting your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedProjects.map((project) => (
                  <InlineEditableRow
                    key={project.id}
                    project={project}
                    isEditing={isEditing(project.id)}
                    onStartEdit={() => startEdit(project)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onDelete={() => setDeleteConfirm({ open: true, project })}
                    editState={editState}
                    updateField={updateField}
                    isSaving={isSaving}
                    canEdit={canManageProjects && !hasActiveEdit}
                    showFinancialColumns={showFinancialColumns}
                    businessUnits={businessUnits}
                    productLines={productLines}
                    users={users}
                    internalIOs={internalIOs}
                    rechargeIOs={rechargeIOs}
                    columnWidths={columnWidths}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results count */}
        <div className="px-4 py-3 border-t text-sm text-gray-600">
          Showing {sortedProjects.length} of {projects.length} projects
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, project: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm.project?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, project: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
