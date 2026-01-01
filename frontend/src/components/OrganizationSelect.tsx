/**
 * OrganizationSelect - Hierarchical Organization Selector
 * Displays organization tree: Division > Department > SubTeam
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getDivisions, getDepartments, getSubTeams, type SubTeam, type Division } from '@/api/client';

interface OrganizationSelectProps {
    departmentId?: string;
    subTeamId?: string | null;
    onChange: (departmentId: string, subTeamId: string | null, displayName: string) => void;
    placeholder?: string;
    className?: string;
}

interface OrgTree {
    id: string;
    name: string;
    code: string;
    children: {
        id: string;
        name: string;
        code: string;
        divisionId: string;
        children: SubTeam[];
    }[];
}

export function OrganizationSelect({
    departmentId,
    subTeamId,
    onChange,
    placeholder = '조직 선택...',
    className = '',
}: OrganizationSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedL0, setExpandedL0] = useState<string | null>(null);
    const [expandedL1, setExpandedL1] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch data - Use Divisions instead of Business Units
    const { data: divisions = [] } = useQuery<Division[]>({
        queryKey: ['divisions'],
        queryFn: getDivisions,
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments(),
    });

    // Build organization tree: Division > Department > SubTeam
    const orgTree = useMemo((): OrgTree[] => {
        return divisions.map(div => ({
            id: div.id,
            name: div.name,
            code: div.code,
            children: departments
                .filter(d => d.division_id === div.id)
                .map(dept => ({
                    id: dept.id,
                    name: dept.name,
                    code: dept.code,
                    divisionId: div.id,
                    children: [] as SubTeam[], // Will be loaded on expand
                })),
        }));
    }, [divisions, departments]);

    // Fetch sub-teams for display name resolution
    const { data: allSubTeams = [] } = useQuery({
        queryKey: ['sub-teams', departmentId],
        queryFn: () => getSubTeams(departmentId!),
        enabled: !!departmentId && !!subTeamId, // Only fetch when both are set
    });

    // Get display name for selected value - show full hierarchy path
    const selectedDisplay = useMemo(() => {
        if (!departmentId) return null;

        const dept = departments.find(d => d.id === departmentId);
        if (!dept) return null;

        // Find Division name
        const div = divisions.find(d => d.id === dept.division_id);
        const divName = div?.name || '';

        // Build full path: Division > Department > SubTeam
        let path = divName ? `${divName} > ${dept.name}` : dept.name;

        if (subTeamId) {
            const st = allSubTeams.find(s => s.id === subTeamId);
            if (st) {
                path += ` > ${st.name}`;
            }
        }

        return path;
    }, [departmentId, subTeamId, departments, divisions, allSubTeams]);

    // Filter based on search
    const filteredTree = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return orgTree;

        return orgTree.map(l0 => ({
            ...l0,
            children: l0.children.filter(l1 =>
                l1.name.toLowerCase().includes(term) ||
                l1.code.toLowerCase().includes(term)
            ),
        })).filter(l0 =>
            l0.children.length > 0 ||
            l0.name.toLowerCase().includes(term) ||
            l0.code.toLowerCase().includes(term)
        );
    }, [orgTree, searchTerm]);

    const handleSelectDept = (deptId: string, deptName: string) => {
        onChange(deptId, null, deptName);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSelectSubTeam = (deptId: string, stId: string, displayName: string) => {
        onChange(deptId, stId, displayName);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 border rounded-md bg-background hover:bg-slate-50 text-left"
            >
                <span className={selectedDisplay ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedDisplay || placeholder}
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
                                placeholder="조직 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 text-sm border rounded bg-white"
                                autoFocus
                            />
                        </div>

                        {/* Organization List */}
                        <div className="max-h-[260px] overflow-y-auto">
                            {filteredTree.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    검색 결과가 없습니다.
                                </div>
                            ) : (
                                filteredTree.map((l0) => (
                                    <L0Item
                                        key={l0.id}
                                        item={l0}
                                        isExpanded={expandedL0 === l0.id}
                                        expandedL1={expandedL1}
                                        onToggle={() => setExpandedL0(expandedL0 === l0.id ? null : l0.id)}
                                        onToggleL1={(l1Id) => setExpandedL1(expandedL1 === l1Id ? null : l1Id)}
                                        onSelectDept={handleSelectDept}
                                        onSelectSubTeam={handleSelectSubTeam}
                                        selectedDeptId={departmentId}
                                        selectedSubTeamId={subTeamId}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// L0 Item Component (with lazy-loaded sub-teams)
const L0Item: React.FC<{
    item: OrgTree;
    isExpanded: boolean;
    expandedL1: string | null;
    onToggle: () => void;
    onToggleL1: (l1Id: string) => void;
    onSelectDept: (deptId: string, deptName: string) => void;
    onSelectSubTeam: (deptId: string, stId: string, displayName: string) => void;
    selectedDeptId?: string;
    selectedSubTeamId?: string | null;
}> = ({ item, isExpanded, expandedL1, onToggle, onToggleL1, onSelectDept, onSelectSubTeam, selectedDeptId, selectedSubTeamId }) => {
    return (
        <div>
            {/* L0 Header */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-left"
            >
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span>{item.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{item.children.length} teams</span>
            </button>

            {/* L1 Items */}
            {isExpanded && (
                <div className="bg-white">
                    {item.children.map((l1) => (
                        <L1Item
                            key={l1.id}
                            item={l1}
                            isExpanded={expandedL1 === l1.id}
                            onToggle={() => onToggleL1(l1.id)}
                            onSelectDept={onSelectDept}
                            onSelectSubTeam={onSelectSubTeam}
                            selectedDeptId={selectedDeptId}
                            selectedSubTeamId={selectedSubTeamId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// L1 Item Component (Department with lazy-loaded sub-teams)
const L1Item: React.FC<{
    item: OrgTree['children'][0];
    isExpanded: boolean;
    onToggle: () => void;
    onSelectDept: (deptId: string, deptName: string) => void;
    onSelectSubTeam: (deptId: string, stId: string, displayName: string) => void;
    selectedDeptId?: string;
    selectedSubTeamId?: string | null;
}> = ({ item, isExpanded, onToggle, onSelectDept, onSelectSubTeam, selectedDeptId, selectedSubTeamId }) => {
    // Lazy load sub-teams when expanded
    const { data: subTeams = [] } = useQuery({
        queryKey: ['sub-teams', item.id],
        queryFn: () => getSubTeams(item.id),
        enabled: isExpanded,
    });

    const isSelected = selectedDeptId === item.id && !selectedSubTeamId;

    return (
        <div>
            {/* Department Row */}
            <div className="flex items-center">
                {/* Expand/Collapse Button */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className="pl-4 pr-1 py-2 hover:bg-slate-50"
                >
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                    )}
                </button>
                {/* Selectable Department */}
                <button
                    type="button"
                    onClick={() => onSelectDept(item.id, item.name)}
                    className={`flex-1 flex items-center gap-2 pr-3 py-2 text-sm hover:bg-blue-50 text-left ${isSelected ? 'bg-blue-100 text-blue-700' : ''}`}
                >
                    <span>{item.name}</span>
                </button>
            </div>

            {/* Sub-Teams */}
            {isExpanded && subTeams.length > 0 && (
                <div className="bg-slate-50/50">
                    {subTeams.map((st) => {
                        const isStSelected = selectedDeptId === item.id && selectedSubTeamId === st.id;
                        return (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => onSelectSubTeam(item.id, st.id, `${item.name} > ${st.name}`)}
                                className={`w-full flex items-center gap-2 pl-12 pr-3 py-1.5 text-xs hover:bg-blue-50 text-left ${isStSelected ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                            >
                                <span className="text-slate-400 text-[10px]">└</span>
                                <span>{st.name}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrganizationSelect;
