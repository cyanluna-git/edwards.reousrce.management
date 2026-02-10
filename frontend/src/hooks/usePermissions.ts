/**
 * usePermissions - Role-based access control hook
 */
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const isPM = user?.role === 'PM';
  const isFM = user?.role === 'FM';
  const isUser = user?.role === 'USER';

  // Role-based permissions
  const canManageProjects = isAdmin || isPM;      // ADMIN + PM
  const canManageResources = isAdmin || isFM;     // ADMIN + FM
  const canManageOrganization = isAdmin;          // ADMIN only
  const canManageUsers = isAdmin;                 // ADMIN only
  const canManageHiringPlans = isAdmin;           // ADMIN only
  const canViewReports = isAdmin || isPM || isFM; // ADMIN + PM + FM

  // All users can manage worklogs
  const canManageWorklogs = true;

  return {
    isAdmin,
    isPM,
    isFM,
    isUser,
    canManageProjects,
    canManageResources,
    canManageOrganization,
    canManageUsers,
    canManageHiringPlans,
    canViewReports,
    canManageWorklogs,
  };
}
