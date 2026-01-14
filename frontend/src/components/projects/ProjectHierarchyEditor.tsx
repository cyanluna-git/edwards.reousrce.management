/**
 * ProjectHierarchyEditor - Hierarchical management of projects
 * Level 0 (Business Unit) > Level 1 (Product Line) > Level 2 (Project)
 */
import React, { useState, useMemo } from 'react';
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
    getProjects,
} from '@/api/client';
import type { ProductLine, Project } from '@/types';
import { useProjectHierarchy } from '@/hooks/useProjectHierarchy';
import ProjectForm from '@/components/forms/ProjectForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

type HierarchyLevel = 'business_unit' | 'product_line' | 'project';

// Status priority order: InProgress first, then Prospective, then others
const STATUS_PRIORITY: Record<string, number> = {
    'InProgress': 1,
    'Prospective': 2,
    'Planned': 3,
    'OnHold': 4,
    'Completed': 5,
    'Cancelled': 6,
};

// Sort projects by status priority
const sortProjectsByStatus = (projects: any[]): any[] => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] || 99;
        const priorityB = STATUS_PRIORITY[b.status] || 99;
        return priorityA - priorityB;
    });
};

export const ProjectHierarchyEditor: React.FC = () => {

    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const { canManageProjects } = usePermissions();
    const { data: hierarchy, isLoading } = useProjectHierarchy();
    const productProjects = hierarchy?.product_projects || [];
    const functionalProjects = hierarchy?.functional_projects || [];
    const ungroupedProjects = hierarchy?.ungrouped_projects || [];

    // Fetch Business Units for Product Line modal
    const { data: businessUnits = [] } = useQuery({
        queryKey: ['businessUnits'],
        queryFn: getBusinessUnits,
    });

    // Fetch all projects for management tab
    const { data: allProjects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => getProjects(),
    });

    // State
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const returnTab = (location.state as any)?.activeTab;
    const [activeTab, setActiveTab] = useState(returnTab || 'product');

    // Sorting state for All Projects table
    const [sortColumn, setSortColumn] = useState<string>('code');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Handle column header click for sorting
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Sort projects based on current sort state
    const sortedProjects = useMemo(() => {
        const sorted = [...allProjects].sort((a, b) => {
            let aVal: string | undefined;
            let bVal: string | undefined;

            switch (sortColumn) {
                case 'code':
                    aVal = a.code || '';
                    bVal = b.code || '';
                    break;
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    break;
                case 'category':
                    aVal = a.category || 'PRODUCT';
                    bVal = b.category || 'PRODUCT';
                    break;
                case 'business_unit':
                    aVal = a.product_line?.business_unit?.name || '';
                    bVal = b.product_line?.business_unit?.name || '';
                    break;
                case 'family':
                    aVal = a.product_line?.name || '';
                    bVal = b.product_line?.name || '';
                    break;
                case 'status':
                    aVal = a.status || '';
                    bVal = b.status || '';
                    break;
                default:
                    return 0;
            }

            const comparison = aVal.localeCompare(bVal);
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [allProjects, sortColumn, sortDirection]);

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

    const handleEditProductLine = (pl: any, parentBuId: string) => {
        setPlFormData({
            id: pl.id,
            name: pl.name,
            code: pl.code,
            business_unit_id: parentBuId,
            line_category: pl.line_category || 'PRODUCT',
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
                    business_unit_id: plFormData.business_unit_id, // Allow changing parent BU
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
                {canManageProjects && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleAddBusinessUnit}>
                            + New Business Unit
                        </Button>
                        <Button onClick={() => handleAddProject('', 'product_line')}>
                            + New Project
                        </Button>
                    </div>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="product">Product Projects</TabsTrigger>
                    <TabsTrigger value="functional">Functional Projects</TabsTrigger>
                    <TabsTrigger value="all">All Projects</TabsTrigger>
                </TabsList>

                <TabsContent value="product" className="mt-4">
                    {/* Ungrouped Projects Section */}
                    {ungroupedProjects.length > 0 && (
                        <Card className="mb-4 border-amber-200 bg-amber-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-amber-800 flex items-center gap-2">
                                    <span>Ungrouped Projects</span>
                                    <span className="text-sm font-normal text-amber-600">({ungroupedProjects.length} projects without Product Line)</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {sortProjectsByStatus(ungroupedProjects).map((proj: any) => (
                                        <div key={proj.id} className="flex items-center justify-between p-2 text-sm hover:bg-amber-100 border border-amber-200 rounded">
                                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'product' } })}>
                                                <span>⚠️</span>
                                                <span>{proj.name}</span>
                                                <span className="text-xs text-muted-foreground">{proj.code}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                    proj.status === 'InProgress' ? 'bg-green-100 text-green-700' :
                                                    proj.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {proj.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost" size="sm" className="h-6 w-6 text-blue-600"
                                                    onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'product' } })}
                                                    title="Edit to assign Product Line"
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
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                            {canManageProjects && (
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
                                            )}
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
                                                                <span>{expandedIds.has(pl.id) ? '▼' : '▶'}</span>
                                                                <span className="font-medium">{pl.name}</span>
                                                                <span className="text-xs text-muted-foreground">({pl.code})</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                                                    {pl.line_category || 'PRODUCT'}
                                                                </span>
                                                            </div>
                                                            {canManageProjects && (
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
                                                                        onClick={(e) => { e.stopPropagation(); handleEditProductLine(pl, bu.id); }}
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
                                                            )}
                                                        </div>

                                                        {/* Projects - sorted by status priority */}
                                                        {expandedIds.has(pl.id) && (
                                                            <div className="ml-4 mt-1 space-y-1">
                                                                {sortProjectsByStatus(pl.children).map((proj: any) => (
                                                                    <div key={proj.id} className="flex items-center justify-between p-1.5 text-sm hover:bg-slate-50 border border-slate-100 rounded">
                                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'product' } })}>
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
                                                                        {canManageProjects && (
                                                                            <div className="flex gap-1">
                                                                                <Button
                                                                                    variant="ghost" size="sm" className="h-6 w-6 text-blue-600"
                                                                                    onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'product' } })}
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
                                                                        )}
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

                                        {/* Projects - sorted by status priority */}
                                        {expandedIds.has(dept.id) && (
                                            <div className="pl-6 py-2 bg-white space-y-1">
                                                {sortProjectsByStatus(dept.children).map((proj: any) => (
                                                    <div key={proj.id} className="flex items-center justify-between p-1.5 text-sm hover:bg-slate-50 border border-slate-100 rounded">
                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'functional' } })}>
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
                                                                onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'functional' } })}
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

                <TabsContent value="all" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>All Projects ({allProjects.length} total)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50">
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('code')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Code
                                                    {sortColumn === 'code' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('name')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Name
                                                    {sortColumn === 'name' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('category')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Category
                                                    {sortColumn === 'category' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('business_unit')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Business Unit
                                                    {sortColumn === 'business_unit' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('family')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Family
                                                    {sortColumn === 'family' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th
                                                className="text-left p-2 font-medium cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('status')}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Status
                                                    {sortColumn === 'status' && (
                                                        <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                                    )}
                                                </span>
                                            </th>
                                            <th className="text-left p-2 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedProjects.map((proj: Project) => (
                                            <tr key={proj.id} className="border-b hover:bg-slate-50">
                                                <td className="p-2 font-mono text-xs">{proj.code}</td>
                                                <td className="p-2">
                                                    <span
                                                        className="cursor-pointer hover:text-blue-600"
                                                        onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'all' } })}
                                                    >
                                                        {proj.name}
                                                    </span>
                                                </td>
                                                <td className="p-2">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                        proj.category === 'FUNCTIONAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {proj.category === 'FUNCTIONAL' ? 'Functional' : 'Product'}
                                                    </span>
                                                </td>
                                                <td className="p-2">
                                                    {proj.product_line?.business_unit ? (
                                                        <span className="text-xs">{proj.product_line.business_unit.name}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    {proj.product_line ? (
                                                        <span className="text-xs">{proj.product_line.name}</span>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 italic">Ungrouped</span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                        proj.status === 'InProgress' ? 'bg-green-100 text-green-700' :
                                                        proj.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
                                                        proj.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {proj.status}
                                                    </span>
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost" size="sm" className="h-6 w-6 text-blue-600"
                                                            onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'all' } })}
                                                            title="Edit Project"
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
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {allProjects.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">No projects found</div>
                                )}
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
                            <Label htmlFor="pl-bu" className="text-right">Business Unit</Label>
                            <Select
                                value={plFormData.business_unit_id}
                                onValueChange={(v) => setPlFormData({ ...plFormData, business_unit_id: v })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select Business Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {businessUnits.map((bu) => (
                                        <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
