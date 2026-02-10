/**
 * ProjectHierarchyEditor - Hierarchical management of projects
 * Level 0 (Business Unit) > Level 1 (Product Line) > Level 2 (Project)
 */
import React, { useState, useMemo, useEffect } from 'react';
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
    getProductLines,
    getDepartments,
} from '@/api/client';
import type { ProductLine, Project } from '@/types';
import { useApiError } from '@/hooks/useApiError';
import { useTranslation } from 'react-i18next';
import { useProjectHierarchy } from '@/hooks/useProjectHierarchy';
import { useUsers } from '@/hooks/useUsers';
import ProjectForm from '@/components/forms/ProjectForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ProjectInlineTable } from './ProjectInlineTable';
import { IOManagementTab } from './IOManagementTab';
import { useInternalIOsList } from '@/hooks/useInternalIOs';
import { useRechargeIOsList } from '@/hooks/useRechargeIOs';

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

// Active statuses for filtering
const ACTIVE_STATUSES = ['InProgress', 'Prospective'];

// Filter projects to only active ones
const filterActiveProjects = (projects: any[]): any[] => {
    if (!projects) return [];
    return projects.filter(p => ACTIVE_STATUSES.includes(p.status));
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
    const getErrorMessage = useApiError();
    const { t } = useTranslation('projects');
    const { data: hierarchy, isLoading } = useProjectHierarchy();
    const productProjects = hierarchy?.product_projects || [];
    const functionalProjects = hierarchy?.functional_projects || [];
    const ungroupedProjects = hierarchy?.ungrouped_projects || [];

    // Fetch Business Units for Product Line modal
    const { data: businessUnits = [] } = useQuery({
        queryKey: ['businessUnits'],
        queryFn: getBusinessUnits,
    });

    // Fetch all projects for management tab (increased limit to include matrix projects)
    const { data: allProjects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => getProjects({ limit: 500 }),
    });

    // Fetch product lines for inline table
    const { data: productLines = [] } = useQuery({
        queryKey: ['productLines'],
        queryFn: getProductLines,
    });

    // Fetch departments for owner department selection
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    // Fetch users for PM selection
    const { data: users = [] } = useUsers();

    // Fetch IO data for inline table dropdowns
    const { data: internalIOs = [] } = useInternalIOsList({ is_active: true });
    const { data: rechargeIOs = [] } = useRechargeIOsList({ is_active: true });

    // State
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const returnTab = (location.state as any)?.activeTab;
    const [activeTab, setActiveTab] = useState(returnTab || 'product');

    // Auto-expand all hierarchy items when data loads
    useEffect(() => {
        if (hierarchy) {
            const allIds = new Set<string>();

            // Collect all expandable IDs from product hierarchy (BU > PL)
            productProjects.forEach((bu: any) => {
                allIds.add(bu.id);
                bu.children?.forEach((pl: any) => {
                    allIds.add(pl.id);
                });
            });

            // Collect all expandable IDs from functional hierarchy (Department)
            functionalProjects.forEach((dept: any) => {
                allIds.add(dept.id);
            });

            setExpandedIds(allIds);
        }
    }, [hierarchy, productProjects, functionalProjects]);

    // Filter for Active Projects tab - only InProgress and Prospective
    const activeUngroupedProjects = useMemo(() => {
        return filterActiveProjects(ungroupedProjects);
    }, [ungroupedProjects]);

    const activeProductProjects = useMemo(() => {
        return productProjects.map((bu: any) => ({
            ...bu,
            children: bu.children?.map((pl: any) => ({
                ...pl,
                children: filterActiveProjects(pl.children || [])
            })).filter((pl: any) => pl.children && pl.children.length > 0) || []
        })).filter((bu: any) => bu.children && bu.children.length > 0);
    }, [productProjects]);

    // Sorting and filtering are now handled by ProjectInlineTable component

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
        onError: (error: unknown) => {
            setDeleteError(getErrorMessage(error));
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

    if (isLoading) return <div>{t('hierarchy.loadingHierarchy')}</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t('hierarchy.title')}</h2>
                {canManageProjects && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleAddBusinessUnit}>
                            {t('hierarchy.newBusinessUnit')}
                        </Button>
                        <Button onClick={() => handleAddProject('', 'product_line')}>
                            {t('hierarchy.newProject')}
                        </Button>
                    </div>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="product">{t('hierarchy.tabActive')}</TabsTrigger>
                    <TabsTrigger value="functional">{t('hierarchy.tabFunctional')}</TabsTrigger>
                    <TabsTrigger value="all">{t('hierarchy.tabAll')}</TabsTrigger>
                    <TabsTrigger value="io-management">{t('hierarchy.tabIO')}</TabsTrigger>
                </TabsList>

                <TabsContent value="product" className="mt-4">
                    {/* Ungrouped Projects Section - Only Active */}
                    {activeUngroupedProjects.length > 0 && (
                        <Card className="mb-4 border-amber-200 bg-amber-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-amber-800 flex items-center gap-2">
                                    <span>{t('hierarchy.ungroupedTitle')}</span>
                                    <span className="text-sm font-normal text-amber-600">{t('hierarchy.ungroupedDesc', { count: activeUngroupedProjects.length })}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {sortProjectsByStatus(activeUngroupedProjects).map((proj: any) => (
                                        <div key={proj.id} className="flex items-center justify-between p-2 text-sm hover:bg-amber-100 border border-amber-200 rounded">
                                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/projects/${proj.id}`, { state: { returnTab: 'product' } })}>
                                                <span>⚠️</span>
                                                <span>{proj.name}</span>
                                                <span className="text-xs text-muted-foreground">{proj.internal_io?.io_number || '-'}</span>
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
                                                    title={t('hierarchy.editToAssign')}
                                                >
                                                    ✏️
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm" className="h-6 w-6 text-red-600"
                                                    onClick={() => setDeleteConfirm({ type: 'project', id: proj.id, name: proj.name })}
                                                    title={t('hierarchy.deleteProject')}
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
                            <CardTitle>{t('hierarchy.productHierarchyTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {activeProductProjects.map((bu: any) => (
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
                                                        title={t('hierarchy.addProductLine')}
                                                    >
                                                        ➕ PL
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 text-blue-600"
                                                        onClick={(e) => { e.stopPropagation(); handleEditBusinessUnit(bu); }}
                                                        title={t('hierarchy.editBusinessUnit')}
                                                    >
                                                        ✏️
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 text-red-600"
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'business_unit', id: bu.id, name: bu.name }); }}
                                                        title={t('hierarchy.deleteBusinessUnit')}
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
                                                                        title={t('hierarchy.addProject')}
                                                                    >
                                                                        ➕
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost" size="sm" className="h-7 w-7 text-blue-600"
                                                                        onClick={(e) => { e.stopPropagation(); handleEditProductLine(pl, bu.id); }}
                                                                        title={t('hierarchy.editProductLine')}
                                                                    >
                                                                        ✏️
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost" size="sm" className="h-7 w-7 text-red-600"
                                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'product_line', id: pl.id, name: pl.name }); }}
                                                                        title={t('hierarchy.deleteProductLine')}
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
                                                                            <span className="text-xs text-muted-foreground">{proj.internal_io?.io_number || '-'}</span>
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
                                                                                    title={t('hierarchy.editProjectTitle')}
                                                                                >
                                                                                    ✏️
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost" size="sm" className="h-6 w-6 text-red-600"
                                                                                    onClick={() => setDeleteConfirm({ type: 'project', id: proj.id, name: proj.name })}
                                                                                    title={t('hierarchy.deleteProject')}
                                                                                >
                                                                                    🗑️
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {(!pl.children || pl.children.length === 0) && (
                                                                    <div className="text-xs text-muted-foreground italic pl-6">{t('hierarchy.noProjects')}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!bu.children || bu.children.length === 0) && (
                                                    <div className="text-xs text-muted-foreground italic pl-4">{t('hierarchy.noProductLines')}</div>
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
                            <CardTitle>{t('hierarchy.functionalTitle')}</CardTitle>
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
                                                    title={t('hierarchy.addProject')}
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
                                                            <span className="text-xs text-muted-foreground">{proj.internal_io?.io_number || '-'}</span>
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
                                                    <div className="text-xs text-muted-foreground italic">{t('hierarchy.noProjects')}</div>
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
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">{t('hierarchy.allProjectsCount', { count: allProjects.length })}</h2>
                    </div>
                    <ProjectInlineTable
                        projects={allProjects}
                        businessUnits={businessUnits}
                        productLines={productLines}
                        departments={departments}
                        users={users}
                        internalIOs={internalIOs}
                        rechargeIOs={rechargeIOs}
                        canManageProjects={canManageProjects}
                    />
                </TabsContent>

                {/* IO Management Tab */}
                <TabsContent value="io-management" className="mt-4">
                    <IOManagementTab />
                </TabsContent>
            </Tabs>

            {/* Business Unit Modal */}
            <Dialog open={buModalOpen} onOpenChange={setBuModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{buFormData.id ? t('hierarchy.editBU') : t('hierarchy.addBU')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bu-name" className="text-right">{t('common:form.name')}</Label>
                            <Input
                                id="bu-name"
                                value={buFormData.name}
                                onChange={(e) => setBuFormData({ ...buFormData, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bu-code" className="text-right">{t('common:form.code')}</Label>
                            <Input
                                id="bu-code"
                                value={buFormData.code}
                                onChange={(e) => setBuFormData({ ...buFormData, code: e.target.value })}
                                className="col-span-3"
                                placeholder={t('hierarchy.autoGenerated')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBuModalOpen(false)}>{t('common:buttons.cancel')}</Button>
                        <Button onClick={handleSaveBusinessUnit} disabled={!buFormData.name}>{t('common:buttons.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Product Line Modal */}
            <Dialog open={plModalOpen} onOpenChange={setPlModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{plFormData.id ? t('hierarchy.editPL') : t('hierarchy.addPL')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-name" className="text-right">{t('common:form.name')}</Label>
                            <Input
                                id="pl-name"
                                value={plFormData.name}
                                onChange={(e) => setPlFormData({ ...plFormData, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-bu" className="text-right">{t('detail.businessUnit')}</Label>
                            <Select
                                value={plFormData.business_unit_id}
                                onValueChange={(v) => setPlFormData({ ...plFormData, business_unit_id: v })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder={t('hierarchy.selectBusinessUnit')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {businessUnits.map((bu) => (
                                        <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-category" className="text-right">{t('hierarchy.lineCategory')}</Label>
                            <Select
                                value={plFormData.line_category}
                                onValueChange={(v: any) => setPlFormData({ ...plFormData, line_category: v })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder={t('hierarchy.lineCategory')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRODUCT">PRODUCT</SelectItem>
                                    <SelectItem value="PLATFORM">PLATFORM</SelectItem>
                                    <SelectItem value="LEGACY">LEGACY</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pl-desc" className="text-right">{t('common:form.description')}</Label>
                            <Input
                                id="pl-desc"
                                value={plFormData.description}
                                onChange={(e) => setPlFormData({ ...plFormData, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPlModalOpen(false)}>{t('common:buttons.cancel')}</Button>
                        <Button onClick={handleSaveProductLine} disabled={!plFormData.name}>{t('common:buttons.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Project Modal */}
            <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProject ? t('hierarchy.editProjectTitle') : t('hierarchy.addProjectTitle')}
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
                        <DialogTitle>{t('hierarchy.confirmDelete')}</DialogTitle>
                        <DialogDescription>
                            {t('hierarchy.confirmDeleteMessage', { type: deleteConfirm?.type === 'business_unit' ? t('hierarchy.typeBusinessUnit') : deleteConfirm?.type === 'product_line' ? t('hierarchy.typeProductLine') : t('hierarchy.typeProject'), name: deleteConfirm?.name })}
                            {deleteConfirm?.type === 'product_line' && ` ${t('hierarchy.confirmDeleteOrphanWarning')}`}
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            ⚠️ {deleteError}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>{t('common:buttons.cancel')}</Button>
                        <Button variant="destructive" onClick={handleDelete}>{t('common:buttons.delete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProjectHierarchyEditor;
