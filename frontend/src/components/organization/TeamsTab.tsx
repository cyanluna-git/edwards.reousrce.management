/**
 * TeamsTab - Organization Hierarchy Management
 * Business Unit > Department > SubTeam hierarchy view
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
    getBusinessUnits,
    updateBusinessUnit,
    getDepartments,
    getSubTeams,
    updateDepartment,
    updateSubTeam,
    type Department,
} from '@/api/client';

export const TeamsTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [expandedBUs, setExpandedBUs] = useState<Set<string>>(new Set());
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [editingItem, setEditingItem] = useState<{ type: 'bu' | 'dept' | 'subteam'; id: string; name: string } | null>(null);

    const { data: businessUnits = [], isLoading: loadingBUs } = useQuery({
        queryKey: ['business-units'],
        queryFn: getBusinessUnits,
    });

    const { data: departments = [], isLoading: loadingDepts } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const updateBUMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateBusinessUnit(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-units'] });
            setEditingItem(null);
        },
    });

    const updateDeptMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateDepartment(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setEditingItem(null);
        },
    });

    const updateSubTeamMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateSubTeam(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            setEditingItem(null);
        },
    });

    const toggleBU = (buId: string) => {
        const newSet = new Set(expandedBUs);
        if (newSet.has(buId)) newSet.delete(buId);
        else newSet.add(buId);
        setExpandedBUs(newSet);
    };

    const toggleDept = (deptId: string) => {
        const newSet = new Set(expandedDepts);
        if (newSet.has(deptId)) newSet.delete(deptId);
        else newSet.add(deptId);
        setExpandedDepts(newSet);
    };

    const handleSaveEdit = () => {
        if (!editingItem || !editingItem.name.trim()) return;
        if (editingItem.type === 'bu') {
            updateBUMutation.mutate({ id: editingItem.id, name: editingItem.name });
        } else if (editingItem.type === 'dept') {
            updateDeptMutation.mutate({ id: editingItem.id, name: editingItem.name });
        } else {
            updateSubTeamMutation.mutate({ id: editingItem.id, name: editingItem.name });
        }
    };

    if (loadingBUs || loadingDepts) return <div className="text-center py-8">Loading...</div>;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Organization Hierarchy</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {businessUnits.map((bu) => {
                            const buDepts = departments.filter((d) => d.business_unit_id === bu.id);
                            const isExpanded = expandedBUs.has(bu.id);

                            return (
                                <div key={bu.id} className="border rounded-lg">
                                    {/* Business Unit Row */}
                                    <div className="flex items-center justify-between p-3 bg-slate-100 cursor-pointer hover:bg-slate-200">
                                        <div className="flex items-center gap-2" onClick={() => toggleBU(bu.id)}>
                                            <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                                            <span className="font-semibold">{bu.name}</span>
                                            <span className="text-sm text-muted-foreground">({bu.code})</span>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {buDepts.length} teams
                                            </span>
                                        </div>
                                        <button
                                            className="text-blue-600 hover:underline text-xs px-2"
                                            onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'bu', id: bu.id, name: bu.name }); }}
                                        >
                                            ✏️ 수정
                                        </button>
                                    </div>

                                    {/* Departments under this BU */}
                                    {isExpanded && buDepts.length > 0 && (
                                        <div className="pl-6 py-2 space-y-1">
                                            {buDepts.map((dept) => (
                                                <DepartmentRow
                                                    key={dept.id}
                                                    department={dept}
                                                    isExpanded={expandedDepts.has(dept.id)}
                                                    onToggle={() => toggleDept(dept.id)}
                                                    onEdit={() => setEditingItem({ type: 'dept', id: dept.id, name: dept.name })}
                                                    onEditSubTeam={(st) => setEditingItem({ type: 'subteam', id: st.id, name: st.name })}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Modal */}
            {editingItem && (
                <Dialog open onOpenChange={() => setEditingItem(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingItem.type === 'dept' ? 'Department 수정' : 'Sub-Team 수정'}</DialogTitle>
                            <DialogDescription>조직 정보를 수정합니다.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <label className="block text-sm font-medium mb-1">이름</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingItem(null)}>취소</Button>
                            <Button onClick={handleSaveEdit} disabled={!editingItem.name.trim()}>저장</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

const DepartmentRow: React.FC<{
    department: Department;
    isExpanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onEditSubTeam: (st: { id: string; name: string }) => void;
}> = ({ department, isExpanded, onToggle, onEdit, onEditSubTeam }) => {
    const { data: subTeams = [] } = useQuery({
        queryKey: ['sub-teams', department.id],
        queryFn: () => getSubTeams(department.id),
        enabled: isExpanded,
    });

    return (
        <div className="border rounded bg-white">
            <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2" onClick={onToggle}>
                    <span>{isExpanded ? '📋' : '📄'}</span>
                    <span className="font-medium">{department.name}</span>
                    <span className="text-sm text-muted-foreground">({department.code})</span>
                </div>
                <button
                    className="text-blue-600 hover:underline text-xs px-2"
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                    ✏️ 수정
                </button>
            </div>

            {isExpanded && subTeams.length > 0 && (
                <div className="pl-6 pb-2 space-y-1">
                    {subTeams.map((st) => (
                        <div key={st.id} className="flex items-center justify-between gap-2 p-1 text-sm hover:bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                                <span>👥</span>
                                <span>{st.name}</span>
                                <span className="text-muted-foreground">({st.code})</span>
                            </div>
                            <button
                                className="text-blue-600 hover:underline text-xs px-2"
                                onClick={() => onEditSubTeam({ id: st.id, name: st.name })}
                            >
                                ✏️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeamsTab;
