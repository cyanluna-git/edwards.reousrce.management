import React, { useState, useMemo } from 'react';
import { useWorkTypeCategories, WorkTypeCategory } from '@/hooks/useWorkTypeCategories';
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

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        if (!searchTerm) return categories;
        const term = searchTerm.toLowerCase();
        return categories.map(l1 => ({
            ...l1,
            children: l1.children.filter(l2 =>
                l2.name.toLowerCase().includes(term) ||
                l2.name_ko?.toLowerCase().includes(term) ||
                l2.code.toLowerCase().includes(term)
            )
        })).filter(l1 => l1.children.length > 0 || l1.name.toLowerCase().includes(term));
    }, [categories, searchTerm]);

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
                                                    <button
                                                        key={l2.id}
                                                        type="button"
                                                        onClick={() => handleSelect(l2)}
                                                        className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 text-sm hover:bg-blue-50 text-left ${value === l2.id ? 'bg-blue-100 text-blue-700' : ''
                                                            }`}
                                                    >
                                                        <span className="text-slate-400 font-mono text-xs">{l2.code}</span>
                                                        <span>{l2.name_ko || l2.name}</span>
                                                    </button>
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
