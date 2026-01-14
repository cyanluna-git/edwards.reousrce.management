/**
 * TeamsTab - Organization Hierarchy Management (Function Axis)
 * Level 0 (Division) > Level 1 (Department) > Level 2 (SubTeam)
 * Full CRUD: Create, Read, Update, Delete
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useJobPositionsList } from '@/hooks/useJobPositionsCrud';
import { UserEditModal } from '@/components/organization/ResourcesTab';
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
    getDivisions,
    createDivision,
    updateDivision,
    deleteDivision,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getSubTeams,
    createSubTeam,
    updateSubTeam,
    deleteSubTeam,
    getUsers,
    type Division,
    type Department,
    type SubTeam,
    type UserDetails,
} from '@/api/client';
import type { JobPosition } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';

type OrgLevel = 'level0' | 'level1' | 'level2';
type ModalMode = 'create' | 'edit';

interface OrgItem {
    type: OrgLevel;
    id: string;
    name: string;
    code: string;
    parentId?: string; // For L1 (Dept->Div) or L2 (Sub->Dept)
}

export const TeamsTab: React.FC = () => {
    const queryClient = useQueryClient();
    const { canManageOrganization } = usePermissions();
    const [expandedL0, setExpandedL0] = useState<Set<string>>(new Set());
    const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>('create');
    const [editingItem, setEditingItem] = useState<OrgItem | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '', parentId: '', targetLevel: '' as OrgLevel | '' });
    const [modalError, setModalError] = useState<string | null>(null);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<OrgItem | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Queries
    // Level 0: Divisions
    const { data: level0Items = [], isLoading: loadingL0 } = useQuery({
        queryKey: ['divisions'],
        queryFn: getDivisions,
    });

    // Level 1: Departments (Fetch all and filter client-side)
    const { data: allDepartments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(undefined, true),
    });

    // Fetch all users for member counts
    const { data: allUsers = [] } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => getUsers(undefined, true),
    });

    // Fetch positions for member editing
    const { data: positions = [] } = useJobPositionsList();

    // Mutations - Level 0 (Division)
    const createL0 = useMutation({
        mutationFn: (data: { name: string; code: string }) =>
            createDivision({ name: data.name, code: data.code, is_active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['divisions'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to create Division');
        }
    });

    const updateL0 = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateDivision(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['divisions'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to update Division');
        }
    });

    const deleteL0 = useMutation({
        mutationFn: deleteDivision,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['divisions'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || '삭제 실패');
        },
    });

    // Mutations - Level 1 (Department)
    const createL1 = useMutation({
        mutationFn: (data: { name: string; code: string; parentId: string }) =>
            createDepartment({
                name: data.name,
                code: data.code,
                division_id: data.parentId,
                business_unit_id: null,
                is_active: true
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to create Department');
        }
    });

    const updateL1 = useMutation({
        mutationFn: ({ id, name, parentId }: { id: string; name: string; parentId?: string }) =>
            updateDepartment(id, { name, division_id: parentId || null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to update Department');
        }
    });

    const deleteL1 = useMutation({
        mutationFn: deleteDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || '삭제 실패');
        },
    });

    // Mutations - Level 2 (SubTeam)
    const createL2 = useMutation({
        mutationFn: (data: { name: string; code: string; parentId: string }) =>
            createSubTeam(data.parentId, { name: data.name, code: data.code, is_active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to create SubTeam');
        }
    });

    const updateL2 = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateSubTeam(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            closeModal();
        },
        onError: (error: any) => {
            setModalError(error.response?.data?.detail || 'Failed to update SubTeam');
        }
    });

    const deleteL2 = useMutation({
        mutationFn: deleteSubTeam,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || '삭제 실패');
        },
    });

    // Handlers
    const toggleL0 = (id: string) => {
        const newSet = new Set(expandedL0);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedL0(newSet);
    };

    const toggleL1 = (id: string) => {
        const newSet = new Set(expandedL1);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedL1(newSet);
    };

    const openCreateModal = (type: OrgLevel, parentId?: string) => {
        setModalMode('create');
        setEditingItem({ type, id: '', name: '', code: '', parentId });
        setFormData({ name: '', code: '', parentId: parentId || '', targetLevel: type });
        setModalError(null);
        setModalOpen(true);
    };

    const openEditModal = (item: OrgItem) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({ name: item.name, code: item.code, parentId: item.parentId || '', targetLevel: item.type });
        setModalError(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', code: '', parentId: '', targetLevel: '' });
        setModalError(null);
    };

    const handleSave = () => {
        setModalError(null);
        if (!formData.name.trim()) return;

        // In create mode, always generate code from name if not provided
        // In edit mode, keep existing code
        const code = formData.code.trim() || formData.name.toUpperCase().replace(/\s+/g, '_').slice(0, 10);

        if (modalMode === 'create') {
            if (formData.targetLevel === 'level0') {
                createL0.mutate({ name: formData.name, code });
            } else if (formData.targetLevel === 'level1') {
                createL1.mutate({ name: formData.name, code, parentId: formData.parentId });
            } else if (formData.targetLevel === 'level2' && formData.parentId) {
                createL2.mutate({ name: formData.name, code, parentId: formData.parentId });
            }
        } else if (editingItem) {
            if (editingItem.type === 'level0') {
                updateL0.mutate({ id: editingItem.id, name: formData.name });
            } else if (editingItem.type === 'level1') {
                updateL1.mutate({ id: editingItem.id, name: formData.name, parentId: formData.parentId });
            } else if (editingItem.type === 'level2') {
                updateL2.mutate({ id: editingItem.id, name: formData.name });
            }
        }
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'level0') deleteL0.mutate(deleteConfirm.id);
        else if (deleteConfirm.type === 'level1') deleteL1.mutate(deleteConfirm.id);
        else if (deleteConfirm.type === 'level2') deleteL2.mutate(deleteConfirm.id);
    };

    if (loadingL0) return <div className="text-center py-8">Loading...</div>;

    // Filter "Orphaned" Departments (No Division)
    const orphanedDepartments = allDepartments.filter(d => !d.division_id);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Organization Hierarchy (Division &gt; Dept &gt; SubTeam)</CardTitle>
                    {canManageOrganization && (
                        <Button onClick={() => openCreateModal('level0')}>+ Division 추가</Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Divisions */}
                        {level0Items.map((div) => {
                            const divDepts = allDepartments.filter(d => d.division_id === div.id);
                            return (
                                <DivisionRow
                                    key={div.id}
                                    item={div}
                                    departments={divDepts}
                                    allUsers={allUsers}
                                    positions={positions}
                                    isExpanded={expandedL0.has(div.id)}
                                    expandedL1={expandedL1}
                                    canManageOrganization={canManageOrganization}
                                    onToggle={() => toggleL0(div.id)}
                                    onToggleL1={toggleL1}
                                    onEdit={() => openEditModal({ type: 'level0', id: div.id, name: div.name, code: div.code })}
                                    onDelete={() => setDeleteConfirm({ type: 'level0', id: div.id, name: div.name, code: div.code })}
                                    onAddChild={() => openCreateModal('level1', div.id)}
                                    onEditChildL1={(dept) => openEditModal({ type: 'level1', id: dept.id, name: dept.name, code: dept.code, parentId: div.id })}
                                    onDeleteChildL1={(dept) => setDeleteConfirm({ type: 'level1', id: dept.id, name: dept.name, code: dept.code })}
                                    onAddChildL2={(deptId) => openCreateModal('level2', deptId)}
                                    onEditChildL2={(st, deptId) => openEditModal({ type: 'level2', id: st.id, name: st.name, code: st.code, parentId: deptId })}
                                    onDeleteChildL2={(st) => setDeleteConfirm({ type: 'level2', id: st.id, name: st.name, code: st.code })}
                                    queryClient={queryClient}
                                />
                            );
                        })}

                        {/* Orphaned Departments */}
                        {orphanedDepartments.length > 0 && (
                            <div className="border rounded-lg bg-gray-50 border-dashed border-gray-300">
                                <div className="p-3 font-medium text-gray-500">Unassigned Departments (No Division)</div>
                                <div className="p-3 pt-0 space-y-2">
                                    {orphanedDepartments.map(dept => (
                                        <DepartmentRow
                                            key={dept.id}
                                            item={dept}
                                            allUsers={allUsers}
                                            positions={positions}
                                            isExpanded={expandedL1.has(dept.id)}
                                            onToggle={() => toggleL1(dept.id)}
                                            onEdit={() => openEditModal({ type: 'level1', id: dept.id, name: dept.name, code: dept.code })}
                                            onDelete={() => setDeleteConfirm({ type: 'level1', id: dept.id, name: dept.name, code: dept.code })}
                                            onAddChild={() => openCreateModal('level2', dept.id)}
                                            onEditChild={(st) => openEditModal({ type: 'level2', id: st.id, name: st.name, code: st.code, parentId: dept.id })}
                                            onDeleteChild={(st) => setDeleteConfirm({ type: 'level2', id: st.id, name: st.name, code: st.code })}
                                            queryClient={queryClient}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            <Dialog open={modalOpen} onOpenChange={closeModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {modalMode === 'create' ? '조직 추가' : '조직 수정'}
                        </DialogTitle>
                        <DialogDescription>조직 정보를 입력하세요.</DialogDescription>
                    </DialogHeader>

                    {modalError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                            ⚠️ {modalError}
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        {/* Level Selection (readonly) */}
                        <div>
                            <label className="block text-sm font-medium mb-1">수준</label>
                            <div className="text-sm font-medium px-3 py-2 rounded bg-slate-100">
                                {formData.targetLevel === 'level0' ? 'Level 0 (Division)' :
                                    formData.targetLevel === 'level1' ? 'Level 1 (Department)' : 'Level 2 (SubTeam)'}
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium mb-1">이름 *</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="조직 이름"
                            />
                        </div>

                        {/* Division Selection (For Level 1) */}
                        {formData.targetLevel === 'level1' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">상위 조직 (Division)</label>
                                <select
                                    className="w-full border rounded px-3 py-2"
                                    value={formData.parentId}
                                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                                >
                                    <option value="">(선택 안함 / 소속 없음)</option>
                                    {level0Items.map(div => (
                                        <option key={div.id} value={div.id}>
                                            {div.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Code (create only) */}
                        {modalMode === 'create' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">코드</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-2"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="자동 생성됨"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal}>취소</Button>
                        <Button onClick={handleSave} disabled={!formData.name.trim()}>
                            {modalMode === 'create' ? '추가' : '저장'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => { setDeleteConfirm(null); setDeleteError(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>삭제 확인</DialogTitle>
                        <DialogDescription>
                            "{deleteConfirm?.name}"을(를) 삭제하시겠습니까?
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            ⚠️ {deleteError}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>취소</Button>
                        <Button variant="destructive" onClick={handleDelete}>삭제</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Division Row (Level 0)
const DivisionRow: React.FC<{
    item: Division;
    departments: Department[];
    allUsers: UserDetails[];
    positions: JobPosition[];
    isExpanded: boolean;
    expandedL1: Set<string>;
    canManageOrganization: boolean;
    onToggle: () => void;
    onToggleL1: (id: string) => void;
    onEdit: () => void;
    onDelete: () => void;
    onAddChild: () => void;
    onEditChildL1: (dept: Department) => void;
    onDeleteChildL1: (dept: Department) => void;
    onAddChildL2: (deptId: string) => void;
    onEditChildL2: (st: SubTeam, deptId: string) => void;
    onDeleteChildL2: (st: SubTeam) => void;
    queryClient: ReturnType<typeof useQueryClient>;
}> = ({ item, departments, allUsers, positions, isExpanded, expandedL1, canManageOrganization, onToggle, onToggleL1, onEdit, onDelete, onAddChild, onEditChildL1, onDeleteChildL1, onAddChildL2, onEditChildL2, onDeleteChildL2, queryClient }) => {

    return (
        <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border-b">
                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={onToggle}>
                    <span className="text-xl transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <div>
                        <div className="font-bold text-lg">{item.name}</div>
                    </div>
                </div>
                {canManageOrganization && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); onAddChild(); }}>+ Dept</Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</Button>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="p-4 space-y-3 bg-white">
                    {departments.length === 0 ? (
                        <div className="text-sm text-gray-400 italic pl-4">No Departments</div>
                    ) : (
                        departments.map(dept => (
                            <DepartmentRow
                                key={dept.id}
                                item={dept}
                                allUsers={allUsers}
                                positions={positions}
                                isExpanded={expandedL1.has(dept.id)}
                                onToggle={() => onToggleL1(dept.id)}
                                onEdit={() => onEditChildL1(dept)}
                                onDelete={() => onDeleteChildL1(dept)}
                                onAddChild={() => onAddChildL2(dept.id)}
                                onEditChild={(st) => onEditChildL2(st, dept.id)}
                                onDeleteChild={onDeleteChildL2}
                                queryClient={queryClient}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// Department Row (Level 1)
const DepartmentRow: React.FC<{
    item: Department;
    allUsers: UserDetails[];
    positions: JobPosition[];
    isExpanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onAddChild: () => void;
    onEditChild: (st: SubTeam) => void;
    onDeleteChild: (st: SubTeam) => void;
    queryClient: ReturnType<typeof useQueryClient>;
}> = ({ item, allUsers, positions, isExpanded, onToggle, onEdit, onDelete, onAddChild, onEditChild, onDeleteChild, queryClient }) => {
    const [editingMember, setEditingMember] = useState<UserDetails | null>(null);

    const { data: subTeams = [] } = useQuery({
        queryKey: ['sub-teams', item.id],
        queryFn: () => getSubTeams(item.id),
        enabled: isExpanded,
    });

    const deptMembers = allUsers.filter(u => u.department_id === item.id);

    return (
        <div className="border rounded bg-white">
            <div className="flex items-center justify-between p-2 pl-3 hover:bg-gray-50">
                <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={onToggle}>
                    <span className="text-sm text-gray-500">{isExpanded ? '📂' : '📁'}</span>
                    <span className="font-semibold text-sm">{item.name}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                        {deptMembers.length}
                    </span>
                </div>
                <div className="flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
                    <button className="text-green-600 hover:bg-green-50 text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); onAddChild(); }}>+Team</button>
                    <button className="text-blue-600 hover:bg-blue-50 text-xs px-1 py-1 rounded" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</button>
                    <button className="text-red-600 hover:bg-red-50 text-xs px-1 py-1 rounded" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</button>
                </div>
            </div>

            {isExpanded && (
                <div className="pl-6 py-2 space-y-2 border-t border-gray-100">
                    {/* Sub-Teams */}
                    {subTeams.map((st) => {
                        const stMembers = allUsers.filter(u => u.sub_team_id === st.id);
                        return (
                            <div key={st.id} className="border-l-2 border-gray-200 pl-2">
                                <div className="flex items-center justify-between gap-2 p-1 text-sm hover:bg-slate-50 rounded">
                                    <div className="flex items-center gap-2">
                                        <span>👥</span>
                                        <span>{st.name}</span>
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                            {stMembers.length}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="text-blue-600 hover:bg-blue-50 text-xs px-1 rounded" onClick={() => onEditChild(st)}>✏️</button>
                                        <button className="text-red-600 hover:bg-red-50 text-xs px-1 rounded" onClick={() => onDeleteChild(st)}>🗑️</button>
                                    </div>
                                </div>
                                {/* SubTeam Members */}
                                {stMembers.length > 0 && (
                                    <div className="ml-4 mt-1 space-y-0.5">
                                        {stMembers.map(member => (
                                            <div key={member.id} className="flex items-center justify-between text-xs p-1 hover:bg-slate-100 rounded group">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                                        {(member.name || member.korean_name || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                    <span>{member.korean_name || member.name}</span>
                                                    {member.korean_name && member.name && (
                                                        <span className="text-slate-400">({member.name})</span>
                                                    )}
                                                    {positions.find(p => p.id === member.position_id)?.name && (
                                                        <span className="text-slate-400">· {positions.find(p => p.id === member.position_id)?.name}</span>
                                                    )}
                                                </div>
                                                <button
                                                    className="text-blue-600 hover:bg-blue-50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setEditingMember(member)}
                                                >✏️</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {/* Members without SubTeam */}
                    {deptMembers.filter(m => !m.sub_team_id).length > 0 && (
                        <div className="border-l-2 border-gray-300 pl-2 mt-2">
                            <div className="text-xs text-muted-foreground mb-1">Direct Members:</div>
                            <div className="ml-2 space-y-0.5">
                                {deptMembers.filter(m => !m.sub_team_id).map(member => (
                                    <div key={member.id} className="flex items-center justify-between text-xs p-1 hover:bg-slate-100 rounded group">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                                {(member.name || member.korean_name || 'U').charAt(0).toUpperCase()}
                                            </span>
                                            <span>{member.korean_name || member.name}</span>
                                            {member.korean_name && member.name && (
                                                <span className="text-slate-400">({member.name})</span>
                                            )}
                                            {positions.find(p => p.id === member.position_id)?.name && (
                                                <span className="text-slate-400">· {positions.find(p => p.id === member.position_id)?.name}</span>
                                            )}
                                        </div>
                                        <button
                                            className="text-blue-600 hover:bg-blue-50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setEditingMember(member)}
                                        >✏️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Member Edit Modal */}
            {editingMember && (
                <UserEditModal
                    user={editingMember}
                    positions={positions}
                    onClose={() => setEditingMember(null)}
                    onSuccess={() => {
                        setEditingMember(null);
                        queryClient.invalidateQueries({ queryKey: ['users-all'] });
                    }}
                />
            )}
        </div>
    );
};
