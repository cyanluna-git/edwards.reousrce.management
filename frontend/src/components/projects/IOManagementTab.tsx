/**
 * IOManagementTab - Manage Internal IO and Recharge IO
 */
import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui';
import {
    createInternalIO,
    updateInternalIO,
    deleteInternalIO,
    createRechargeIO,
    updateRechargeIO,
    deleteRechargeIO,
    InternalIOCreate,
    InternalIOUpdate,
    RechargeIOCreate,
    RechargeIOUpdate,
} from '@/api/client';
import { useInternalIOsList } from '@/hooks/useInternalIOs';
import { useRechargeIOsList } from '@/hooks/useRechargeIOs';

interface IOFormData {
    id?: string;
    io_number: string;
    name: string;
    description: string;
}

const emptyFormData: IOFormData = {
    io_number: '',
    name: '',
    description: '',
};

export const IOManagementTab: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeIOTab, setActiveIOTab] = useState('internal');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch IO data
    const { data: internalIOs = [], isLoading: loadingInternal } = useInternalIOsList();
    const { data: rechargeIOs = [], isLoading: loadingRecharge } = useRechargeIOsList();

    // Modal state
    const [internalModalOpen, setInternalModalOpen] = useState(false);
    const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
    const [internalFormData, setInternalFormData] = useState<IOFormData>(emptyFormData);
    const [rechargeFormData, setRechargeFormData] = useState<IOFormData>(emptyFormData);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'internal' | 'recharge'; id: string; io_number: string } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Filter IOs by search query
    const filteredInternalIOs = useMemo(() => {
        if (!searchQuery) return internalIOs;
        const query = searchQuery.toLowerCase();
        return internalIOs.filter(io =>
            io.io_number.toLowerCase().includes(query) ||
            (io.name?.toLowerCase().includes(query))
        );
    }, [internalIOs, searchQuery]);

    const filteredRechargeIOs = useMemo(() => {
        if (!searchQuery) return rechargeIOs;
        const query = searchQuery.toLowerCase();
        return rechargeIOs.filter(io =>
            io.io_number.toLowerCase().includes(query) ||
            (io.name?.toLowerCase().includes(query))
        );
    }, [rechargeIOs, searchQuery]);

    // Internal IO Mutations
    const createInternalMutation = useMutation({
        mutationFn: (data: InternalIOCreate) => createInternalIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['internal-ios'] });
            setInternalModalOpen(false);
            setInternalFormData(emptyFormData);
        },
    });

    const updateInternalMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: InternalIOUpdate }) => updateInternalIO(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['internal-ios'] });
            setInternalModalOpen(false);
            setInternalFormData(emptyFormData);
        },
    });

    const deleteInternalMutation = useMutation({
        mutationFn: (id: string) => deleteInternalIO(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['internal-ios'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || 'Failed to delete Internal IO');
        },
    });

    // Recharge IO Mutations
    const createRechargeMutation = useMutation({
        mutationFn: (data: RechargeIOCreate) => createRechargeIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recharge-ios'] });
            setRechargeModalOpen(false);
            setRechargeFormData(emptyFormData);
        },
    });

    const updateRechargeMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: RechargeIOUpdate }) => updateRechargeIO(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recharge-ios'] });
            setRechargeModalOpen(false);
            setRechargeFormData(emptyFormData);
        },
    });

    const deleteRechargeMutation = useMutation({
        mutationFn: (id: string) => deleteRechargeIO(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recharge-ios'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || 'Failed to delete Recharge IO');
        },
    });

    // Handlers
    const handleAddInternal = () => {
        setInternalFormData(emptyFormData);
        setInternalModalOpen(true);
    };

    const handleEditInternal = (io: any) => {
        setInternalFormData({
            id: io.id,
            io_number: io.io_number,
            name: io.name || '',
            description: io.description || '',
        });
        setInternalModalOpen(true);
    };

    const handleSaveInternal = () => {
        if (internalFormData.id) {
            updateInternalMutation.mutate({
                id: internalFormData.id,
                data: {
                    io_number: internalFormData.io_number,
                    name: internalFormData.name || undefined,
                    description: internalFormData.description || undefined,
                },
            });
        } else {
            createInternalMutation.mutate({
                io_number: internalFormData.io_number,
                name: internalFormData.name || undefined,
                description: internalFormData.description || undefined,
            });
        }
    };

    const handleAddRecharge = () => {
        setRechargeFormData(emptyFormData);
        setRechargeModalOpen(true);
    };

    const handleEditRecharge = (io: any) => {
        setRechargeFormData({
            id: io.id,
            io_number: io.io_number,
            name: io.name || '',
            description: io.description || '',
        });
        setRechargeModalOpen(true);
    };

    const handleSaveRecharge = () => {
        if (rechargeFormData.id) {
            updateRechargeMutation.mutate({
                id: rechargeFormData.id,
                data: {
                    io_number: rechargeFormData.io_number,
                    name: rechargeFormData.name || undefined,
                    description: rechargeFormData.description || undefined,
                },
            });
        } else {
            createRechargeMutation.mutate({
                io_number: rechargeFormData.io_number,
                name: rechargeFormData.name || undefined,
                description: rechargeFormData.description || undefined,
            });
        }
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'internal') {
            deleteInternalMutation.mutate(deleteConfirm.id);
        } else {
            deleteRechargeMutation.mutate(deleteConfirm.id);
        }
    };

    const renderIOTable = (
        ios: any[],
        type: 'internal' | 'recharge',
        onEdit: (io: any) => void,
        onDelete: (io: any) => void
    ) => (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium w-32">IO Number</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium w-20">Status</th>
                    <th className="text-center p-3 font-medium w-24">Actions</th>
                </tr>
            </thead>
            <tbody>
                {ios.map((io) => (
                    <tr key={io.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-mono text-xs font-semibold">{io.io_number}</td>
                        <td className="p-3">{io.name || '-'}</td>
                        <td className="p-3 text-muted-foreground">{io.description || '-'}</td>
                        <td className="p-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                io.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {io.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td className="p-3 text-center">
                            <div className="flex justify-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 text-blue-600"
                                    onClick={() => onEdit(io)}
                                    title="Edit"
                                >
                                    ✏️
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 text-red-600"
                                    onClick={() => onDelete(io)}
                                    title="Delete"
                                >
                                    🗑️
                                </Button>
                            </div>
                        </td>
                    </tr>
                ))}
                {ios.length === 0 && (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No {type === 'internal' ? 'Internal' : 'Recharge'} IOs found
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-4">
                <Input
                    placeholder="Search by IO number or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                />
                <span className="text-sm text-muted-foreground">
                    Internal: {filteredInternalIOs.length} / Recharge: {filteredRechargeIOs.length}
                </span>
            </div>

            <Tabs value={activeIOTab} onValueChange={setActiveIOTab}>
                <TabsList>
                    <TabsTrigger value="internal">
                        Internal IO ({internalIOs.length})
                    </TabsTrigger>
                    <TabsTrigger value="recharge">
                        Recharge IO ({rechargeIOs.length})
                    </TabsTrigger>
                </TabsList>

                {/* Internal IO Tab */}
                <TabsContent value="internal" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg">Internal IO Management</CardTitle>
                            <Button size="sm" onClick={handleAddInternal}>
                                + New Internal IO
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loadingInternal ? (
                                <div className="p-8 text-center text-muted-foreground">Loading...</div>
                            ) : (
                                renderIOTable(
                                    filteredInternalIOs,
                                    'internal',
                                    handleEditInternal,
                                    (io) => setDeleteConfirm({ type: 'internal', id: io.id, io_number: io.io_number })
                                )
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Recharge IO Tab */}
                <TabsContent value="recharge" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg">Recharge IO Management</CardTitle>
                            <Button size="sm" onClick={handleAddRecharge}>
                                + New Recharge IO
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loadingRecharge ? (
                                <div className="p-8 text-center text-muted-foreground">Loading...</div>
                            ) : (
                                renderIOTable(
                                    filteredRechargeIOs,
                                    'recharge',
                                    handleEditRecharge,
                                    (io) => setDeleteConfirm({ type: 'recharge', id: io.id, io_number: io.io_number })
                                )
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Internal IO Modal */}
            <Dialog open={internalModalOpen} onOpenChange={setInternalModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {internalFormData.id ? 'Edit Internal IO' : 'Add Internal IO'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="internal-io-number" className="text-right">IO Number *</Label>
                            <Input
                                id="internal-io-number"
                                value={internalFormData.io_number}
                                onChange={(e) => setInternalFormData({ ...internalFormData, io_number: e.target.value })}
                                className="col-span-3"
                                placeholder="e.g., 406123"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="internal-name" className="text-right">Name</Label>
                            <Input
                                id="internal-name"
                                value={internalFormData.name}
                                onChange={(e) => setInternalFormData({ ...internalFormData, name: e.target.value })}
                                className="col-span-3"
                                placeholder="Optional display name"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="internal-desc" className="text-right">Description</Label>
                            <Input
                                id="internal-desc"
                                value={internalFormData.description}
                                onChange={(e) => setInternalFormData({ ...internalFormData, description: e.target.value })}
                                className="col-span-3"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInternalModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSaveInternal}
                            disabled={!internalFormData.io_number || createInternalMutation.isPending || updateInternalMutation.isPending}
                        >
                            {createInternalMutation.isPending || updateInternalMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recharge IO Modal */}
            <Dialog open={rechargeModalOpen} onOpenChange={setRechargeModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {rechargeFormData.id ? 'Edit Recharge IO' : 'Add Recharge IO'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="recharge-io-number" className="text-right">IO Number *</Label>
                            <Input
                                id="recharge-io-number"
                                value={rechargeFormData.io_number}
                                onChange={(e) => setRechargeFormData({ ...rechargeFormData, io_number: e.target.value })}
                                className="col-span-3"
                                placeholder="e.g., RCH001"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="recharge-name" className="text-right">Name</Label>
                            <Input
                                id="recharge-name"
                                value={rechargeFormData.name}
                                onChange={(e) => setRechargeFormData({ ...rechargeFormData, name: e.target.value })}
                                className="col-span-3"
                                placeholder="Optional display name"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="recharge-desc" className="text-right">Description</Label>
                            <Input
                                id="recharge-desc"
                                value={rechargeFormData.description}
                                onChange={(e) => setRechargeFormData({ ...rechargeFormData, description: e.target.value })}
                                className="col-span-3"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRechargeModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSaveRecharge}
                            disabled={!rechargeFormData.io_number || createRechargeMutation.isPending || updateRechargeMutation.isPending}
                        >
                            {createRechargeMutation.isPending || updateRechargeMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setDeleteError(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p>Are you sure you want to delete {deleteConfirm?.type === 'internal' ? 'Internal' : 'Recharge'} IO "{deleteConfirm?.io_number}"?</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            This action cannot be undone. If projects are using this IO, the deletion will fail.
                        </p>
                    </div>
                    {deleteError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            {deleteError}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteInternalMutation.isPending || deleteRechargeMutation.isPending}
                        >
                            {deleteInternalMutation.isPending || deleteRechargeMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default IOManagementTab;
