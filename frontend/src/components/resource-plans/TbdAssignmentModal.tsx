import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTbdPositions, useAssignUserToPlan } from '@/hooks/useResourcePlans';
import { useUsers } from '@/hooks/useUsers';
import { useProjects } from '@/hooks/useProjects';
import type { ResourcePlan } from '@/types';
import { AlertCircle, CheckCircle2, Loader2, Users, Calendar, Briefcase } from 'lucide-react';

interface TbdAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear?: number;
  defaultMonth?: number;
  defaultProjectId?: string;
}

export const TbdAssignmentModal: React.FC<TbdAssignmentModalProps> = ({
  open,
  onOpenChange,
  defaultYear,
  defaultMonth,
  defaultProjectId,
}) => {
  const { t } = useTranslation('resource-plans');

  const today = new Date();
  const [filterYear, setFilterYear] = useState(defaultYear || today.getFullYear());
  const [filterMonth, setFilterMonth] = useState(defaultMonth || today.getMonth() + 1);
  const [filterProjectId, setFilterProjectId] = useState<string | undefined>(defaultProjectId);

  // Track assignment state per plan
  const [selectedUsers, setSelectedUsers] = useState<Record<number, string>>({});
  const [assigningPlanId, setAssigningPlanId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch TBD positions
  const { data: tbdPositions = [], isLoading: tbdLoading, error: tbdError } = useTbdPositions({
    year: filterYear,
    month: filterMonth,
    project_id: filterProjectId,
  });

  // Fetch users for assignment dropdown
  const { data: users = [] } = useUsers();
  const activeUsers = useMemo(() => users.filter(u => u.is_active), [users]);

  // Fetch projects for filter dropdown
  const { data: projects = [] } = useProjects();

  // Assignment mutation
  const assignMutation = useAssignUserToPlan();

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: t('tbd.monthLabel', { month: i + 1 }),
  }));

  // Generate year options (current year +/- 2)
  const currentYear = today.getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const handleUserSelect = (planId: number, userId: string) => {
    setSelectedUsers(prev => ({ ...prev, [planId]: userId }));
    setErrorMessage(null);
  };

  const handleAssign = async (plan: ResourcePlan) => {
    const userId = selectedUsers[plan.id];
    if (!userId) {
      setErrorMessage(t('tbd.selectUserError'));
      return;
    }

    // Confirmation dialog
    const assignedUser = activeUsers.find(u => u.id === userId);
    const userName = assignedUser?.korean_name || assignedUser?.name || 'user';
    if (!window.confirm(t('tbd.confirmAssign', { user: userName, project: plan.project_name, position: plan.position_name }))) {
      return;
    }

    setAssigningPlanId(plan.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await assignMutation.mutateAsync({
        planId: plan.id,
        data: { user_id: userId },
      });

      // Clear selection for this plan
      setSelectedUsers(prev => {
        const newState = { ...prev };
        delete newState[plan.id];
        return newState;
      });

      const assignedUser = activeUsers.find(u => u.id === userId);
      setSuccessMessage(
        t('tbd.assignSuccess', {
          user: assignedUser?.korean_name || assignedUser?.name || 'user',
          project: plan.project_name,
          position: plan.position_name,
        })
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || t('tbd.assignFailed');
      setErrorMessage(message);
    } finally {
      setAssigningPlanId(null);
    }
  };

  const handleClose = () => {
    setSelectedUsers({});
    setErrorMessage(null);
    setSuccessMessage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('tbd.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-3 py-3 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select
              value={String(filterYear)}
              onValueChange={(v) => setFilterYear(Number(v))}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(filterMonth)}
              onValueChange={(v) => setFilterMonth(Number(v))}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <Select
              value={filterProjectId || 'all'}
              onValueChange={(v) => setFilterProjectId(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder={t('tbd.allProjects')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tbd.allProjects')}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {t('tbd.positionCount', { count: tbdPositions.length })}
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        {/* TBD List */}
        <div className="flex-1 overflow-y-auto">
          {tbdLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{t('tbd.loading')}</span>
            </div>
          ) : tbdError ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              {t('tbd.loadError')}
            </div>
          ) : tbdPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-3 text-green-500" />
              <p className="font-medium">{t('tbd.noPositions')}</p>
              <p className="text-sm">{t('tbd.allAssigned', { year: filterYear, month: String(filterMonth).padStart(2, '0') })}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">{t('tbd.columnProject')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('tbd.columnPositionRole')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('tbd.columnHours')}</th>
                  <th className="text-left py-2 px-3 font-medium w-56">{t('tbd.columnAssignTo')}</th>
                  <th className="text-center py-2 px-3 font-medium w-24">{t('tbd.columnAction')}</th>
                </tr>
              </thead>
              <tbody>
                {tbdPositions.map((plan) => (
                  <tr key={plan.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <div>
                        <span className="font-medium">{plan.project_name}</span>
                        <span className="text-muted-foreground ml-1 text-xs">({plan.project_code})</span>
                      </div>
                      {plan.business_unit_name && (
                        <div className="text-xs text-muted-foreground">{plan.business_unit_name}</div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{plan.position_name || 'N/A'}</div>
                      {plan.project_role_name && (
                        <div className="text-xs text-muted-foreground">{plan.project_role_name}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {plan.planned_hours}h
                    </td>
                    <td className="py-2 px-3">
                      <Select
                        value={selectedUsers[plan.id] || ''}
                        onValueChange={(v) => handleUserSelect(plan.id, v)}
                        disabled={assigningPlanId === plan.id}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('tbd.selectUser')} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.korean_name || user.name}
                              {user.korean_name && <span className="text-muted-foreground ml-1">({user.name})</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        size="sm"
                        onClick={() => handleAssign(plan)}
                        disabled={!selectedUsers[plan.id] || assigningPlanId === plan.id}
                        className="w-full"
                      >
                        {assigningPlanId === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t('tbd.assign')
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {t('tbd.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TbdAssignmentModal;
