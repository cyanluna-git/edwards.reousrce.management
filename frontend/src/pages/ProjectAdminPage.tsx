/**
 * Project Admin Page
 * Manage ProductLine and Project mappings
 */
import { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Edit2, Search, Save } from 'lucide-react';
import type { Project, ProductLine, BusinessUnit } from '@/types';

// Extended types for admin
interface ProductLineWithBU extends ProductLine {
    business_unit?: BusinessUnit;
}

// Fetch functions
async function fetchProjects(): Promise<Project[]> {
    const { data } = await apiClient.get('/projects');
    return data;
}

async function fetchProductLines(): Promise<ProductLineWithBU[]> {
    const { data } = await apiClient.get('/projects/meta/product-lines');
    return data;
}

async function fetchBusinessUnits(): Promise<BusinessUnit[]> {
    const { data } = await apiClient.get('/departments/business-units');
    return data;
}

async function updateProject(
    id: string,
    update: { product_line_id?: string; category?: string }
): Promise<Project> {
    const { data } = await apiClient.put(`/projects/${id}`, update);
    return data;
}

export function ProjectAdminPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProductLine, setFilterProductLine] = useState<string>('');
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editForm, setEditForm] = useState<{
        product_line_id: string;
        category: string;
    }>({ product_line_id: '', category: 'PRODUCT' });

    // Queries
    const { data: projects = [], isLoading: loadingProjects } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
    });

    const { data: productLines = [] } = useQuery({
        queryKey: ['product-lines'],
        queryFn: fetchProductLines,
    });

    const { data: businessUnits = [] } = useQuery({
        queryKey: ['business-units'],
        queryFn: fetchBusinessUnits,
    });

    // Mutation
    const updateMutation = useMutation({
        mutationFn: ({
            id,
            update,
        }: {
            id: string;
            update: { product_line_id?: string; category?: string };
        }) => updateProject(id, update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setEditingProject(null);
        },
    });

    // Filter projects
    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            const matchesSearch =
                !searchTerm ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesProductLine =
                !filterProductLine || p.product_line_id === filterProductLine;
            return matchesSearch && matchesProductLine;
        });
    }, [projects, searchTerm, filterProductLine]);

    // Stats
    const stats = useMemo(() => {
        const byProductLine: Record<string, number> = {};
        const byCategory: Record<string, number> = {};

        projects.forEach((p) => {
            const plName = p.product_line?.name || 'Unassigned';
            byProductLine[plName] = (byProductLine[plName] || 0) + 1;
            byCategory[p.category || 'Unknown'] = (byCategory[p.category || 'Unknown'] || 0) + 1;
        });

        return { byProductLine, byCategory };
    }, [projects]);

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setEditForm({
            product_line_id: project.product_line_id || '',
            category: project.category || 'PRODUCT',
        });
    };

    const handleSave = () => {
        if (editingProject) {
            updateMutation.mutate({
                id: editingProject.id,
                update: editForm,
            });
        }
    };

    if (loadingProjects) {
        return <div className="p-8 text-center">Loading projects...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">프로젝트 관리 (Project Admin)</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{projects.length}</div>
                    <div className="text-sm text-blue-600">총 프로젝트</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                        {stats.byCategory['PRODUCT'] || 0}
                    </div>
                    <div className="text-sm text-green-600">Product Projects</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">
                        {stats.byCategory['FUNCTIONAL'] || 0}
                    </div>
                    <div className="text-sm text-orange-600">Functional Projects</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">{productLines.length}</div>
                    <div className="text-sm text-purple-600">Product Lines</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="프로젝트 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <select
                    className="border rounded-md px-3 py-2 bg-background"
                    value={filterProductLine}
                    onChange={(e) => setFilterProductLine(e.target.value)}
                >
                    <option value="">모든 Product Line</option>
                    {productLines.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                            {pl.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Projects Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[150px]">Product Line</TableHead>
                            <TableHead className="w-[120px]">Category</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProjects.map((project) => (
                            <TableRow key={project.id}>
                                <TableCell className="font-mono text-sm">{project.code}</TableCell>
                                <TableCell className="max-w-[300px] truncate" title={project.name}>
                                    {project.name}
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={`px-2 py-1 rounded text-xs ${project.product_line_id
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}
                                    >
                                        {project.product_line?.name || 'Unassigned'}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={`px-2 py-1 rounded text-xs ${project.category === 'PRODUCT'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}
                                    >
                                        {project.category || 'Unknown'}
                                    </span>
                                </TableCell>
                                <TableCell>{project.status}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(project)}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
                Showing {filteredProjects.length} of {projects.length} projects
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>프로젝트 편집</DialogTitle>
                    </DialogHeader>

                    {editingProject && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">Project</Label>
                                <div className="font-medium">
                                    {editingProject.code} - {editingProject.name}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Product Line</Label>
                                <select
                                    className="w-full border rounded-md px-3 py-2 bg-background"
                                    value={editForm.product_line_id}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, product_line_id: e.target.value })
                                    }
                                >
                                    <option value="">선택...</option>
                                    {businessUnits.map((bu) => (
                                        <optgroup key={bu.id} label={bu.name}>
                                            {productLines
                                                .filter((pl) => pl.business_unit_id === bu.id)
                                                .map((pl) => (
                                                    <option key={pl.id} value={pl.id}>
                                                        {pl.name}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Category</Label>
                                <select
                                    className="w-full border rounded-md px-3 py-2 bg-background"
                                    value={editForm.category}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, category: e.target.value })
                                    }
                                >
                                    <option value="PRODUCT">PRODUCT (제품 프로젝트)</option>
                                    <option value="FUNCTIONAL">FUNCTIONAL (기능 프로젝트)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProject(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ProjectAdminPage;
