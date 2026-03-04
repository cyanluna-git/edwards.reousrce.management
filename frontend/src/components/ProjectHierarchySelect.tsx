/**
 * ProjectHierarchySelect Component
 * Hierarchical selector for projects and product lines in WorkLog entry
 * Supports 4 modes:
 * 1. Project selection (specific product project)
 * 2. Functional project selection (department-based projects)
 * 3. Support project selection (non-project regular work with auto-routing)
 * 4. No selection (general team work)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useProjectHierarchy, useProductLineHierarchy, HierarchyNode } from '@/hooks/useProjectHierarchy';
import { useAuth } from '@/hooks/useAuth';
import { useRechargeIOsByBusinessUnit } from '@/hooks/useRechargeIOs';
import { useFrequentSelections } from '@/hooks/useFrequentSelections';
import { ChevronDown, ChevronRight, Folder, Package, Briefcase, Building2, Wrench, Info, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type SelectionMode = 'project' | 'product_line' | 'support' | 'none';

interface ProjectHierarchySelectProps {
    projectId?: string | null;
    productLineId?: string | null;
    onProjectChange: (projectId: string | null, projectName?: string, category?: string) => void;
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
    placeholder,
    className = '',
}: ProjectHierarchySelectProps) {
    const { user } = useAuth();
    // Pass department_id (not sub_team_id) to filter functional projects by owner_department_id
    const userDepartmentId = user?.sub_team?.department_id;
    const { data: projectHierarchy, isLoading: isLoadingProjects } = useProjectHierarchy(
        userDepartmentId ? String(userDepartmentId) : undefined
    );
    const { data: productLineHierarchy, isLoading: isLoadingProductLines } = useProductLineHierarchy();

    // Fetch RechargeIOs by user's primary business unit for auto-routing
    const userPrimaryBuId = user?.primary_business_unit_id;
    const { data: buRechargeIOs } = useRechargeIOsByBusinessUnit(userPrimaryBuId);

    const { topItems } = useFrequentSelections('project', user?.id);

    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState<SelectionMode>(
        projectId ? 'project' : productLineId ? 'product_line' : 'none'
    );
    const { t } = useTranslation('common');

    // Collect all non-leaf node IDs for expand-all
    const allParentNodeIds = useMemo(() => {
        const ids: string[] = [];
        const collectIds = (nodes: HierarchyNode[]) => {
            for (const node of nodes) {
                if (node.children && node.children.length > 0) {
                    ids.push(node.id);
                    collectIds(node.children);
                }
            }
        };
        if (projectHierarchy) {
            collectIds(projectHierarchy.product_projects);
            collectIds(projectHierarchy.functional_projects);
        }
        if (productLineHierarchy) {
            collectIds(productLineHierarchy);
        }
        return ids;
    }, [projectHierarchy, productLineHierarchy]);

    // Expand all nodes when dropdown opens
    useEffect(() => {
        if (isOpen && allParentNodeIds.length > 0) {
            setExpandedNodes(new Set(allParentNodeIds));
        }
    }, [isOpen, allParentNodeIds]);

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
            // Search in support projects
            for (const proj of projectHierarchy.support_projects || []) {
                if (proj.id === projectId) {
                    return `${t('select.nonProject')} ${proj.name}`;
                }
            }
        }
        if (productLineId && productLineHierarchy) {
            for (const bu of productLineHierarchy) {
                for (const pl of bu.children || []) {
                    if (pl.id === productLineId) {
                        return `${t('select.productLine')} ${pl.name}`;
                    }
                }
            }
        }
        return null;
    }, [projectId, productLineId, projectHierarchy, productLineHierarchy]);

    // Build a lookup for valid project/product-line IDs with their display info
    const validItemLookup = useMemo(() => {
        const lookup = new Map<string, { type: 'project' | 'product_line' | 'support'; name: string; node: HierarchyNode; category?: string }>();
        if (projectHierarchy) {
            for (const bu of projectHierarchy.product_projects) {
                for (const pl of bu.children || []) {
                    for (const proj of pl.children || []) {
                        lookup.set(proj.id, { type: 'project', name: `${proj.code} - ${proj.name}`, node: proj });
                    }
                }
            }
            for (const dept of projectHierarchy.functional_projects) {
                for (const proj of dept.children || []) {
                    lookup.set(proj.id, { type: 'project', name: `${proj.code} - ${proj.name}`, node: proj });
                }
            }
            for (const proj of projectHierarchy.support_projects || []) {
                lookup.set(proj.id, { type: 'support', name: proj.name, node: proj, category: 'SUPPORT' });
            }
        }
        if (productLineHierarchy) {
            for (const bu of productLineHierarchy) {
                for (const pl of bu.children || []) {
                    lookup.set(pl.id, { type: 'product_line', name: pl.name, node: pl });
                }
            }
        }
        return lookup;
    }, [projectHierarchy, productLineHierarchy]);

    // Frequent items filtered to only those existing in current hierarchy
    const validFrequentItems = useMemo(() => {
        return topItems.filter(item => validItemLookup.has(item.id));
    }, [topItems, validItemLookup]);

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

    const handleSelectProject = (project: HierarchyNode, category?: string) => {
        const displayName = `${project.code} - ${project.name}`;
        onProjectChange(project.id, displayName, category);
        onProductLineChange(null);
        setSelectionMode(category === 'SUPPORT' ? 'support' : 'project');
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSelectSupportProject = (project: HierarchyNode) => {
        onProjectChange(project.id, project.name, 'SUPPORT');
        onProductLineChange(null);
        setSelectionMode('support');
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

    const handleFrequentClick = (id: string) => {
        const info = validItemLookup.get(id);
        if (!info) return;
        if (info.type === 'product_line') {
            handleSelectProductLine(info.node);
        } else if (info.type === 'support') {
            handleSelectSupportProject(info.node);
        } else {
            handleSelectProject(info.node);
        }
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
                (node.code || '').toLowerCase().includes(lowerTerm);

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

    const filteredSupportProjects = useMemo(() => {
        if (!projectHierarchy?.support_projects) return [];
        if (!searchTerm) return projectHierarchy.support_projects;
        const lowerTerm = searchTerm.toLowerCase();
        return projectHierarchy.support_projects.filter(
            p => p.name.toLowerCase().includes(lowerTerm) || (p.code || '').toLowerCase().includes(lowerTerm)
        );
    }, [projectHierarchy, searchTerm]);

    // Find matching RechargeIO for a Support project
    const findMatchingRechargeIO = (supportProjectName: string) => {
        if (!buRechargeIOs || buRechargeIOs.length === 0) return null;

        const normalizedName = supportProjectName.toLowerCase().trim();
        const words = normalizedName.split(' ');

        // Score each IO by how many significant words match, return highest score
        let bestMatch = null;
        let bestScore = 0;

        for (const io of buRechargeIOs) {
            const ioName = io.name?.toLowerCase() || '';
            if (ioName.includes(normalizedName)) return io; // exact match, return immediately

            const score = words.filter(word =>
                word.length <= 2 || ioName.includes(word)
            ).length;

            if (score === words.length && score > bestScore) {
                bestScore = score;
                bestMatch = io;
            }
        }

        return bestMatch;
    };

    const isLoading = isLoadingProjects || isLoadingProductLines;

    if (isLoading) {
        return (
            <div className={`p-2 border rounded-md bg-background text-muted-foreground ${className}`}>
                {t('select.loading')}
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
                    {selectedName || (placeholder || t('select.selectProject'))}
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
                                placeholder={t('select.searchProject')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 text-sm border rounded bg-white"
                                autoFocus
                            />
                        </div>

                        {/* Frequent Selections */}
                        {!searchTerm && validFrequentItems.length > 0 && (
                            <div className="px-3 py-2 border-b bg-slate-50/80">
                                <div className="flex items-center gap-1 mb-1.5">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs text-slate-400 font-medium">{t('select.frequentlyUsed')}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {validFrequentItems.map(item => {
                                        const info = validItemLookup.get(item.id);
                                        const isSelected =
                                            (info?.type === 'product_line' && productLineId === item.id) ||
                                            (info?.type !== 'product_line' && projectId === item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleFrequentClick(item.id)}
                                                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="max-h-[340px] overflow-y-auto">
                            {/* Product Projects Section */}
                            {filteredProductProjects.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100">
                                        {t('select.productProjects')}
                                    </div>
                                    {filteredProductProjects.map(node => renderProjectNode(node))}
                                </div>
                            )}

                            {/* Functional Projects Section */}
                            {filteredFunctionalProjects.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100">
                                        {t('select.functionalProjects')}
                                    </div>
                                    {filteredFunctionalProjects.map(node => renderProjectNode(node))}
                                </div>
                            )}

                            {/* Support Projects Section (비프로젝트 상시 업무) */}
                            {filteredSupportProjects.length > 0 && (
                                <div className="border-b">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-amber-50 flex items-center gap-2">
                                        {t('select.supportProjects')}
                                        {user?.primary_business_unit && (
                                            <span className="text-xs font-normal text-amber-600">
                                                ({user.primary_business_unit.code})
                                            </span>
                                        )}
                                    </div>
                                    {filteredSupportProjects.map(project => {
                                        const matchedIO = findMatchingRechargeIO(project.name);
                                        return (
                                            <button
                                                key={project.id}
                                                type="button"
                                                onClick={() => handleSelectSupportProject(project)}
                                                className={`w-full flex items-center gap-2 py-2 px-3 text-sm hover:bg-amber-50 text-left ${
                                                    projectId === project.id ? 'bg-amber-100 text-amber-700' : ''
                                                }`}
                                            >
                                                <Wrench className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="truncate block">{project.name}</span>
                                                    {matchedIO && (
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Info className="h-3 w-3" />
                                                            IO: {matchedIO.io_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
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
                                        <span className="text-slate-500">{t('select.noSelection')}</span>
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {filteredProductProjects.length === 0 &&
                                filteredFunctionalProjects.length === 0 &&
                                filteredSupportProjects.length === 0 &&
                                filteredProductLines.length === 0 && (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                        {t('select.searchNoResults')}
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
