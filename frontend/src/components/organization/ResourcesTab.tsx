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
    getBusinessUnits,
    getDepartments,
    getDivisions,
    getSubTeams,
    getUsers,
    getUserHistory,
    updateUser,
    createUser,
    type UserDetails,
} from '@/api/client';
import type { JobPosition } from '@/types';
import { OrganizationSelect } from '@/components/OrganizationSelect';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

type SortColumn = 'name' | 'email' | 'division' | 'department' | 'subteam' | 'position' | 'primary_bu' | 'role' | 'status';
type SortDirection = 'asc' | 'desc';

export const ResourcesTab: React.FC = () => {
    const queryClient = useQueryClient();
    const { canManageUsers } = usePermissions();
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [editingUser, setEditingUser] = useState<UserDetails | null>(null);
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const { data: divisions = [] } = useQuery({
        queryKey: ['divisions'],
        queryFn: () => getDivisions(),
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const { data: businessUnits = [] } = useQuery({
        queryKey: ['business-units'],
        queryFn: () => getBusinessUnits(),
    });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', selectedDeptId, 'includeInactive'],
        queryFn: () => getUsers(selectedDeptId || undefined, undefined, true),
    });

    const { data: positions = [] } = useJobPositionsList();

    // Get all sub-teams for all departments
    const departmentIds = Array.from(new Set(users.map(u => u.department_id).filter((id): id is string => !!id)));
    const { data: allSubTeams = [] } = useQuery({
        queryKey: ['all-sub-teams', departmentIds],
        queryFn: async () => {
            const results = await Promise.all(
                departmentIds.map(deptId => getSubTeams(deptId))
            );
            return results.flat();
        },
        enabled: departmentIds.length > 0,
    });

    const getDivisionName = (user: UserDetails) => {
        if (user.division_id) {
            return divisions.find(d => d.id === user.division_id)?.name || '-';
        }
        const dept = departments.find(d => d.id === user.department_id);
        if (!dept) return '-';
        const div = divisions.find(d => d.id === dept.division_id);
        return div?.name || '-';
    };

    const getDeptName = (deptId: string | null) => {
        if (!deptId) return '-';
        return departments.find(d => d.id === deptId)?.name || '-';
    };

    const getSubTeamName = (subTeamId: string | null) => {
        if (!subTeamId) return '-';
        return allSubTeams.find(st => st.id === subTeamId)?.name || '-';
    };

    const getBuName = (buId: string | null) => {
        if (!buId) return '-';
        return businessUnits.find(bu => bu.id === buId)?.name || '-';
    };

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
                case 'division':
                    valueA = getDivisionName(a).toLowerCase();
                    valueB = getDivisionName(b).toLowerCase();
                    break;
                case 'department':
                    valueA = getDeptName(a.department_id).toLowerCase();
                    valueB = getDeptName(b.department_id).toLowerCase();
                    break;
                case 'subteam':
                    valueA = getSubTeamName(a.sub_team_id).toLowerCase();
                    valueB = getSubTeamName(b.sub_team_id).toLowerCase();
                    break;
                case 'position':
                    valueA = getPositionName(a.position_id).toLowerCase();
                    valueB = getPositionName(b.position_id).toLowerCase();
                    break;
                case 'primary_bu':
                    valueA = getBuName(a.primary_business_unit_id).toLowerCase();
                    valueB = getBuName(b.primary_business_unit_id).toLowerCase();
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
    }, [users, searchTerm, sortColumn, sortDirection, departments, divisions, allSubTeams, positions]);

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
                    <div className="flex gap-2">
                        {canManageUsers && (
                            <Button onClick={() => setEditingUser({} as UserDetails)}>
                                + 사용자 추가
                            </Button>
                        )}
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
                                <SortableHeader column="division" className="text-left">Division</SortableHeader>
                                <SortableHeader column="department" className="text-left">Department</SortableHeader>
                                <SortableHeader column="subteam" className="text-left">SubTeam</SortableHeader>
                                <SortableHeader column="position" className="text-left">Position</SortableHeader>
                                <SortableHeader column="primary_bu" className="text-left">Primary BU</SortableHeader>
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
                                    <td className="py-2 px-3">{getDivisionName(user)}</td>
                                    <td className="py-2 px-3">{getDeptName(user.department_id)}</td>
                                    <td className="py-2 px-3 text-muted-foreground">{getSubTeamName(user.sub_team_id)}</td>
                                    <td className="py-2 px-3">{getPositionName(user.position_id)}</td>
                                    <td className="py-2 px-3">{getBuName(user.primary_business_unit_id)}</td>
                                    <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </td>
                                    <td className="py-2 px-3 text-right space-x-2">
                                        {canManageUsers && (
                                            <button className="text-blue-600 hover:underline text-xs" onClick={() => setEditingUser(user)}>✏️ Edit</button>
                                        )}
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
    const _queryClient = useQueryClient();
    void _queryClient; // Reserved for cache invalidation
    const { data: businessUnits = [] } = useQuery({
        queryKey: ['business-units'],
        queryFn: () => getBusinessUnits(),
    });

    const isNewUser = !user.id;
    const [formData, setFormData] = useState({
        email: user.email || '',
        name: user.name || '',
        korean_name: user.korean_name || '',
        division_id: user.division_id || '',
        department_id: user.department_id || '',
        sub_team_id: user.sub_team_id || '',
        position_id: user.position_id || (positions[0]?.id || ''),
        primary_business_unit_id: user.primary_business_unit_id || '',
        role: user.role || 'USER',
        is_active: user.is_active ?? true,
    });

    const createMutation = useMutation({
        mutationFn: (data: Parameters<typeof createUser>[0]) => createUser(data),
        onSuccess,
    });

    const updateMutation = useMutation({
        mutationFn: (data: Parameters<typeof updateUser>[1]) => updateUser(user.id, data),
        onSuccess,
    });

    const handleSubmit = () => {
        if (isNewUser) {
            // Create new user with default password
            createMutation.mutate({
                email: formData.email,
                name: formData.name,
                korean_name: formData.korean_name || null,
                division_id: formData.division_id || null,
                department_id: formData.department_id || null,
                sub_team_id: formData.sub_team_id || null,
                position_id: formData.position_id,
                primary_business_unit_id: formData.primary_business_unit_id || null,
                role: formData.role,
                is_active: formData.is_active,
                password: 'edwards@!', // Default password
            });
        } else {
            // Update existing user
            updateMutation.mutate({
                name: formData.name,
                korean_name: formData.korean_name || null,
                division_id: formData.division_id || null,
                department_id: formData.department_id || null,
                sub_team_id: formData.sub_team_id || null,
                position_id: formData.position_id,
                primary_business_unit_id: formData.primary_business_unit_id || null,
                role: formData.role,
                is_active: formData.is_active,
            });
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;
    const error = createMutation.error || updateMutation.error;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isNewUser ? '신규 사용자 추가' : `Edit Member: ${user.name}`}</DialogTitle>
                    <DialogDescription>
                        {isNewUser ? '신규 사용자를 생성합니다. 기본 패스워드는 "edwards@!" 입니다.' : '사용자 정보를 수정합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                            {error.message || '오류가 발생했습니다.'}
                        </div>
                    )}
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
                        <label className="block text-sm font-medium mb-1">Email {isNewUser && '*'}</label>
                        <input
                            type="email"
                            className={`w-full border rounded px-3 py-2 ${isNewUser ? '' : 'bg-gray-50'}`}
                            value={isNewUser ? formData.email : user.email}
                            onChange={isNewUser ? (e) => setFormData({ ...formData, email: e.target.value }) : undefined}
                            disabled={!isNewUser}
                            placeholder={isNewUser ? "user@edwardsvacuum.com" : undefined}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">조직 *</label>
                        <OrganizationSelect
                            divisionId={formData.division_id}
                            departmentId={formData.department_id}
                            subTeamId={formData.sub_team_id || null}
                            onChange={(divId, deptId, stId, _displayName) => {
                                setFormData({
                                    ...formData,
                                    division_id: divId || '',
                                    department_id: deptId || '',
                                    sub_team_id: stId || ''
                                });
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
                        <label className="block text-sm font-medium mb-1">Primary Business Unit</label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={formData.primary_business_unit_id}
                            onChange={(e) => setFormData({ ...formData, primary_business_unit_id: e.target.value })}
                        >
                            <option value="">- 선택 -</option>
                            {businessUnits.map((bu) => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
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
                        disabled={isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isPending ? '처리 중...' : (isNewUser ? '생성' : '저장')}
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
