import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useProject, useProjectWorklogStats } from '@/hooks/useProject';
import { useDeleteProject } from '@/hooks/useProjects';
import { WorklogHeatmap } from '@/components/WorklogHeatmap';
import { useMilestones, useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from '@/hooks/useMilestones';
import { MILESTONE_STATUS_COLORS } from '@/lib/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  StatusBadge,
} from '@/components/ui';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard';
import type { ProjectMilestone, ProjectMilestoneCreate, ProjectMilestoneUpdate } from '@/types';
import {
  Briefcase,
  Activity,
  Signal,
  Building2,
  Package,
  User,
  FileText,
  Layers,
  FolderTree,
  LayoutGrid,
  ArrowLeft,
  DollarSign,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Info
} from 'lucide-react';

// StatusBadge is now imported from @/components/ui

// Property Row Component (Notion style)
const PropertyRow = ({
  icon: Icon,
  label,
  children
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center py-2 h-9">
    <div className="w-36 flex items-center text-sm text-muted-foreground shrink-0">
      <Icon className="w-4 h-4 mr-2" />
      <span>{label}</span>
    </div>
    <div className="flex-1 text-sm font-medium truncate">
      {children}
    </div>
  </div>
);

// Milestone status colors (imported from lib/constants, but need dot colors locally)

const STATUS_DOT_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-500',
  Completed: 'bg-green-500',
  Delayed: 'bg-red-500',
};

// Standard gate options
const STANDARD_GATES = [
  { name: 'Gate 3', type: 'STD_GATE', is_key_gate: true },
  { name: 'Gate 5', type: 'STD_GATE', is_key_gate: true },
  { name: 'Gate 6', type: 'STD_GATE', is_key_gate: true },
];

export const ProjectDetailPage: React.FC = () => {
  const { t } = useTranslation('projects');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTab = (location.state as any)?.returnTab;
  const { data: project, isLoading, isError, error } = useProject(id || '');
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const { canManageProjects } = usePermissions();

  // Milestones
  const { data: milestones = [], isLoading: milestonesLoading } = useMilestones(id || '');
  const createMilestone = useCreateMilestone(id || '');
  const updateMilestone = useUpdateMilestone(id || '');
  const deleteMilestone = useDeleteMilestone(id || '');

  // Worklog Stats
  const { data: worklogStats = [], isLoading: statsLoading } = useProjectWorklogStats(id || '');

  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'detail'>('dashboard');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);

  // Milestone form state
  const [milestoneForm, setMilestoneForm] = useState<{
    name: string;
    type: 'STD_GATE' | 'CUSTOM';
    target_date: string;
    actual_date: string;
    status: 'Pending' | 'Completed' | 'Delayed';
    is_key_gate: boolean;
    description: string;
  }>({
    name: '',
    type: 'CUSTOM',
    target_date: '',
    actual_date: '',
    status: 'Pending',
    is_key_gate: false,
    description: '',
  });

  const handleDelete = () => {
    if (id) {
      deleteProject(id, {
        onSuccess: () => {
          navigate('/projects');
        },
      });
    }
  };

  const openAddMilestoneModal = () => {
    setEditingMilestone(null);
    setMilestoneForm({
      name: '',
      type: 'CUSTOM',
      target_date: '',
      actual_date: '',
      status: 'Pending',
      is_key_gate: false,
      description: '',
    });
    setIsMilestoneModalOpen(true);
  };

  const openEditMilestoneModal = (milestone: ProjectMilestone) => {
    setEditingMilestone(milestone);
    setMilestoneForm({
      name: milestone.name,
      type: milestone.type,
      target_date: milestone.target_date?.split('T')[0] || '',
      actual_date: milestone.actual_date?.split('T')[0] || '',
      status: milestone.status,
      is_key_gate: milestone.is_key_gate,
      description: milestone.description || '',
    });
    setIsMilestoneModalOpen(true);
  };

  const handleMilestoneSubmit = () => {
    const data: ProjectMilestoneCreate | ProjectMilestoneUpdate = {
      name: milestoneForm.name,
      type: milestoneForm.type,
      target_date: milestoneForm.target_date,
      actual_date: milestoneForm.actual_date || undefined,
      status: milestoneForm.status,
      is_key_gate: milestoneForm.is_key_gate,
      description: milestoneForm.description || undefined,
    };

    if (editingMilestone) {
      updateMilestone.mutate(
        { milestoneId: editingMilestone.id, data },
        { onSuccess: () => setIsMilestoneModalOpen(false) }
      );
    } else {
      createMilestone.mutate(data as ProjectMilestoneCreate, {
        onSuccess: () => setIsMilestoneModalOpen(false),
      });
    }
  };

  const handleMilestoneDelete = (milestoneId: number) => {
    if (confirm(t('milestones.confirmDelete'))) {
      deleteMilestone.mutate(milestoneId);
    }
  };

  const addStandardGate = (gate: typeof STANDARD_GATES[0]) => {
    setMilestoneForm(prev => ({
      ...prev,
      name: gate.name,
      type: gate.type as 'STD_GATE',
      is_key_gate: gate.is_key_gate,
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-red-500">{t('error', { message: error?.message })}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-4">
        <p>{t('notFound')}</p>
      </div>
    );
  }

  const sortedMilestones = [...milestones].sort(
    (a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
  );
  const today = new Date();

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header: Back Button + Tabs + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (returnTab) {
                navigate('/projects', { state: { activeTab: returnTab } });
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('actions.back')}
          </Button>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {t('tabs.dashboard')}
            </button>
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'detail'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Info className="w-4 h-4" />
              {t('tabs.detail')}
            </button>
          </div>
        </div>

        {/* Actions */}
        {canManageProjects && (
          <div className="flex space-x-2">
            <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">{t('actions.edit')}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('detail.editProject')}</DialogTitle>
                </DialogHeader>
                <ProjectForm
                  project={project}
                  onSuccess={() => setIsUpdateModalOpen(false)}
                  onCancel={() => setIsUpdateModalOpen(false)}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">{t('actions.delete')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('detail.confirmDeletion')}</DialogTitle>
                  <DialogDescription>
                    {t('detail.deleteConfirmMessage', { name: project.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>{t('common:buttons.cancel')}</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? t('actions.deleting') : t('actions.delete')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <ProjectDashboard projectId={id || ''} />
      )}

      {/* Details Tab */}
      {activeTab === 'detail' && (
        <>
      {/* Project Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{project.name} {project.internal_io?.io_number && `(${project.internal_io.io_number})`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
            <PropertyRow icon={Briefcase} label={t('detail.productLine')}>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {project.product_line?.name || 'N/A'}
              </span>
            </PropertyRow>

            {/* ProjectType removed - no longer in data model */}

            <PropertyRow icon={Activity} label={t('detail.status')}>
              <StatusBadge status={project.status} />
            </PropertyRow>

            <PropertyRow icon={LayoutGrid} label={t('detail.category')}>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${
                project.category === 'FUNCTIONAL'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {project.category === 'FUNCTIONAL' ? t('detail.functionalProject') : t('detail.productProject')}
              </span>
            </PropertyRow>

            <PropertyRow icon={Layers} label={t('detail.businessUnit')}>
              {project.product_line?.business_unit_id ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700">
                  {project.product_line?.business_unit?.name || project.product_line?.business_unit_id}
                </span>
              ) : (
                <span className="text-amber-600 italic text-sm">{t('detail.notAssigned')}</span>
              )}
            </PropertyRow>

            <PropertyRow icon={FolderTree} label={t('detail.family')}>
              {project.product_line ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700">
                  {project.product_line.name}
                </span>
              ) : (
                <span className="text-amber-600 italic text-sm">{t('detail.notAssigned')}</span>
              )}
            </PropertyRow>

            <PropertyRow icon={Signal} label={t('detail.scale')}>
              <span className="text-sm font-medium">{project.scale || 'N/A'}</span>
            </PropertyRow>

            <PropertyRow icon={Building2} label={t('detail.customer')}>
              <span className="text-sm font-medium">{project.customer || 'N/A'}</span>
            </PropertyRow>

            <PropertyRow icon={Package} label={t('detail.product')}>
              <span className="text-sm font-medium">{project.product || 'N/A'}</span>
            </PropertyRow>

            {project.pm && (
              <PropertyRow icon={User} label={t('detail.projectManager')}>
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs mr-2 text-primary font-bold">
                    {(project.pm.name || '?')[0]}
                  </div>
                  <span className="font-medium">{project.pm.name || project.pm.email}</span>
                </div>
              </PropertyRow>
            )}

            {/* Financial Classification Fields */}
            <div className="col-span-full pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center text-sm font-semibold mb-3" style={{ color: '#000000' }}>
                <DollarSign className="w-4 h-4 mr-2" style={{ color: '#64748b' }} />
                <span>{t('detail.financialClassification')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-8">
                <PropertyRow icon={DollarSign} label={t('detail.fundingEntity')}>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${
                    project.funding_entity_id
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {project.funding_entity_id || t('detail.notSet')}
                  </span>
                </PropertyRow>

                <PropertyRow icon={RefreshCw} label={t('detail.rechargeStatus')}>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${
                    project.recharge_status === 'BILLABLE' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    project.recharge_status === 'NON_BILLABLE' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                    project.recharge_status === 'INTERNAL' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                    'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {project.recharge_status || t('detail.notSet')}
                  </span>
                </PropertyRow>

                <PropertyRow icon={TrendingUp} label={t('detail.capitalizable')}>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${
                    project.is_capitalizable
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {project.is_capitalizable ? t('detail.yesCapex') : t('detail.noOpex')}
                  </span>
                </PropertyRow>
              </div>
            </div>

            <div className="col-span-full pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center text-sm font-semibold mb-3" style={{ color: '#000000' }}>
                <FileText className="w-4 h-4 mr-2" style={{ color: '#64748b' }} />
                <span>{t('detail.description')}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#000000' }}>
                {project.description || <span className="text-slate-400 italic">{t('detail.noDescription')}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worklog Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('activity.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto pb-2">
            {statsLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('activity.loading')}</div>
            ) : worklogStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('activity.noActivity')}</div>
            ) : (
              <WorklogHeatmap data={worklogStats} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('milestones.title')}</CardTitle>
          {canManageProjects && (
            <Button variant="outline" size="sm" onClick={openAddMilestoneModal}>
              {t('actions.addMilestone')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {milestonesLoading ? (
            <div className="text-center py-4">{t('milestones.loading')}</div>
          ) : sortedMilestones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('milestones.noMilestones')}
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {/* Milestones */}
              <div className="space-y-4">
                {sortedMilestones.map((ms) => {
                  const targetDate = parseISO(ms.target_date);
                  const daysFromNow = differenceInDays(targetDate, today);

                  return (
                    <div
                      key={ms.id}
                      className={`relative pl-10 ${canManageProjects ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                      onClick={canManageProjects ? () => openEditMilestoneModal(ms) : undefined}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 w-4 h-4 rounded-full border-2 ${STATUS_DOT_COLORS[ms.status] || 'bg-gray-500'}`} />

                      {/* Milestone card */}
                      <div className={`p-3 rounded-lg border-l-4 ${MILESTONE_STATUS_COLORS[ms.status] || 'bg-gray-100 border-gray-500'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{ms.name}</span>
                            {ms.is_key_gate && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-1 rounded">
                                {t('milestones.keyGate')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {ms.type === 'STD_GATE' ? '🚪' : '📌'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMilestoneDelete(ms.id);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>

                        <div className="mt-1 text-sm">
                          <span className="font-medium">
                            {format(targetDate, 'yyyy-MM-dd')}
                          </span>
                          {ms.actual_date && (
                            <span className="ml-2 text-muted-foreground">
                              ({t('milestones.actual')} {format(parseISO(ms.actual_date), 'yyyy-MM-dd')})
                            </span>
                          )}
                        </div>

                        {/* Days indicator */}
                        <div className="mt-1 text-xs">
                          {daysFromNow > 0 && ms.status === 'Pending' && (
                            <span className="text-blue-600">{t('milestones.dDay', { count: daysFromNow })}</span>
                          )}
                          {daysFromNow === 0 && (
                            <span className="text-orange-600 font-bold">{t('milestones.today')}</span>
                          )}
                          {daysFromNow < 0 && ms.status === 'Pending' && (
                            <span className="text-red-600 font-bold">
                              {t('milestones.daysDelayed', { count: Math.abs(daysFromNow) })}
                            </span>
                          )}
                        </div>

                        {ms.description && (
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            {ms.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {/* Milestone Add/Edit Modal */}
      <Dialog open={isMilestoneModalOpen} onOpenChange={setIsMilestoneModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMilestone ? t('milestones.editTitle') : t('milestones.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Standard Gates Quick Buttons */}
            {!editingMilestone && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t('milestones.standardGates')}</span>
                {STANDARD_GATES.map((gate) => (
                  <Button
                    key={gate.name}
                    variant="outline"
                    size="sm"
                    onClick={() => addStandardGate(gate)}
                    className={milestoneForm.name === gate.name ? 'ring-2 ring-primary' : ''}
                  >
                    {gate.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('milestones.name')} *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={milestoneForm.name}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Gate 3, Shipment, Commissioning"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('milestones.type')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={milestoneForm.type}
                  onChange={(e) => setMilestoneForm(prev => ({
                    ...prev,
                    type: e.target.value as 'STD_GATE' | 'CUSTOM'
                  }))}
                >
                  <option value="CUSTOM">Custom</option>
                  <option value="STD_GATE">Standard Gate</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('milestones.milestoneStatus')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={milestoneForm.status}
                  onChange={(e) => setMilestoneForm(prev => ({
                    ...prev,
                    status: e.target.value as 'Pending' | 'Completed' | 'Delayed'
                  }))}
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('milestones.targetDate')} *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md"
                  value={milestoneForm.target_date}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, target_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('milestones.actualDate')}</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md"
                  value={milestoneForm.actual_date}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, actual_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_key_gate"
                checked={milestoneForm.is_key_gate}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, is_key_gate: e.target.checked }))}
              />
              <label htmlFor="is_key_gate" className="text-sm">{t('milestones.keyGate')}</label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('milestones.descriptionLabel')}</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md"
                rows={2}
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('milestones.descriptionPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMilestoneModalOpen(false)}>
              {t('milestones.cancel')}
            </Button>
            <Button
              onClick={handleMilestoneSubmit}
              disabled={!milestoneForm.name || !milestoneForm.target_date || createMilestone.isPending || updateMilestone.isPending}
            >
              {createMilestone.isPending || updateMilestone.isPending ? t('milestones.saving') : t('milestones.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetailPage;
