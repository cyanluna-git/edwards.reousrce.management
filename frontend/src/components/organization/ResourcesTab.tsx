/**
 * ResourcesTab - User/Member Management
 * Lists users with department filter, edit capabilities, and history view
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useJobPositionsList } from '@/hooks/useJobPositionsCrud';
import { Search, X } from 'lucide-react';
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
    getUsers,
    getUserHistory,
    updateUser,
    type UserDetails,
} from '@/api/client';
import type { JobPosition } from '@/types';
import { OrganizationSelect } from '@/components/OrganizationSelect';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

type SortColumn = 'name' | 'email' | 'department' | 'position' | 'role' | 'status';
type SortDirection = 'asc' | 'desc';

export const ResourcesTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [editingUser, setEditingUser] = useState<UserDetails | null>(null);
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', selectedDeptId, 'includeInactive'],
        queryFn: () => getUsers(selectedDeptId || undefined, undefined, true),
    });

    const { data: positions = [] } = useJobPositionsList();

    const getDeptName = (deptId: string) => departments.find(d => d.id === deptId)?.name || deptId;
    const getPositionName = (posId: string) => positions.find(p => p.id === posId)?.name || posId;

    // Handle column header click for sorting
    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Filter and sort users
    const filteredUsers = useMemo(() => {
        let result = [...users];

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(user =>
                user.name?.toLowerCase().includes(term) ||
                user.korean_name?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term)
            );
        }

        // Sort by selected column
        result.sort((a, b) => {
            let valueA = '';
            let valueB = '';

            switch (sortColumn) {
                case 'name':
                    valueA = (a.name || '').toLowerCase();
                    valueB = (b.name || '').toLowerCase();
                    break;
                case 'email':
                    valueA = (a.email || '').toLowerCase();
                    valueB = (b.email || '').toLowerCase();
                    break;
                case 'department':
                    valueA = getDeptName(a.department_id).toLowerCase();
                    valueB = getDeptName(b.department_id).toLowerCase();
                    break;
                case 'position':
                    valueA = getPositionName(a.position_id).toLowerCase();
                    valueB = getPositionName(b.position_id).toLowerCase();
                    break;
                case 'role':
                    valueA = (a.role || '').toLowerCase();
                    valueB = (b.role || '').toLowerCase();
                    break;
                case 'status':
                    valueA = a.is_active ? 'a' : 'z';
                    valueB = b.is_active ? 'a' : 'z';
                    break;
            }

            const comparison = valueA.localeCompare(valueB);
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [users, searchTerm, sortColumn, sortDirection, departments, positions]);

    // Sortable header component
    const SortableHeader: React.FC<{ column: SortColumn; children: React.ReactNode; className?: string }> = ({ column, children, className = '' }) => (
        <th
            className={`py-2 px-3 cursor-pointer hover:bg-slate-100 select-none ${className}`}
            onClick={() => handleSort(column)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortColumn === column ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                    <ArrowUpDown className="h-3 w-3 text-slate-300" />
                )}
            </div>
        </th>
    );

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between">
                    <CardTitle>Resources ({filteredUsers.length}명)</CardTitle>
                    <select
                        className="border rounded px-3 py-1.5 text-sm"
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                    >
                        <option value="">All Departments</option>
                        {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                </div>
                {/* Search Input */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="이름 검색 (한글/영어/이메일)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 text-sm border rounded-md"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4">Loading...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? `"${searchTerm}" 검색 결과가 없습니다.` : '등록된 사용자가 없습니다.'}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-slate-50">
                                <SortableHeader column="name" className="text-left">Name</SortableHeader>
                                <SortableHeader column="email" className="text-left">Email</SortableHeader>
                                <SortableHeader column="department" className="text-left">Department</SortableHeader>
                                <SortableHeader column="position" className="text-left">Position</SortableHeader>
                                <SortableHeader column="role" className="text-left">Role</SortableHeader>
                                <SortableHeader column="status" className="text-center">Status</SortableHeader>
                                <th className="text-right py-2 px-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="border-b hover:bg-slate-50">
                                    <td className="py-2 px-3">
                                        <div className="font-medium">{user.name}</div>
                                        {user.korean_name && <div className="text-xs text-muted-foreground">{user.korean_name}</div>}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">{user.email}</td>
                                    <td className="py-2 px-3">{getDeptName(user.department_id)}</td>
                                    <td className="py-2 px-3">{getPositionName(user.position_id)}</td>
                                    <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </td>
                                    <td className="py-2 px-3 text-right space-x-2">
                                        <button className="text-blue-600 hover:underline text-xs" onClick={() => setEditingUser(user)}>✏️ Edit</button>
                                        <button className="text-gray-600 hover:underline text-xs" onClick={() => setSelectedUser(user)}>📋 History</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>

            {/* User History Modal */}
            {selectedUser && (
                <UserHistoryModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}

            {/* User Edit Modal */}
            {editingUser && (
                <UserEditModal
                    user={editingUser}
                    positions={positions}
                    onClose={() => setEditingUser(null)}
                    onSuccess={() => {
                        setEditingUser(null);
                        queryClient.invalidateQueries({ queryKey: ['users'] });
                    }}
                />
            )}
        </Card>
    );
};

// User Edit Modal Component (exported for reuse)
export const UserEditModal: React.FC<{
    user: UserDetails;
    positions: JobPosition[];
    onClose: () => void;
    onSuccess: () => void;
}> = ({ user, positions, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: user.name,
        korean_name: user.korean_name || '',
        department_id: user.department_id,
        sub_team_id: user.sub_team_id || '',
        position_id: user.position_id,
        role: user.role,
        is_active: user.is_active,
    });

    const updateMutation = useMutation({
        mutationFn: (data: Parameters<typeof updateUser>[1]) => updateUser(user.id, data),
        onSuccess,
    });

    const handleSubmit = () => {
        updateMutation.mutate({
            name: formData.name,
            korean_name: formData.korean_name || null,
            department_id: formData.department_id,
            sub_team_id: formData.sub_team_id || null,
            position_id: formData.position_id,
            role: formData.role,
            is_active: formData.is_active,
        });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Member: {user.name}</DialogTitle>
                    <DialogDescription>사용자 정보를 수정합니다.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">영어 이름 *</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="English Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">한글 이름</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={formData.korean_name}
                                onChange={(e) => setFormData({ ...formData, korean_name: e.target.value })}
                                placeholder="Korean Name"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input type="text" className="w-full border rounded px-3 py-2 bg-gray-50" value={user.email} disabled />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">조직 *</label>
                        <OrganizationSelect
                            departmentId={formData.department_id}
                            subTeamId={formData.sub_team_id || null}
                            onChange={(deptId, stId, _displayName) => {
                                setFormData({ ...formData, department_id: deptId, sub_team_id: stId || '' });
                            }}
                            placeholder="조직 선택..."
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Job Position *</label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={formData.position_id}
                            onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                        >
                            {positions.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="USER">USER</option>
                            <option value="PM">PM</option>
                            <option value="FM">FM</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <label htmlFor="is_active" className="text-sm">Active</label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>취소</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={updateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {updateMutation.isPending ? '저장 중...' : '저장'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const UserHistoryModal: React.FC<{ user: UserDetails; onClose: () => void }> = ({ user, onClose }) => {
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['user-history', user.id],
        queryFn: () => getUserHistory(user.id),
    });

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{user.name} - History</DialogTitle>
                    <DialogDescription>사용자의 변경 이력을 확인합니다.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">No history records</div>
                    ) : (
                        <div className="space-y-2">
                            {history.map((h) => (
                                <div key={h.id} className="flex items-start gap-3 p-3 border rounded">
                                    <div className={`w-3 h-3 rounded-full mt-1 ${h.change_type === 'HIRE' ? 'bg-green-500' :
                                        h.change_type === 'RESIGN' ? 'bg-red-500' :
                                            h.change_type === 'PROMOTION' ? 'bg-yellow-500' :
                                                'bg-blue-500'
                                        }`} />
                                    <div className="flex-1">
                                        <div className="font-medium">{h.change_type}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {new Date(h.start_date).toLocaleDateString()}
                                            {h.end_date && ` - ${new Date(h.end_date).toLocaleDateString()}`}
                                        </div>
                                        {h.remarks && <div className="text-sm mt-1">{h.remarks}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ResourcesTab;
