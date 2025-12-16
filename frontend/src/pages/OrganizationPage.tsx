import React, { useState } from 'react';
import {
    useJobPositionsList,
    useCreateJobPosition,
    useUpdateJobPosition,
    useDeleteJobPosition,
} from '@/hooks/useJobPositionsCrud';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui';
import type { JobPosition } from '@/types';

export const OrganizationPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'positions'>('positions');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
    const [formName, setFormName] = useState('');

    // Data
    const { data: positions = [], isLoading } = useJobPositionsList();

    // Mutations
    const createPosition = useCreateJobPosition();
    const updatePosition = useUpdateJobPosition();
    const deletePosition = useDeleteJobPosition();

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
        setFormName('');
        setEditingPosition(null);
    };

    const handleDelete = async (position: JobPosition) => {
        if (!confirm(`"${position.name}" 포지션을 삭제하시겠습니까?`)) return;
        await deletePosition.mutateAsync(position.id);
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">조직 관리</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    className={`px-4 py-2 -mb-px ${activeTab === 'positions'
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-muted-foreground'
                        }`}
                    onClick={() => setActiveTab('positions')}
                >
                    Job Positions
                </button>
            </div>

            {/* Content */}
            {activeTab === 'positions' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Job Positions</CardTitle>
                        <Button onClick={openAddModal}>+ 추가</Button>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-4">로딩 중...</div>
                        ) : positions.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                                등록된 포지션이 없습니다.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50">
                                        <th className="text-left py-3 px-4">이름</th>
                                        <th className="text-right py-3 px-4 w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positions.map(position => (
                                        <tr key={position.id} className="border-b hover:bg-slate-50">
                                            <td className="py-3 px-4">{position.name}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    className="text-blue-600 hover:underline mr-3"
                                                    onClick={() => openEditModal(position)}
                                                >
                                                    ✏️ 수정
                                                </button>
                                                <button
                                                    className="text-red-600 hover:underline"
                                                    onClick={() => handleDelete(position)}
                                                >
                                                    🗑️ 삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingPosition ? '포지션 수정' : '새 포지션 추가'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <label className="block text-sm font-medium mb-2">포지션 이름</label>
                        <input
                            type="text"
                            className="w-full border rounded px-3 py-2"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="예: Software engineer"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} disabled={!formName.trim()}>
                            {editingPosition ? '수정' : '추가'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationPage;
