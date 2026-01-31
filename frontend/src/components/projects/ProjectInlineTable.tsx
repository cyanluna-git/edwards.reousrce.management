/**
 * ProjectInlineTable - Excel-style inline editable table for projects
 * Main table component with sorting, filtering, and inline editing
 */
import React, { useState, useMemo } from 'react';
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

type SortField = 'code' | 'name' | 'category' | 'status' | 'start_month' | 'end_month';
type SortDirection = 'asc' | 'desc' | null;

interface ProjectInlineTableProps {
  projects: Project[];
  businessUnits: Array<{ id: string; name: string }>;
  productLines: Array<{ id: string; name: string; business_unit_id?: string }>;
  users: Array<{ id: string; name: string }>;
  canManageProjects: boolean;
  showFinancialColumns: boolean;
}

export const ProjectInlineTable: React.FC<ProjectInlineTableProps> = ({
  projects,
  businessUnits,
  productLines,
  users,
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

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => p.category && selectedCategories.includes(p.category));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(p => selectedStatuses.includes(p.status));
    }

    return filtered;
  }, [projects, selectedCategories, selectedStatuses]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    if (!sortField || !sortDirection) return filteredProjects;

    return [...filteredProjects].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nested fields
      if (sortField === 'category' || sortField === 'status') {
        aVal = aVal || '';
        bVal = bVal || '';
      }

      // Handle undefined
      if (aVal === undefined) aVal = '';
      if (bVal === undefined) bVal = '';

      // Compare
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortField, sortDirection]);

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

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-gray-700" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-gray-700" />;
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

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none w-32 text-gray-900 font-semibold"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center">
                    Code
                    {renderSortIcon('code')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none min-w-[200px] text-gray-900 font-semibold"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Name
                    {renderSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none w-32 text-gray-900 font-semibold"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    {renderSortIcon('category')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none w-32 text-gray-900 font-semibold"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {renderSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="min-w-[150px] text-gray-900 font-semibold">Business Unit</TableHead>
                <TableHead className="min-w-[150px] text-gray-900 font-semibold">Product Line</TableHead>
                <TableHead className="min-w-[120px] text-gray-900 font-semibold">PM</TableHead>
                <TableHead className="w-24 text-gray-900 font-semibold">Scale</TableHead>
                <TableHead className="min-w-[120px] text-gray-900 font-semibold">Customer</TableHead>
                <TableHead className="min-w-[120px] text-gray-900 font-semibold">Product</TableHead>
                <TableHead
                  className="cursor-pointer select-none w-32 text-gray-900 font-semibold"
                  onClick={() => handleSort('start_month')}
                >
                  <div className="flex items-center">
                    Start Month
                    {renderSortIcon('start_month')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none w-32 text-gray-900 font-semibold"
                  onClick={() => handleSort('end_month')}
                >
                  <div className="flex items-center">
                    End Month
                    {renderSortIcon('end_month')}
                  </div>
                </TableHead>
                {showFinancialColumns && (
                  <>
                    <TableHead className="min-w-[140px] text-gray-900 font-semibold">Funding Entity</TableHead>
                    <TableHead className="w-32 text-gray-900 font-semibold">Recharge Status</TableHead>
                  </>
                )}
                <TableHead className="w-40 sticky right-0 bg-slate-100 text-gray-900 font-semibold shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showFinancialColumns ? 15 : 13}
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
