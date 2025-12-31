/**
 * ProjectHierarchyEditor - Hierarchical management of projects
 * Level 0 (Business Unit) > Level 1 (Product Line) > Level 2 (Project)
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Input,
    Label,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui';
import {
    getBusinessUnits,
    createBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
    createProductLine,
    updateProductLine,
    deleteProductLine,
    deleteProject as apiDeleteProject,
} from '@/api/client';
import type { ProductLine, Project } from '@/types';
import { useProjectHierarchy } from '@/hooks/useProjectHierarchy';
import ProjectForm from '@/components/forms/ProjectForm';
import { useNavigate } from 'react-router-dom';

type HierarchyLevel = 'business_unit' | 'product_line' | 'project';

export const ProjectHierarchyEditor: React.FC = () => {

    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: hierarchy, isLoading } = useProjectHierarchy();
    const productProjects = hierarchy?.product_projects || [];
    const functionalProjects = hierarchy?.functional_projects || [];

    // State
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState('product');

    // Business Unit Modal State
    const [buModalOpen, setBuModalOpen] = useState(false);
    const [buFormData, setBuFormData] = useState<{ id?: string; name: string; code: string; is_active: boolean }>({
        name: '',
        code: '',
        is_active: true,
    });

    // Product Line Modal State
    const [plModalOpen, setPlModalOpen] = useState(false);
    const [plFormData, setPlFormData] = useState<{
        id?: string;
        name: string;
        code: string;
        business_unit_id: string;
        line_category: 'PRODUCT' | 'PLATFORM' | 'LEGACY';
        description?: string;
    }>({
        name: '',
        code: '',
        business_unit_id: '',
        line_category: 'PRODUCT',
        description: '',
    });

    // Project Modal State
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
    const [projectInitialValues, setProjectInitialValues] = useState<any>({});

    // Delete Confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: HierarchyLevel; id: string; name: string } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Toggle Expansion

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    // --- Business Unit Mutations ---
    const createBuMutation = useMutation({
        mutationFn: createBusinessUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            setBuModalOpen(false);
        },
    });

    const updateBuMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<any> }) => updateBusinessUnit(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            setBuModalOpen(false);
        },
    });

    const deleteBuMutation = useMutation({
        mutationFn: deleteBusinessUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            setDeleteConfirm(null);
            setDeleteError(null);
        },
        onError: (error: any) => {
            setDeleteError(error.response?.data?.detail || 'Failed to delete Business Unit');
        }
    });

    // --- Product Line Mutations ---
    const createPlMutation = useMutation({
        mutationFn: createProductLine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['productLines'] }); // for lists
            setPlModalOpen(false);
        },
    });

    const updatePlMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ProductLine> }) => updateProductLine(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['productLines'] });
            setPlModalOpen(false);
        },
    });

    const deletePlMutation = useMutation({
        mutationFn: deleteProductLine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['productLines'] });
            setDeleteConfirm(null);
        },
    });

    // --- Project Mutations (Delete only, Create/Update handled by ProjectForm) ---
    const deleteProjectMutation = useMutation({
        mutationFn: apiDeleteProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setDeleteConfirm(null);
        },
    });

    // --- Handlers ---

    // Product Line
    const handleAddProductLine = (buId: string) => {
        setPlFormData({
            name: '',
            code: '',
            business_unit_id: buId,
            line_category: 'PRODUCT',
            description: '',
        });
        setPlModalOpen(true);
    };

    const handleEditProductLine = (pl: any) => {
        setPlFormData({
            id: pl.id,
            name: pl.name,
            code: pl.code,
            business_unit_id: '', // Will be ignored in update if not relevant? Actually we should probably keep it. But backend update might not need it?
            // Actually our hierarchy doesn't easy give us the parent BU ID inside the node unless we traverse.
            // But we can just not update BU ID.
            line_category: pl.line_category || 'PRODUCT', // Assuming node has this
            description: pl.description || '',
        });
        setPlModalOpen(true);
    };

    const handleSaveProductLine = () => {
        // Generate code from name if not provided (similar to Business Unit logic)
        const code = plFormData.code || plFormData.name.toUpperCase().replace(/\s+/g, '_').slice(0, 10);
        if (plFormData.id) {
            updatePlMutation.mutate({
                id: plFormData.id,
                data: {
                    name: plFormData.name,
                    code: code,
                    line_category: plFormData.line_category,
                    description: plFormData.description
                }
            });
        } else {
            createPlMutation.mutate({
                name: plFormData.name,
                code: code,
                business_unit_id: plFormData.business_unit_id,
                line_category: plFormData.line_category,
                description: plFormData.description
            });
        }
    };

    // Project
    const handleAddProject = (parentId: string, type: 'product_line' | 'department') => {
        console.log('Adding project', parentId, type);
        setEditingProject(undefined);
        if (type === 'product_line') {
            setProjectInitialValues({ product_line_id: parentId, category: 'PRODUCT' });
        } else {
            setProjectInitialValues({ owner_department_id: parentId, category: 'FUNCTIONAL' });
        }
        setProjectModalOpen(true);
    };

    const handleEditProject = (projectNode: any) => {
        // Let's navigate to Project Details for full edit, or make a Quick Edit here.
        // User asked for "Edit Business Area and Family". 
        // "Project details" editing is existing functionality.
        // Let's assume we want full edit.
        // I will navigate to `/projects/:id` for editing project details to simple things.
        // But wait, the user wants "Hierarchical editing".
        // Let's implement Delete here.
        // And Add.
        // For Edit, I'll redirect to detail page or open a modal that fetches the project.
        navigate(`/projects/${projectNode.id}`);
        // Or if I really want a modal, I should fetch the project first.
    };

    const handleDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'business_unit') {
            deleteBuMutation.mutate(deleteConfirm.id);
        } else if (deleteConfirm.type === 'product_line') {
            deletePlMutation.mutate(deleteConfirm.id);
        } else if (deleteConfirm.type === 'project') {
            deleteProjectMutation.mutate(deleteConfirm.id);
        }
    };

    // --- Business Unit Handlers ---
    const handleAddBusinessUnit = () => {
        setBuFormData({ name: '', code: '', is_active: true });
        setBuModalOpen(true);
    };

    const handleEditBusinessUnit = (bu: any) => {
        setBuFormData({ id: bu.id, name: bu.name, code: bu.code, is_active: true });
        setBuModalOpen(true);
    };

    const handleSaveBusinessUnit = () => {
        const code = buFormData.code || buFormData.name.toUpperCase().replace(/\s+/g, '_').slice(0, 5);
        if (buFormData.id) {
            updateBuMutation.mutate({ id: buFormData.id, data: { name: buFormData.name, code } });
        } else {
            createBuMutation.mutate({ name: buFormData.name, code, is_active: true });
        }
    };

    if (isLoading) return <div>Loading hierarchy...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Projects</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAddBusinessUnit}>
                        + New Business Unit
                    </Button>
                    <Button onClick={() => handleAddProject('', 'product_line')}>
                        + New Project
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="product">Product Projects</TabsTrigger>
                    <TabsTrigger value="functional">Functional Projects</TabsTrigger>
                </TabsList>

                <TabsContent value="product" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Hierarchy (Business Unit &gt; Product Line &gt; Project)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {productProjects.map((bu: any) => (
                                    <div key={bu.id} className="border rounded-lg overflow-hidden">
                                        {/* Business Unit Row */}
                                        <div className="flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                                onClick={() => toggleExpand(bu.id)}
                                            >
                                                <span className="text-lg">{expandedIds.has(bu.id) ? '📂' : '📁'}</span>
                                                <span className="font-semibold">{bu.name}</span>
                                                <span className="text-xs text-muted-foreground">({bu.code})</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-green-600"
                                                    onClick={(e) => { e.stopPropagation(); handleAddProductLine(bu.id); }}
                                                    title="Add Product Line"
                                                >
                                                    ➕ PL
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-blue-600"
                                                    onClick={(e) => { e.stopPropagation(); handleEditBusinessUnit(bu); }}
                                                    title="Edit Business Unit"
                                                >
                                                    ✏️
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-red-600"
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'business_unit', id: bu.id, name: bu.name }); }}
                                                    title="Delete Business Unit"
                                                >
                                                    🗑️
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Product Lines */}
                                        {expandedIds.has(bu.id) && (
                                            <div className="pl-6 py-2 space-y-2 bg-white">
                                                {bu.children?.map((pl: any) => (
                                                    <div key={pl.id} className="border-l-2 border-slate-200 pl-4">
                                                        <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                                                            <div
                                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                                                onClick={() => toggleExpand(pl.id)}
                                                            >
                                                                <span>{expandedIds.has(pl.id) ? 'vq' : '▶'}</span>
                                                                <span className="font-medium">{pl.name}</span>
                                                                <span className="text-xs text-muted-foreground">({pl.code})</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                                                    {pl.line_category || 'PRODUCT'}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="ghost" size="sm" className="h-7 w-7 text-green-600"
                                                                    onClick={(e) => { e.stopPropagation(); handleAddProject(pl.id, 'product_line'); }}
                                                                    title="Add Project"
                                                                >
                                                                    ➕
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" size="sm" className="h-7 w-7 text-blue-600"
                                                                    onClick={(e) => { e.stopPropagation(); handleEditProductLine(pl); }}
                                                                    title="Edit Product Line"
                                                                >
                                                                    ✏️
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" size="sm" className="h-7 w-7 text-red-600"
                                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'product_line', id: pl.id, name: pl.name }); }}
                                                                    title="Delete Product Line"
                                                                >
                                                                    🗑️
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Projects */}
                                                        {expandedIds.has(pl.id) && (
                                                            <div className="ml-4 mt-1 space-y-1">
                                                                {pl.children?.map((proj: any) => (
                                                                    <div key={proj.id} className="flex items-center justify-between p-1.5 text-sm hover:bg-slate-50 border border-slate-100 rounded">
                                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`)}>
                                                                            <span>🔹</span>
                                                                            <span>{proj.name}</span>
                                                                            <span className="text-xs text-muted-foreground">{proj.code}</span>
                                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${proj.status === 'InProgress' ? 'bg-green-100 text-green-700' :
                                                                                proj.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
                                                                                    'bg-yellow-100 text-yellow-700'
                                                                                }`}>
                                                                                {proj.status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                variant="ghost" size="sm" className="h-6 w-6 text-blue-600"
                                                                                onClick={() => navigate(`/projects/${proj.id}`)}
                                                                                title="View/Edit Project"
                                                                            >
                                                                                ✏️
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost" size="sm" className="h-6 w-6 text-red-600"
                                                                                onClick={() => setDeleteConfirm({ type: 'project', id: proj.id, name: proj.name })}
                                                                                title="Delete Project"
                                                                            >
                                                                                🗑️
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!pl.children || pl.children.length === 0) && (
                                                                    <div className="text-xs text-muted-foreground italic pl-6">No projects</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!bu.children || bu.children.length === 0) && (
                                                    <div className="text-xs text-muted-foreground italic pl-4">No product lines</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="functional" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Functional Projects (Department &gt; Project)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {functionalProjects.map((dept: any) => (
                                    <div key={dept.id} className="border rounded-lg overflow-hidden">
                                        {/* Department Row */}
                                        <div className="flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                                onClick={() => toggleExpand(dept.id)}
                                            >
                                                <span className="text-lg">{expandedIds.has(dept.id) ? '📂' : '📁'}</span>
                                                <span className="font-semibold">{dept.name}</span>
                                                <span className="text-xs text-muted-foreground">({dept.type})</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost" size="sm" className="h-8 w-8 text-green-600"
                                                    onClick={(e) => { e.stopPropagation(); handleAddProject(dept.id, 'department'); }}
                                                    title="Add Functional Project"
                                                >
                                                    ➕
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Projects */}
                                        {expandedIds.has(dept.id) && (
                                            <div className="pl-6 py-2 bg-white space-y-1">
                                                {dept.children?.map((proj: any) => (
                                                    <div key={proj.id} className="flex items-center justify-between p-1.5 text-sm hover:bg-slate-50 border border-slate-100 rounded">
                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`)}>
                                                            <span>🔹</span>
                                                            <span>{proj.name}</span>
                                                            <span className="text-xs text-muted-foreground">{proj.code}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${proj.status === 'InProgress' ? 'bg-green-100 text-green-700' :
                                                                proj.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
                                                                    'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {proj.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost" size="sm" className="h-6 w-6 text-blue-600"
                                                                onClick={() => navigate(`/projects/${proj.id}`)}
                                                            >
                                                                ✏️
                                                            </Button>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-6 w-6 text-red-600"
                                                                onClick={() => setDeleteConfirm({ type: 'project', id: proj.id, name: proj.name })}
                                                            >
                                                                🗑️
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!dept.children || dept.children.length === 0) && (
                                                    <div className="text-xs text-muted-foreground italic">No projects</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Business Unit Modal */}
            <Dialog open={buModalOpen} onOpenChange={setBuModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{buFormData.id ? 'Edit Business Unit' : 'Add Business Unit'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bu-name" className="text-right">Name</Label>
                            <Input
                                id="bu-name"
                                value={buFormData.name}
                                onChange={(e) => setBuFormData({ ...buFormData, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bu-code" className="text-right">Code</Label>
                            <Input
                                id="bu-code"
                                value={buFormData.code}
                                onChange={(e) => setBuFormData({ ...buFormData, code: e.target.value })}
                                className="col-span-3"
                                placeholder="Auto-generated if empty"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBuModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBusinessUnit} disabled={!buFormData.name}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Product Line Modal */}
            <Dialog open={plModalOpen} onOpenChange={setPlModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{plFormData.id ? 'Edit Product Line' : 'Add Product Line'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-name" className="text-right">Name</Label>
                            <Input
                                id="pl-name"
                                value={plFormData.name}
                                onChange={(e) => setPlFormData({ ...plFormData, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-category" className="text-right">Category</Label>
                            <Select
                                value={plFormData.line_category}
                                onValueChange={(v: any) => setPlFormData({ ...plFormData, line_category: v })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRODUCT">PRODUCT</SelectItem>
                                    <SelectItem value="PLATFORM">PLATFORM</SelectItem>
                                    <SelectItem value="LEGACY">LEGACY</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-desc" className="text-right">Description</Label>
                            <Input
                                id="pl-desc"
                                value={plFormData.description}
                                onChange={(e) => setPlFormData({ ...plFormData, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPlModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveProductLine} disabled={!plFormData.name}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Project Modal */}
            <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProject ? 'Edit Project' : 'Add New Project'}
                        </DialogTitle>
                    </DialogHeader>
                    <ProjectForm
                        project={editingProject}
                        initialValues={projectInitialValues}
                        onSuccess={() => {
                            setProjectModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['project-hierarchy'] });
                        }}
                        onCancel={() => setProjectModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setDeleteError(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {deleteConfirm?.type === 'business_unit' ? 'Business Unit' : deleteConfirm?.type === 'product_line' ? 'Product Line' : 'Project'} "{deleteConfirm?.name}"?
                            {deleteConfirm?.type === 'product_line' && ' This looks like it might have child projects. Ensure it is empty first or they may become orphaned.'}
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            ⚠️ {deleteError}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProjectHierarchyEditor;
