/**
 * ProjectHierarchySelect Component
 * Hierarchical selector for projects and product lines in WorkLog entry
 * Supports 3 modes:
 * 1. Project selection (specific project)
 * 2. Product line selection (general product support)
 * 3. No selection (non-project work)
 */
import React, { useState, useMemo } from 'react';
import { useProjectHierarchy, useProductLineHierarchy, HierarchyNode } from '@/hooks/useProjectHierarchy';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight, Folder, Package, Briefcase, Building2 } from 'lucide-react';

export type SelectionMode = 'project' | 'product_line' | 'none';

interface ProjectHierarchySelectProps {
    projectId?: string | null;
    productLineId?: string | null;
    onProjectChange: (projectId: string | null, projectName?: string) => void;
    onProductLineChange: (productLineId: string | null, productLineName?: string) => void;
    projectRequired?: boolean;
    placeholder?: string;
    className?: string;
}

export function ProjectHierarchySelect({
    projectId,
    productLineId,
    onProjectChange,
    onProductLineChange,
    projectRequired = true,
    placeholder = '프로젝트/제품군 선택...',
    className = '',
}: ProjectHierarchySelectProps) {
    const { user } = useAuth();
    const { data: projectHierarchy, isLoading: isLoadingProjects } = useProjectHierarchy(
        user?.department_id ? String(user.department_id) : undefined
    );
    const { data: productLineHierarchy, isLoading: isLoadingProductLines } = useProductLineHierarchy();


    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState<SelectionMode>(
        projectId ? 'project' : productLineId ? 'product_line' : 'none'
    );

    // Find selected item name
    const selectedName = useMemo(() => {
        if (projectId && projectHierarchy) {
            // Search in product projects
            for (const bu of projectHierarchy.product_projects) {
                for (const pl of bu.children || []) {
                    for (const proj of pl.children || []) {
                        if (proj.id === projectId) {
                            return `${proj.code} - ${proj.name}`;
                        }
                    }
                }
            }
            // Search in functional projects
            for (const dept of projectHierarchy.functional_projects) {
                for (const proj of dept.children || []) {
                    if (proj.id === projectId) {
                        return `${proj.code} - ${proj.name}`;
                    }
                }
            }
        }
        if (productLineId && productLineHierarchy) {
            for (const bu of productLineHierarchy) {
                for (const pl of bu.children || []) {
                    if (pl.id === productLineId) {
                        return `[제품군] ${pl.name}`;
                    }
                }
            }
        }
        return null;
    }, [projectId, productLineId, projectHierarchy, productLineHierarchy]);

    const toggleNode = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const handleSelectProject = (project: HierarchyNode) => {
        onProjectChange(project.id, `${project.code} - ${project.name}`);
        onProductLineChange(null);
        setSelectionMode('project');
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSelectProductLine = (productLine: HierarchyNode) => {
        onProductLineChange(productLine.id, productLine.name);
        onProjectChange(null);
        setSelectionMode('product_line');
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSelectNone = () => {
        onProjectChange(null);
        onProductLineChange(null);
        setSelectionMode('none');
        setIsOpen(false);
        setSearchTerm('');
    };

    // Filter nodes based on search term
    const filterNodes = (nodes: HierarchyNode[], term: string): HierarchyNode[] => {
        if (!term) return nodes;
        const lowerTerm = term.toLowerCase();

        const result: HierarchyNode[] = [];

        for (const node of nodes) {
            const matches =
                node.name.toLowerCase().includes(lowerTerm) ||
                node.code.toLowerCase().includes(lowerTerm);

            const filteredChildren = node.children ? filterNodes(node.children, term) : [];

            if (matches || filteredChildren.length > 0) {
                result.push({
                    ...node,
                    children: filteredChildren.length > 0 ? filteredChildren : node.children
                });
            }
        }

        return result;
    };


    const filteredProductProjects = useMemo(() => {
        if (!projectHierarchy) return [];
        return filterNodes(projectHierarchy.product_projects, searchTerm);
    }, [projectHierarchy, searchTerm]);

    const filteredFunctionalProjects = useMemo(() => {
        if (!projectHierarchy) return [];
        return filterNodes(projectHierarchy.functional_projects, searchTerm);
    }, [projectHierarchy, searchTerm]);

    const filteredProductLines = useMemo(() => {
        if (!productLineHierarchy) return [];
        return filterNodes(productLineHierarchy, searchTerm);
    }, [productLineHierarchy, searchTerm]);

    const isLoading = isLoadingProjects || isLoadingProductLines;

    if (isLoading) {
        return (
            <div className={`p-2 border rounded-md bg-background text-muted-foreground ${className}`}>
                로딩 중...
            </div>
        );
    }

    const renderProjectNode = (node: HierarchyNode, depth: number = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        const paddingLeft = depth * 16 + 8;

        if (node.type === 'project') {
            return (
                <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectProject(node)}
                    className={`w-full flex items-center gap-2 py-2 text-sm hover:bg-blue-50 text-left ${projectId === node.id ? 'bg-blue-100 text-blue-700' : ''
                        }`}
                    style={{ paddingLeft }}
                >
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500 font-mono text-xs">{node.code}</span>
                    <span className="truncate">{node.name}</span>
                </button>
            );
        }

        return (
            <div key={node.id}>
                <button
                    type="button"
                    onClick={(e) => toggleNode(node.id, e)}
                    className="w-full flex items-center gap-2 py-2 text-sm font-medium bg-slate-50 hover:bg-slate-100 text-left"
                    style={{ paddingLeft }}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="h-4 w-4 text-slate-500" />
                            : <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    {node.type === 'business_unit' && <Building2 className="h-4 w-4 text-blue-500" />}
                    {node.type === 'product_line' && <Package className="h-4 w-4 text-green-500" />}
                    {node.type === 'department' && <Folder className="h-4 w-4 text-orange-500" />}
                    <span>{node.name}</span>
                </button>
                {isExpanded && hasChildren && (
                    <div>
                        {node.children!.map(child => renderProjectNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const renderProductLineNode = (node: HierarchyNode, depth: number = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(node.id);
        const paddingLeft = depth * 16 + 8;

        if (node.type === 'product_line') {
            return (
                <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectProductLine(node)}
                    className={`w-full flex items-center gap-2 py-2 text-sm hover:bg-green-50 text-left ${productLineId === node.id ? 'bg-green-100 text-green-700' : ''
                        }`}
                    style={{ paddingLeft }}
                >
                    <Package className="h-4 w-4 text-green-500" />
                    <span className="truncate">{node.name}</span>
                    {node.line_category && node.line_category !== 'PRODUCT' && (
                        <span className="text-xs text-slate-400">({node.line_category})</span>
                    )}
                </button>
            );
        }

        return (
            <div key={node.id}>
                <button
                    type="button"
                    onClick={(e) => toggleNode(node.id, e)}
                    className="w-full flex items-center gap-2 py-2 text-sm font-medium bg-slate-50 hover:bg-slate-100 text-left"
                    style={{ paddingLeft }}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="h-4 w-4 text-slate-500" />
                            : <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span>{node.name}</span>
                </button>
                {isExpanded && hasChildren && (
                    <div>
                        {node.children!.map(child => renderProductLineNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 border rounded-md bg-background hover:bg-slate-50 text-left"
            >
                <span className={selectedName ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedName || placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                            setIsOpen(false);
                            setSearchTerm('');
                        }}
                    />

                    {/* Menu */}
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[400px] overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b bg-white sticky top-0">
                            <input
                                type="text"
                                placeholder="프로젝트/제품군 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 text-sm border rounded bg-white"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[340px] overflow-y-auto">
                            {/* Product Projects Section */}
                            {filteredProductProjects.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100">
                                        제품 프로젝트
                                    </div>
                                    {filteredProductProjects.map(node => renderProjectNode(node))}
                                </div>
                            )}

                            {/* Functional Projects Section */}
                            {filteredFunctionalProjects.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100">
                                        기능 프로젝트 (내 팀)
                                    </div>
                                    {filteredFunctionalProjects.map(node => renderProjectNode(node))}
                                </div>
                            )}

                            {/* Product Line Support Section */}
                            {filteredProductLines.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-green-50">
                                        제품군 일반 지원 (프로젝트 없음)
                                    </div>
                                    {filteredProductLines.map(node => renderProductLineNode(node))}
                                </div>
                            )}

                            {/* No Selection Option */}
                            {!projectRequired && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={handleSelectNone}
                                        className={`w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-slate-50 text-left ${selectionMode === 'none' ? 'bg-slate-100' : ''
                                            }`}
                                    >
                                        <span className="text-slate-500">해당 없음 (비프로젝트 업무)</span>
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {filteredProductProjects.length === 0 &&
                                filteredFunctionalProjects.length === 0 &&
                                filteredProductLines.length === 0 && (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                        검색 결과가 없습니다.
                                    </div>
                                )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default ProjectHierarchySelect;
