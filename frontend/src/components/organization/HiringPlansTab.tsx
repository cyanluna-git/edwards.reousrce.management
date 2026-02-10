/**
 * HiringPlansTab - Hiring Plan Management
 * Create and manage hiring plans for departments
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    getDepartments,
    getHiringPlans,
    createHiringPlan,
    deleteHiringPlan,
    type Department,
} from '@/api/client';
import { useTranslation } from 'react-i18next';

export const HiringPlansTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { t } = useTranslation('organization');

    const { data: hiringPlans = [], isLoading } = useQuery({
        queryKey: ['hiring-plans'],
        queryFn: () => getHiringPlans(),
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteHiringPlan,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hiring-plans'] }),
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PLANNED': return 'bg-gray-100 text-gray-700';
            case 'APPROVED': return 'bg-blue-100 text-blue-700';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700';
            case 'FILLED': return 'bg-green-100 text-green-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100';
        }
    };

    const getDeptName = (deptId: string) => {
        return departments.find((d) => d.id === deptId)?.name || deptId;
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{t('hiring.titleWithCount', { count: hiringPlans.length })}</CardTitle>
                    <Button onClick={() => setIsModalOpen(true)}>{t('hiring.addPlan')}</Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-4">Loading...</div>
                    ) : hiringPlans.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('hiring.noPlans')}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50">
                                    <th className="text-left py-2 px-3">Target Date</th>
                                    <th className="text-left py-2 px-3">Department</th>
                                    <th className="text-center py-2 px-3">Headcount</th>
                                    <th className="text-center py-2 px-3">Status</th>
                                    <th className="text-left py-2 px-3">Remarks</th>
                                    <th className="text-right py-2 px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hiringPlans.map((plan) => (
                                    <tr key={plan.id} className="border-b hover:bg-slate-50">
                                        <td className="py-2 px-3">{plan.target_date}</td>
                                        <td className="py-2 px-3">{getDeptName(plan.department_id)}</td>
                                        <td className="py-2 px-3 text-center font-medium">{plan.headcount}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(plan.status)}`}>
                                                {plan.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-muted-foreground">{plan.remarks || '-'}</td>
                                        <td className="py-2 px-3 text-right">
                                            <button
                                                className="text-red-600 hover:underline text-xs"
                                                onClick={() => {
                                                    if (confirm(t('hiring.confirmDelete'))) {
                                                        deleteMutation.mutate(plan.id);
                                                    }
                                                }}
                                            >
                                                {t('common:buttons.delete')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {isModalOpen && (
                <HiringPlanModal
                    departments={departments}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['hiring-plans'] });
                    }}
                />
            )}
        </>
    );
};

const HiringPlanModal: React.FC<{
    departments: Department[];
    onClose: () => void;
    onSuccess: () => void;
}> = ({ departments, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        department_id: '',
        target_date: '',
        headcount: 1,
        status: 'PLANNED',
        remarks: '',
    });
    const { t } = useTranslation('organization');

    const createMutation = useMutation({
        mutationFn: createHiringPlan,
        onSuccess,
    });

    const handleSubmit = () => {
        if (!formData.department_id || !formData.target_date) return;
        createMutation.mutate({
            department_id: formData.department_id,
            position_id: null,
            target_date: formData.target_date,
            headcount: formData.headcount,
            status: formData.status,
            remarks: formData.remarks || null,
        });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('hiring.addPlanTitle')}</DialogTitle>
                    <DialogDescription>{t('hiring.addPlanDesc')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Department *</label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={formData.department_id}
                            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Target Date *</label>
                        <input
                            type="date"
                            className="w-full border rounded px-3 py-2"
                            value={formData.target_date}
                            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Headcount</label>
                        <input
                            type="number"
                            min={1}
                            className="w-full border rounded px-3 py-2"
                            value={formData.headcount}
                            onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value) || 1 })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="PLANNED">PLANNED</option>
                            <option value="APPROVED">APPROVED</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Remarks</label>
                        <textarea
                            className="w-full border rounded px-3 py-2"
                            rows={2}
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t('common:buttons.cancel')}</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!formData.department_id || !formData.target_date || createMutation.isPending}
                    >
                        {createMutation.isPending ? t('hiring.saving') : t('common:buttons.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default HiringPlansTab;
