import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, X, Folder, FolderOpen } from 'lucide-react';
import type { Project } from '@/types';

interface ProjectSelectorProps {
    projects: Project[];
    value: string;
    onChange: (projectId: string) => void;
    placeholder?: string;
}

// 사업영역 순서 정의
const BUSINESS_AREA_ORDER = ['Integrated System', 'Abatement', 'ACM', 'Others'];

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
    projects,
    value,
    onChange,
    placeholder = '프로젝트를 선택하세요',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(BUSINESS_AREA_ORDER));
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 선택된 프로젝트 찾기
    const selectedProject = useMemo(() => {
        return projects.find(p => p.id === value);
    }, [projects, value]);

    // 종료된 프로젝트 필터링 (Closed, Cancelled, Completed 상태 제외)
    const activeProjects = useMemo(() => {
        const excludedStatuses = ['Completed', 'Cancelled'];
        return projects.filter(p => {
            // 상태로 필터링
            if (excludedStatuses.includes(p.status)) return false;
            // 이름에 [Closed] 또는 [Cancel] 포함된 프로젝트 제외
            if (p.name.includes('[Closed]') || p.name.includes('[Cancel]')) return false;
            return true;
        });
    }, [projects]);

    // 사업영역별로 프로젝트 그룹화
    const groupedProjects = useMemo(() => {
        const groups: Record<string, Project[]> = {};

        activeProjects.forEach((p: Project) => {
            const buName = p.program?.business_unit?.name || 'Others';
            if (!groups[buName]) {
                groups[buName] = [];
            }
            groups[buName].push(p);
        });

        return groups;
    }, [activeProjects]);

    // 검색 필터링
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groupedProjects;

        const query = searchQuery.toLowerCase();
        const filtered: Record<string, Project[]> = {};

        Object.entries(groupedProjects).forEach(([area, projectList]) => {
            const matchedProjects = projectList.filter(
                p => p.code.toLowerCase().includes(query) ||
                    p.name.toLowerCase().includes(query)
            );
            if (matchedProjects.length > 0) {
                filtered[area] = matchedProjects;
            }
        });

        return filtered;
    }, [groupedProjects, searchQuery]);

    // 드롭다운 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 드롭다운 열릴 때 검색 input에 포커스
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // 영역 펼침/접기 토글
    const toggleArea = (area: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedAreas(prev => {
            const newSet = new Set(prev);
            if (newSet.has(area)) {
                newSet.delete(area);
            } else {
                newSet.add(area);
            }
            return newSet;
        });
    };

    // 프로젝트 선택
    const handleSelectProject = (projectId: string) => {
        onChange(projectId);
        setIsOpen(false);
        setSearchQuery('');
    };

    // 전체 펼치기/접기
    const toggleAll = (expand: boolean) => {
        if (expand) {
            setExpandedAreas(new Set(BUSINESS_AREA_ORDER));
        } else {
            setExpandedAreas(new Set());
        }
    };

    // 각 영역의 프로젝트 수 계산
    const getAreaCount = (area: string) => {
        return filteredGroups[area]?.length || 0;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* 선택 버튼 */}
            <button
                type="button"
                className="flex items-center justify-between w-full min-w-[350px] px-3 py-2 text-left bg-white border rounded-md hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedProject ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedProject
                        ? `${selectedProject.code} - ${selectedProject.name}`
                        : placeholder
                    }
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* 드롭다운 패널 */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[450px] overflow-hidden">
                    {/* 검색 + 전체 펼침/접기 컨트롤 */}
                    <div className="p-2 border-b bg-slate-50">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-8 pr-8 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="프로젝트 코드 또는 이름으로 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2 mt-2 text-xs">
                            <button
                                className="text-blue-600 hover:underline"
                                onClick={() => toggleAll(true)}
                            >
                                전체 펼치기
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button
                                className="text-blue-600 hover:underline"
                                onClick={() => toggleAll(false)}
                            >
                                전체 접기
                            </button>
                        </div>
                    </div>

                    {/* 프로젝트 목록 */}
                    <div className="overflow-y-auto max-h-[350px]">
                        {/* 선택 안함 옵션 */}
                        {!searchQuery && (
                            <div
                                className={`px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm ${!value ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground'}`}
                                onClick={() => handleSelectProject('')}
                            >
                                ✓ {placeholder}
                            </div>
                        )}

                        {/* 사업영역별 그룹 */}
                        {BUSINESS_AREA_ORDER
                            .filter(area => getAreaCount(area) > 0)
                            .map(area => {
                                const isExpanded = expandedAreas.has(area);
                                const areaProjects = filteredGroups[area] || [];

                                return (
                                    <div key={area} className="border-t first:border-t-0">
                                        {/* 영역 헤더 */}
                                        <div
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                                            onClick={(e) => toggleArea(area, e)}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-slate-600" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-600" />
                                            )}
                                            {isExpanded ? (
                                                <FolderOpen className="w-4 h-4 text-amber-500" />
                                            ) : (
                                                <Folder className="w-4 h-4 text-amber-500" />
                                            )}
                                            <span className="font-medium text-sm">{area}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                ({areaProjects.length})
                                            </span>
                                        </div>

                                        {/* 프로젝트 리스트 */}
                                        {isExpanded && (
                                            <div className="bg-white">
                                                {areaProjects.map(project => (
                                                    <div
                                                        key={project.id}
                                                        className={`px-8 py-1.5 cursor-pointer text-sm hover:bg-blue-50 transition-colors ${project.id === value ? 'bg-blue-100 text-blue-700 font-medium' : ''}`}
                                                        onClick={() => handleSelectProject(project.id)}
                                                    >
                                                        {project.code} - {project.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        }

                        {/* 결과 없음 */}
                        {Object.keys(filteredGroups).length === 0 && (
                            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;
