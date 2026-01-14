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

  // ADMIN permissions
  const canManageProjects = isAdmin;
  const canManageOrganization = isAdmin;
  const canManageUsers = isAdmin;
  const canManageHiringPlans = isAdmin;
  const canViewReports = isAdmin || isPM || isFM;
  
  // All users can manage worklogs
  const canManageWorklogs = true;

  return {
    isAdmin,
    isPM,
    isFM,
    isUser,
    canManageProjects,
    canManageOrganization,
    canManageUsers,
    canManageHiringPlans,
    canViewReports,
    canManageWorklogs,
  };
}
