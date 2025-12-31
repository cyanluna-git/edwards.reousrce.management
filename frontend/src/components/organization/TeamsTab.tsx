/**
 * TeamsTab - Organization Hierarchy Management (Function Axis)
 * Level 0 (Department) > Level 1 (SubTeam)
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
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getSubTeams,
    createSubTeam,
    updateSubTeam,
    deleteSubTeam,
    getUsers,
    type Department,
    type SubTeam,
    type UserDetails,
} from '@/api/client';
import type { JobPosition } from '@/types';

type OrgLevel = 'level0' | 'level1';
type ModalMode = 'create' | 'edit';

interface OrgItem {
    type: OrgLevel;
    id: string;
    name: string;
    code: string;
    parentId?: string; // For level1 (SubTeam -> Department)
}

export const TeamsTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [expandedL0, setExpandedL0] = useState<Set<string>>(new Set());

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>('create');
    const [editingItem, setEditingItem] = useState<OrgItem | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '', parentId: '', targetLevel: '' as OrgLevel | '' });

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<OrgItem | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Queries
    // Level 0: Departments
    const { data: level0Items = [], isLoading: loadingL0 } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(undefined, true), // active only
    });

    // Fetch all users for member counts
    const { data: allUsers = [] } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => getUsers(undefined, true),
    });

    // Fetch positions for member editing
    const { data: positions = [] } = useJobPositionsList();

    // Mutations - Level 0 (Department)
    const createL0 = useMutation({
        mutationFn: (data: { name: string; code: string }) =>
            createDepartment({ name: data.name, code: data.code, is_active: true }), // Removed business_unit_id
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
    });

    const updateL0 = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateDepartment(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
    });

    const deleteL0 = useMutation({
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

    // Mutations - Level 1 (SubTeam)
    const createL1 = useMutation({
        mutationFn: (data: { name: string; code: string; parentId: string }) =>
            createSubTeam(data.parentId, { name: data.name, code: data.code, is_active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] }); // Invalidate L0 to refresh counts/structure if needed
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            closeModal();
        },
    });

    const updateL1 = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateSubTeam(id, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-teams'] });
            closeModal();
        },
    });

    const deleteL1 = useMutation({
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

    const openCreateModal = (type: OrgLevel, parentId?: string) => {
        setModalMode('create');
        setEditingItem({ type, id: '', name: '', code: '', parentId });
        setFormData({ name: '', code: '', parentId: parentId || '', targetLevel: type });
        setModalOpen(true);
    };

    const openEditModal = (item: OrgItem) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({ name: item.name, code: item.code, parentId: item.parentId || '', targetLevel: item.type });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', code: '', parentId: '', targetLevel: '' });
    };

    const handleSave = () => {
        if (!formData.name.trim()) return;

        const code = formData.code || (editingItem ? editingItem.code : formData.name.toUpperCase().slice(0, 5));

        if (modalMode === 'create') {
            if (formData.targetLevel === 'level0') {
                createL0.mutate({ name: formData.name, code });
            } else if (formData.targetLevel === 'level1' && formData.parentId) {
                createL1.mutate({ name: formData.name, code, parentId: formData.parentId });
            }
        } else if (editingItem) {
            if (editingItem.type === 'level0') {
                updateL0.mutate({ id: editingItem.id, name: formData.name });
            } else if (editingItem.type === 'level1') {
                updateL1.mutate({ id: editingItem.id, name: formData.name });
            }
        }
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'level0') deleteL0.mutate(deleteConfirm.id);
        else if (deleteConfirm.type === 'level1') deleteL1.mutate(deleteConfirm.id);
    };

    if (loadingL0) return <div className="text-center py-8">Loading...</div>;

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Organization Hierarchy (Function Axis)</CardTitle>
                    <Button onClick={() => openCreateModal('level0')}>+ Department 추가</Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {level0Items.map((l0) => (
                            <DepartmentRow
                                key={l0.id}
                                item={l0}
                                allUsers={allUsers}
                                positions={positions}
                                isExpanded={expandedL0.has(l0.id)}
                                onToggle={() => toggleL0(l0.id)}
                                onEdit={() => openEditModal({ type: 'level0', id: l0.id, name: l0.name, code: l0.code })}
                                onDelete={() => setDeleteConfirm({ type: 'level0', id: l0.id, name: l0.name, code: l0.code })}
                                onAddChild={() => openCreateModal('level1', l0.id)}
                                onEditChild={(st) => openEditModal({ type: 'level1', id: st.id, name: st.name, code: st.code, parentId: l0.id })}
                                onDeleteChild={(st) => setDeleteConfirm({ type: 'level1', id: st.id, name: st.name, code: st.code })}
                                queryClient={queryClient}
                            />
                        ))}
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
                    <div className="space-y-4 py-4">
                        {/* Level Selection (editable in edit mode) */}
                        <div>
                            <label className="block text-sm font-medium mb-1">수준</label>
                            <div className="text-sm font-medium px-3 py-2 rounded bg-slate-100">
                                {formData.targetLevel === 'level0' ? 'Level 0 (Department)' : 'Level 1 (SubTeam)'}
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

// Department Row (Level 0)
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
        <div className="border rounded-lg bg-white">
            <div className="flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200">
                <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={onToggle}>
                    <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-sm text-muted-foreground">({item.code})</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        👤 {deptMembers.length}
                    </span>
                </div>
                <div className="flex gap-1">
                    <button className="text-green-600 hover:bg-green-50 text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); onAddChild(); }}>➕ SubTeam</button>
                    <button className="text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</button>
                    <button className="text-red-600 hover:bg-red-50 text-xs px-2 py-1 rounded" onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑️</button>
                </div>
            </div>

            {isExpanded && (
                <div className="pl-6 py-2 space-y-2">
                    {/* Sub-Teams */}
                    {subTeams.map((st) => {
                        const stMembers = allUsers.filter(u => u.sub_team_id === st.id);
                        return (
                            <div key={st.id} className="border-l-2 border-gray-200 pl-2">
                                <div className="flex items-center justify-between gap-2 p-1 text-sm hover:bg-slate-50 rounded">
                                    <div className="flex items-center gap-2">
                                        <span>👥</span>
                                        <span>{st.name}</span>
                                        <span className="text-muted-foreground">({st.code})</span>
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                            👤 {stMembers.length}
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
                                            <div key={member.id} className="flex items-center justify-between text-xs p-1 hover:bg-slate-100 rounded">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                                        {(member.name || member.korean_name || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                    <span>{member.korean_name || member.name}</span>
                                                    {member.korean_name && member.name && (
                                                        <span className="text-muted-foreground">({member.name})</span>
                                                    )}
                                                </div>
                                                <button
                                                    className="text-blue-600 hover:bg-blue-50 px-1 rounded"
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
                            <div className="text-xs text-muted-foreground mb-1">하위팀 없는 구성원:</div>
                            <div className="ml-2 space-y-0.5">
                                {deptMembers.filter(m => !m.sub_team_id).map(member => (
                                    <div key={member.id} className="flex items-center justify-between text-xs p-1 hover:bg-slate-100 rounded">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                                {(member.name || member.korean_name || 'U').charAt(0).toUpperCase()}
                                            </span>
                                            <span>{member.korean_name || member.name}</span>
                                            {member.korean_name && member.name && (
                                                <span className="text-muted-foreground">({member.name})</span>
                                            )}
                                        </div>
                                        <button
                                            className="text-blue-600 hover:bg-blue-50 px-1 rounded"
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
