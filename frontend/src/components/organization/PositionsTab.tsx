/**
 * PositionsTab - Job Positions Management
 * Functional Roles and Project Roles sub-tabs
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useJobPositionsList,
    useCreateJobPosition,
    useUpdateJobPosition,
    useDeleteJobPosition,
} from '@/hooks/useJobPositionsCrud';
import { usePermissions } from '@/hooks/usePermissions';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui';
import {
    getProjectRoles,
    createProjectRole,
    updateProjectRole,
    deleteProjectRole,
} from '@/api/client';
import type { JobPosition } from '@/types';
import { useTranslation } from 'react-i18next';
export const PositionsTab: React.FC = () => {
    const [subTab, setSubTab] = useState<'functional' | 'project'>('functional');
    const { t } = useTranslation('organization');

    return (
        <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-4 border-b">
                <button
                    className={`px-4 py-2 -mb-px ${subTab === 'functional'
                        ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    onClick={() => setSubTab('functional')}
                >
                    {t('positions.functionalRoles')}
                </button>
                <button
                    className={`px-4 py-2 -mb-px ${subTab === 'project'
                        ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    onClick={() => setSubTab('project')}
                >
                    {t('positions.projectRoles')}
                </button>
            </div>

            {subTab === 'functional' && <FunctionalRolesSection />}
            {subTab === 'project' && <ProjectRolesSection />}
        </div>
    );
};

// Functional Roles Section (기존 JobPositions)
const FunctionalRolesSection: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
    const [formName, setFormName] = useState('');

    const { data: positions = [], isLoading } = useJobPositionsList();
    const createPosition = useCreateJobPosition();
    const updatePosition = useUpdateJobPosition();
    const deletePosition = useDeleteJobPosition();
    const { t } = useTranslation('organization');
    const { canManageOrganization } = usePermissions();

    const openAddModal = () => {
        setEditingPosition(null);
        setFormName('');
        setIsModalOpen(true);
    };

    const openEditModal = (position: JobPosition) => {
        setEditingPosition(position);
        setFormName(position.name);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;
        if (editingPosition) {
            await updatePosition.mutateAsync({
                id: editingPosition.id,
                data: { name: formName },
            });
        } else {
            await createPosition.mutateAsync({ name: formName });
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (position: JobPosition) => {
        if (!confirm(t('positions.confirmDeletePosition', { name: position.name }))) return;
        await deletePosition.mutateAsync(position.id);
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('positions.functionalRoles')}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('positions.functionalDesc')}
                        </p>
                    </div>
                    {canManageOrganization && (
                        <Button onClick={openAddModal}>{t('common:buttons.add')}</Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-4">Loading...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left py-3 px-4">{t('positions.positionName')}</th>
                                    <th className="text-right py-3 px-4 w-32">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map((position) => (
                                    <tr key={position.id} className="border-b hover:bg-slate-50">
                                        <td className="py-3 px-4 font-medium">{position.name}</td>
                                        <td className="py-3 px-4 text-right">
                                            {canManageOrganization && (
                                                <>
                                                    <button className="text-blue-600 hover:underline mr-3" onClick={() => openEditModal(position)}>
                                                        {t('common:buttons.edit')}
                                                    </button>
                                                    <button className="text-red-600 hover:underline" onClick={() => handleDelete(position)}>
                                                        {t('common:buttons.delete')}
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPosition ? t('positions.editPosition') : t('positions.addPosition')}</DialogTitle>
                        <DialogDescription>{t('positions.functionalModalDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="block text-sm font-medium mb-1">{t('positions.positionNameRequired')}</label>
                        <input
                            type="text"
                            className="w-full border rounded px-3 py-2"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="예: Function Leader"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common:buttons.cancel')}</Button>
                        <Button onClick={handleSave} disabled={!formName.trim()}>
                            {editingPosition ? t('common:buttons.update') : t('common:buttons.add')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Project Roles Section
const ProjectRolesSection: React.FC = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<{ id: string; name: string; category?: string } | null>(null);
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const { t } = useTranslation('organization');
    const { canManageOrganization } = usePermissions();

    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['project-roles'],
        queryFn: () => getProjectRoles(),
    });

    const createMutation = useMutation({
        mutationFn: (data: { name: string; category?: string }) => createProjectRole(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-roles'] });
            setIsModalOpen(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; category?: string } }) =>
            updateProjectRole(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-roles'] });
            setIsModalOpen(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteProjectRole(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-roles'] }),
    });

    const openAddModal = () => {
        setEditingRole(null);
        setFormName('');
        setFormCategory('');
        setIsModalOpen(true);
    };

    const openEditModal = (role: { id: string; name: string; category?: string }) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormCategory(role.category || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;
        if (editingRole) {
            await updateMutation.mutateAsync({
                id: editingRole.id,
                data: { name: formName, category: formCategory || undefined },
            });
        } else {
            await createMutation.mutateAsync({ name: formName, category: formCategory || undefined });
        }
    };

    const handleDelete = async (role: { id: string; name: string }) => {
        if (!confirm(t('positions.confirmDeleteRole', { name: role.name }))) return;
        await deleteMutation.mutateAsync(role.id);
    };

    const categories = ['Engineering', 'Management', 'Support'];

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('positions.projectRoles')}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('positions.projectDesc')}
                        </p>
                    </div>
                    {canManageOrganization && (
                        <Button onClick={openAddModal}>{t('common:buttons.add')}</Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-4">Loading...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left py-3 px-4">{t('positions.roleName')}</th>
                                    <th className="text-left py-3 px-4">{t('positions.category')}</th>
                                    <th className="text-center py-3 px-4">{t('positions.assignedUsers')}</th>
                                    <th className="text-center py-3 px-4">{t('positions.projects')}</th>
                                    <th className="text-right py-3 px-4 w-32">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map((role) => (
                                    <tr key={role.id} className="border-b hover:bg-slate-50">
                                        <td className="py-3 px-4 font-medium">{role.name}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-xs ${role.category === 'Engineering' ? 'bg-blue-100 text-blue-700' :
                                                role.category === 'Management' ? 'bg-purple-100 text-purple-700' :
                                                    role.category === 'Support' ? 'bg-green-100 text-green-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {role.category || '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="text-blue-600 font-medium">{role.user_count || 0}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="text-green-600 font-medium">{role.project_count || 0}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {canManageOrganization && (
                                                <>
                                                    <button className="text-blue-600 hover:underline mr-3" onClick={() => openEditModal(role)}>
                                                        {t('common:buttons.edit')}
                                                    </button>
                                                    <button className="text-red-600 hover:underline" onClick={() => handleDelete(role)}>
                                                        {t('common:buttons.delete')}
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRole ? t('positions.editRole') : t('positions.addRole')}</DialogTitle>
                        <DialogDescription>{t('positions.projectModalDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('positions.roleNameRequired')}</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="예: Software Engineer"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('positions.category')}</label>
                            <select
                                className="w-full border rounded px-3 py-2"
                                value={formCategory}
                                onChange={(e) => setFormCategory(e.target.value)}
                            >
                                <option value="">{t('positions.noCategory')}</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common:buttons.cancel')}</Button>
                        <Button onClick={handleSave} disabled={!formName.trim() || createMutation.isPending || updateMutation.isPending}>
                            {editingRole ? t('common:buttons.update') : t('common:buttons.add')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default PositionsTab;
