/**
 * useInlineProjectEdit - Custom hook for managing inline project editing
 * Handles single-row edit state, field validation, and optimistic updates
 */
import { useState, useCallback } from 'react';
import { useUpdateProject } from './useProjects';
import type { Project, ProjectUpdate } from '@/types';

interface EditState {
  projectId: string | null;
  fields: Partial<ProjectUpdate>;
  errors: Record<string, string>;
}

const initialEditState: EditState = {
  projectId: null,
  fields: {},
  errors: {},
};

export function useInlineProjectEdit() {
  const [editState, setEditState] = useState<EditState>(initialEditState);
  const updateProjectMutation = useUpdateProject();

  // Start editing a project
  const startEdit = useCallback((project: Project) => {
    setEditState({
      projectId: project.id,
      fields: {
        internal_io_id: project.internal_io_id,
        recharge_io_id: project.recharge_io_id,
        name: project.name,
        category: project.category,
        status: project.status,
        program_id: project.program_id,
        product_line_id: project.product_line_id,
        pm_id: project.pm_id,
        scale: project.scale,
        customer: project.customer,
        product: project.product,
        start_month: project.start_month,
        end_month: project.end_month,
        funding_entity_id: project.funding_entity_id,
        recharge_status: project.recharge_status,
      },
      errors: {},
    });
  }, []);

  // Update a field value
  const updateField = useCallback((fieldName: keyof ProjectUpdate, value: any) => {
    setEditState(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldName]: value,
      },
      errors: {
        ...prev.errors,
        [fieldName]: '', // Clear error when user edits
      },
    }));
  }, []);

  // Validate fields
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const { fields } = editState;

    // Required field validation
    if (!fields.name?.trim()) {
      errors.name = 'Name is required';
    }

    // Date validation (start must be before end)
    if (fields.start_month && fields.end_month) {
      if (fields.start_month > fields.end_month) {
        errors.end_month = 'End month must be after start month';
      }
    }

    setEditState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [editState]);

  // Save changes
  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (!editState.projectId) return false;

    if (!validate()) {
      return false;
    }

    // Convert empty strings to null for ID fields (backend expects UUID or null)
    const cleanedFields = { ...editState.fields };
    const idFields = ['internal_io_id', 'recharge_io_id', 'pm_id', 'product_line_id', 'program_id', 'project_type_id', 'owner_department_id'] as const;
    for (const field of idFields) {
      if (cleanedFields[field] === '') {
        cleanedFields[field] = null;
      }
    }

    try {
      await updateProjectMutation.mutateAsync({
        id: editState.projectId,
        updatedProject: cleanedFields,
      });

      // Reset edit state on success
      setEditState(initialEditState);
      return true;
    } catch (error) {
      console.error('Failed to update project:', error);
      setEditState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          _general: 'Failed to save changes. Please try again.',
        },
      }));
      return false;
    }
  }, [editState, validate, updateProjectMutation]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditState(initialEditState);
  }, []);

  // Check if a specific project is being edited
  const isEditing = useCallback((projectId: string): boolean => {
    return editState.projectId === projectId;
  }, [editState.projectId]);

  // Check if any project is being edited
  const hasActiveEdit = editState.projectId !== null;

  return {
    editState,
    startEdit,
    updateField,
    saveEdit,
    cancelEdit,
    isEditing,
    hasActiveEdit,
    isSaving: updateProjectMutation.isPending,
  };
}
