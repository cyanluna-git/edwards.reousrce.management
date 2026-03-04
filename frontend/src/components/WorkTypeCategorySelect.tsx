import React, { useState, useMemo, useEffect } from 'react';
import { useWorkTypeCategories, WorkTypeCategory } from '@/hooks/useWorkTypeCategories';
import { useAuth } from '@/hooks/useAuth';
import { useFrequentSelections } from '@/hooks/useFrequentSelections';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLocalizedName } from '@/lib/utils';

interface WorkTypeCategorySelectProps {
    value?: number;
    onChange: (categoryId: number, category: WorkTypeCategory) => void;
    placeholder?: string;
    className?: string;
}

export function WorkTypeCategorySelect({
    value,
    onChange,
    placeholder,
    className = '',
}: WorkTypeCategorySelectProps) {
    const { data: categories = [], isLoading } = useWorkTypeCategories();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedL1s, setExpandedL1s] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const { t, i18n } = useTranslation('common');
    const { topItems } = useFrequentSelections('worktype', user?.id);

    // Expand all L1s when dropdown opens
    useEffect(() => {
        if (isOpen && categories.length > 0) {
            const allL1Ids = categories
                .filter(l1 => l1.code !== 'ABS')
                .map(l1 => l1.id);
            setExpandedL1s(new Set(allL1Ids));
        }
    }, [isOpen, categories]);

    // Find selected category from tree
    const selectedCategory = useMemo(() => {
        if (!value) return null;
        for (const l1 of categories) {
            if (l1.id === value) return l1;
            for (const l2 of l1.children) {
                if (l2.id === value) return l2;
                for (const l3 of l2.children) {
                    if (l3.id === value) return l3;
                }
            }
        }
        return null;
    }, [value, categories]);

    // Helper: find category by id from tree
    const findCategoryById = (id: number): WorkTypeCategory | null => {
        for (const l1 of categories) {
            if (l1.id === id) return l1;
            for (const l2 of l1.children) {
                if (l2.id === id) return l2;
                for (const l3 of l2.children) {
                    if (l3.id === id) return l3;
                }
            }
        }
        return null;
    };

    // Filter categories based on search AND role
    const filteredCategories = useMemo(() => {
        const term = searchTerm.toLowerCase();

        return categories
            .filter(l1 => l1.code !== 'ABS') // Hide Absence category (use Leave Entry Modal instead)
            .map(l1 => {
            // Filter L2s and their L3s
            const filteredL2s = l1.children.map(l2 => {

                // 1. Role Check
                if (l2.applicable_roles && user?.role) {
                    const allowedRoles = l2.applicable_roles.split(',');
                    if (!allowedRoles.includes(user.role)) return null;
                }

                // 2. Search Check
                const l2Matches = !term || l2.name.toLowerCase().includes(term) ||
                    l2.name_ko?.toLowerCase().includes(term) ||
                    l2.code.toLowerCase().includes(term);

                const filteredL3s = (l2.children || []).filter(l3 =>
                    !term ||
                    l3.name.toLowerCase().includes(term) ||
                    l3.name_ko?.toLowerCase().includes(term) ||
                    l3.code.toLowerCase().includes(term)
                );

                if (l2Matches || filteredL3s.length > 0) {
                    return {
                        ...l2,
                        children: filteredL3s.length > 0 ? filteredL3s : (l2Matches ? l2.children : [])
                    };
                }
                return null;
            }).filter((l2): l2 is WorkTypeCategory => l2 !== null);

            return {
                ...l1,
                children: filteredL2s
            };
        }).filter(l1 => l1.children.length > 0);
    }, [categories, searchTerm, user]);

    // Frequent items filtered to only those that exist in current categories
    const validFrequentItems = useMemo(() => {
        return topItems.filter(item => findCategoryById(Number(item.id)) !== null);
    }, [topItems, categories]);

    const handleSelect = (category: WorkTypeCategory) => {
        onChange(category.id, category);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleFrequentClick = (id: string) => {
        const category = findCategoryById(Number(id));
        if (category) {
            handleSelect(category);
        }
    };

    const toggleL1 = (l1Id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedL1s(prev => {
            const next = new Set(prev);
            if (next.has(l1Id)) {
                next.delete(l1Id);
            } else {
                next.add(l1Id);
            }
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className={`p-2 border rounded-md bg-background text-muted-foreground ${className}`}>
                {t('select.loading')}
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 border rounded-md bg-background hover:bg-slate-50 text-left"
            >
                <span className={selectedCategory ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedCategory
                        ? getLocalizedName(selectedCategory, i18n.language)
                        : (placeholder || t('select.selectWorkType'))}
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
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b bg-white">
                            <input
                                type="text"
                                placeholder={t('select.searchWorkType')}
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
                                    {validFrequentItems.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleFrequentClick(item.id)}
                                            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                                value === Number(item.id)
                                                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200'
                                            }`}
                                        >
                                            {(() => {
                                                const cat = findCategoryById(Number(item.id));
                                                return cat ? getLocalizedName(cat, i18n.language) : item.label;
                                            })()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Category List — resizable by dragging bottom edge */}
                        <div
                            className="overflow-y-auto"
                            style={{ height: '240px', minHeight: '120px', maxHeight: '60vh', resize: 'vertical' }}
                        >
                            {filteredCategories.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    {t('select.searchNoResults')}
                                </div>
                            ) : (
                                filteredCategories.map((l1) => (
                                    <div key={l1.id}>
                                        {/* L1 Header */}
                                        <button
                                            type="button"
                                            onClick={(e) => toggleL1(l1.id, e)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-50 hover:bg-slate-100 text-left"
                                        >
                                            {expandedL1s.has(l1.id) ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            )}
                                            <span>{getLocalizedName(l1, i18n.language)}</span>
                                        </button>

                                        {/* L2 Items */}
                                        {expandedL1s.has(l1.id) && (
                                            <div className="bg-white">
                                                {l1.children.map((l2) => {
                                                    const hasL3Children = l2.children && l2.children.length > 0;
                                                    return (
                                                    <div key={l2.id}>
                                                        {hasL3Children ? (
                                                            <div
                                                                className="w-full flex items-center gap-2 pl-8 pr-3 py-2 text-sm text-slate-500 cursor-default text-left"
                                                            >
                                                                <span>{getLocalizedName(l2, i18n.language)}</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelect(l2)}
                                                                className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 text-sm hover:bg-blue-50 text-left ${value === l2.id ? 'bg-blue-100 text-blue-700' : ''
                                                                    }`}
                                                            >
                                                                <span>{getLocalizedName(l2, i18n.language)}</span>
                                                            </button>
                                                        )}
                                                        {/* L3 Children */}
                                                        {l2.children && l2.children.length > 0 && (
                                                            <div className="bg-slate-50/50">
                                                                {l2.children.map((l3) => (
                                                                    <button
                                                                        key={l3.id}
                                                                        type="button"
                                                                        onClick={() => handleSelect(l3)}
                                                                        className={`w-full flex items-center gap-2 pl-12 pr-3 py-1.5 text-xs hover:bg-blue-50 text-left ${value === l3.id ? 'bg-blue-100 text-blue-700' : 'text-slate-600'
                                                                            }`}
                                                                    >
                                                                        <span className="text-slate-400">└</span>
                                                                        <span>{getLocalizedName(l3, i18n.language)}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Resize hint */}
                        <div className="flex items-center justify-center py-0.5 bg-slate-50 border-t cursor-ns-resize select-none">
                            <div className="w-8 h-0.5 rounded bg-slate-300" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default WorkTypeCategorySelect;
