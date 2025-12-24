import React, { useState, useMemo } from 'react';
import { useWorkTypeCategories, WorkTypeCategory } from '@/hooks/useWorkTypeCategories';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface WorkTypeCategorySelectProps {
    value?: number;
    onChange: (categoryId: number, category: WorkTypeCategory) => void;
    placeholder?: string;
    className?: string;
}

export function WorkTypeCategorySelect({
    value,
    onChange,
    placeholder = '업무 유형 선택',
    className = '',
}: WorkTypeCategorySelectProps) {
    const { data: categories = [], isLoading } = useWorkTypeCategories();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedL1, setExpandedL1] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Filter categories based on search AND role
    const filteredCategories = useMemo(() => {
        const term = searchTerm.toLowerCase();

        return categories.map(l1 => {
            // Filter L2s and their L3s
            const filteredL2s = l1.children.map(l2 => {

                // 1. Role Check
                if (l2.applicable_roles && user?.role) {
                    const allowedRoles = l2.applicable_roles.split(',');
                    // Simple check: if user.role is not in allowed list, hide it
                    // NOTE: If user.role matches part of string (e.g. "ENGINEER" in "SW_ENGINEER"), ensure exact match or robust check.
                    // Seed uses "SW_ENGINEER,SYSTEM_ENGINEER", so splitting by comma is safer.
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

    const handleSelect = (category: WorkTypeCategory) => {
        onChange(category.id, category);
        setIsOpen(false);
        setSearchTerm('');
    };

    const toggleL1 = (l1Id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedL1(expandedL1 === l1Id ? null : l1Id);
    };

    if (isLoading) {
        return (
            <div className={`p-2 border rounded-md bg-background text-muted-foreground ${className}`}>
                로딩 중...
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
                        ? `${selectedCategory.code} - ${selectedCategory.name_ko || selectedCategory.name}`
                        : placeholder}
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
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[320px] overflow-hidden">
                        {/* Search Input */}
                        <div className="p-2 border-b bg-white">
                            <input
                                type="text"
                                placeholder="업무 유형 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 text-sm border rounded bg-white"
                                autoFocus
                            />
                        </div>

                        {/* Category List */}
                        <div className="max-h-[260px] overflow-y-auto">
                            {filteredCategories.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    검색 결과가 없습니다.
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
                                            {expandedL1 === l1.id ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            )}
                                            <span className="text-blue-600 font-mono text-xs">{l1.code}</span>
                                            <span>{l1.name_ko || l1.name}</span>
                                        </button>

                                        {/* L2 Items */}
                                        {expandedL1 === l1.id && (
                                            <div className="bg-white">
                                                {l1.children.map((l2) => (
                                                    <div key={l2.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelect(l2)}
                                                            className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 text-sm hover:bg-blue-50 text-left ${value === l2.id ? 'bg-blue-100 text-blue-700' : ''
                                                                }`}
                                                        >
                                                            <span className="text-slate-400 font-mono text-xs">{l2.code}</span>
                                                            <span>{l2.name_ko || l2.name}</span>
                                                        </button>
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
                                                                        <span className="text-slate-400 font-mono text-[10px]">└ {l3.code.split('-').pop()}</span>
                                                                        <span>{l3.name_ko || l3.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default WorkTypeCategorySelect;
