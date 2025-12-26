/**
 * ResourcesTab - User/Member Management
 * Lists users with department filter, edit capabilities, and history view
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useJobPositionsList } from '@/hooks/useJobPositionsCrud';
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

export const ResourcesTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [editingUser, setEditingUser] = useState<UserDetails | null>(null);

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', selectedDeptId],
        queryFn: () => getUsers(selectedDeptId || undefined),
    });

    const { data: positions = [] } = useJobPositionsList();

    const getDeptName = (deptId: string) => departments.find(d => d.id === deptId)?.name || deptId;
    const getPositionName = (posId: string) => positions.find(p => p.id === posId)?.name || posId;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Resources ({users.length}명)</CardTitle>
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
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4">Loading...</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-slate-50">
                                <th className="text-left py-2 px-3">Name</th>
                                <th className="text-left py-2 px-3">Email</th>
                                <th className="text-left py-2 px-3">Department</th>
                                <th className="text-left py-2 px-3">Position</th>
                                <th className="text-left py-2 px-3">Role</th>
                                <th className="text-center py-2 px-3">Status</th>
                                <th className="text-right py-2 px-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
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
                    <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
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
