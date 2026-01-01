/**
 * UserHierarchySelect Component
 * Searchable user selector with organization hierarchy
 * Supports Korean and English name search
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Building2, Users, User, Search, X } from 'lucide-react';
import { getDepartments, getDivisions, type Department, type Division } from '@/api/client';

interface UserData {
    id: string;
    name: string;
    korean_name?: string | null;
    email: string;
    department_id?: string | null;
    sub_team_id?: string | null;
    position?: {
        name: string;
    } | null;
    department?: {
        id: string;
        name: string;
        division_id?: string | null;
        division?: {
            id: string;
            name: string;
        } | null;
    } | null;
    sub_team?: {
        id: string;
        name: string;
        department_id?: string | null;
    } | null;
}

interface UserHierarchySelectProps {
    users: UserData[];
    value?: string;
    onChange: (userId: string | undefined) => void;
    placeholder?: string;
    className?: string;
}

interface OrgNode {
    id: string;
    name: string;
    type: 'division' | 'department' | 'sub_team';
    children: OrgNode[];
    users: UserData[];
}

export const UserHierarchySelect: React.FC<UserHierarchySelectProps> = ({
    users,
    value,
    onChange,
    placeholder = '담당자 선택...',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch departments and divisions for hierarchy
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    const { data: divisions = [] } = useQuery<Division[]>({
        queryKey: ['divisions'],
        queryFn: () => getDivisions(),
    });

    // Find selected user name
    const selectedUser = useMemo(() => {
        if (!value) return null;
        return users.find(u => u.id === value);
    }, [value, users]);

    // Build organization hierarchy using departments and divisions
    const hierarchy = useMemo(() => {
        // Build maps for quick lookup
        const divisionMap = new Map(divisions.map(d => [d.id, d]));
        const departmentMap = new Map(departments.map(d => [d.id, d]));

        const divisionNodes: Record<string, OrgNode> = {};
        const departmentNodes: Record<string, OrgNode> = {};
        const unassigned: UserData[] = [];

        // Group users by department
        const usersByDept: Record<string, UserData[]> = {};
        users.forEach(user => {
            const deptId = user.department_id;
            if (!deptId) {
                unassigned.push(user);
                return;
            }
            if (!usersByDept[deptId]) {
                usersByDept[deptId] = [];
            }
            usersByDept[deptId].push(user);
        });

        // Build hierarchy from departments with users
        Object.entries(usersByDept).forEach(([deptId, deptUsers]) => {
            const dept = departmentMap.get(deptId);
            if (!dept) {
                unassigned.push(...deptUsers);
                return;
            }

            const divisionId = dept.division_id;
            const division = divisionId ? divisionMap.get(divisionId) : null;

            // Create division node if needed
            if (division && !divisionNodes[division.id]) {
                divisionNodes[division.id] = {
                    id: division.id,
                    name: division.name,
                    type: 'division',
                    children: [],
                    users: [],
                };
            }

            // Create department node
            if (!departmentNodes[deptId]) {
                departmentNodes[deptId] = {
                    id: dept.id,
                    name: dept.name,
                    type: 'department',
                    children: [],
                    users: deptUsers,
                };

                // Add to division if exists
                if (division && divisionNodes[division.id]) {
                    divisionNodes[division.id].children.push(departmentNodes[deptId]);
                }
            } else {
                departmentNodes[deptId].users.push(...deptUsers);
            }
        });

        // Build final structure
        const result: OrgNode[] = [];

        // Add divisions with departments
        Object.values(divisionNodes).forEach(div => {
            if (div.children.length > 0) {
                result.push(div);
            }
        });

        // Add departments without divisions
        Object.values(departmentNodes).forEach(dept => {
            const hasParent = Object.values(divisionNodes).some(div =>
                div.children.some(c => c.id === dept.id)
            );
            if (!hasParent && dept.users.length > 0) {
                result.push(dept);
            }
        });

        // Add unassigned users
        if (unassigned.length > 0) {
            result.push({
                id: 'unassigned',
                name: '미배정',
                type: 'department',
                children: [],
                users: unassigned,
            });
        }

        return result;
    }, [users, departments, divisions]);

    // Filter users based on search term (Korean/English/email)
    const matchesSearch = (user: UserData, term: string): boolean => {
        if (!term) return true;
        const lowerTerm = term.toLowerCase();
        return (
            (user.korean_name?.toLowerCase().includes(lowerTerm)) ||
            (user.name?.toLowerCase().includes(lowerTerm)) ||
            (user.email?.toLowerCase().includes(lowerTerm))
        );
    };

    // Filter hierarchy based on search
    const filteredHierarchy = useMemo(() => {
        if (!searchTerm) return hierarchy;

        const filterNode = (node: OrgNode): OrgNode | null => {
            const filteredUsers = node.users.filter(u => matchesSearch(u, searchTerm));
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(Boolean) as OrgNode[];

            if (filteredUsers.length > 0 || filteredChildren.length > 0) {
                return {
                    ...node,
                    users: filteredUsers,
                    children: filteredChildren,
                };
            }
            return null;
        };

        return hierarchy.map(node => filterNode(node)).filter(Boolean) as OrgNode[];
    }, [hierarchy, searchTerm]);

    // Flatten filtered users for quick results
    const flatFilteredUsers = useMemo(() => {
        if (!searchTerm) return [];
        return users.filter(u => matchesSearch(u, searchTerm));
    }, [users, searchTerm]);

    // Toggle node expansion
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

    // Handle user selection
    const handleSelectUser = (userId: string | undefined) => {
        onChange(userId);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Render user item
    const renderUser = (user: UserData, indent: number = 0) => {
        const isSelected = value === user.id;
        return (
            <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user.id)}
                className={`w-full flex items-center gap-2 py-1.5 px-2 text-sm hover:bg-blue-50 text-left ${isSelected ? 'bg-blue-100 text-blue-700' : ''
                    }`}
                style={{ paddingLeft: `${indent * 16 + 8}px` }}
            >
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium">{user.korean_name || user.name}</span>
                <span className="text-xs text-slate-500">{user.name}</span>
                {user.position?.name && (
                    <span className="text-xs text-slate-400">· {user.position.name}</span>
                )}
            </button>
        );
    };

    // Render organization node
    const renderNode = (node: OrgNode, depth: number = 0) => {
        const hasChildren = node.children.length > 0 || node.users.length > 0;
        const isExpanded = expandedNodes.has(node.id) || !!searchTerm;
        const indent = depth * 16 + 8;

        const Icon = node.type === 'division' ? Building2 : Users;

        return (
            <div key={node.id}>
                <button
                    type="button"
                    onClick={(e) => toggleNode(node.id, e)}
                    className="w-full flex items-center gap-2 py-2 px-2 text-sm font-medium bg-slate-50 hover:bg-slate-100 text-left"
                    style={{ paddingLeft: `${indent}px` }}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="h-4 w-4 text-slate-500" />
                            : <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    <Icon className={`h-4 w-4 ${node.type === 'division' ? 'text-blue-500' : 'text-green-500'}`} />
                    <span>{node.name}</span>
                    <span className="text-xs text-slate-400">
                        ({node.users.length + node.children.reduce((sum, c) => sum + c.users.length, 0)}명)
                    </span>
                </button>
                {isExpanded && (
                    <div>
                        {node.children.map(child => renderNode(child, depth + 1))}
                        {node.users.map(user => renderUser(user, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white hover:bg-slate-50 text-left"
            >
                <span className={selectedUser ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedUser
                        ? `${selectedUser.korean_name || selectedUser.name} (${selectedUser.name})`
                        : placeholder
                    }
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <X
                            className="h-4 w-4 text-slate-400 hover:text-slate-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUser(undefined);
                            }}
                        />
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[400px] overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b bg-white sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="이름 검색 (한글/영어)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded bg-white"
                            />
                        </div>
                    </div>

                    <div className="max-h-[340px] overflow-y-auto">
                        {/* TBD Option */}
                        <button
                            type="button"
                            onClick={() => handleSelectUser(undefined)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left border-b ${!value ? 'bg-blue-100 text-blue-700' : ''
                                }`}
                        >
                            <span className="text-orange-600 font-medium">TBD (미할당)</span>
                        </button>

                        {/* Search Results or Hierarchy */}
                        {searchTerm ? (
                            // Show flat filtered results when searching
                            flatFilteredUsers.length > 0 ? (
                                <div className="py-1">
                                    {flatFilteredUsers.map(user => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => handleSelectUser(user.id)}
                                            className={`w-full flex items-center gap-2 py-2 px-3 text-sm hover:bg-blue-50 text-left ${value === user.id ? 'bg-blue-100 text-blue-700' : ''
                                                }`}
                                        >
                                            <User className="h-4 w-4 text-slate-400" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {user.korean_name || user.name}
                                                    <span className="text-xs text-slate-500 ml-1">({user.name})</span>
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {user.department?.name || '미배정'}
                                                    {user.position?.name && ` · ${user.position.name}`}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    검색 결과가 없습니다.
                                </div>
                            )
                        ) : (
                            // Show hierarchy when not searching
                            filteredHierarchy.length > 0 ? (
                                <div className="py-1">
                                    {filteredHierarchy.map(node => renderNode(node))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    등록된 사용자가 없습니다.
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserHierarchySelect;
