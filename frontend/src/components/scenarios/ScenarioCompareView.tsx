/**
 * Scenario Comparison View Component
 * Shows side-by-side milestone comparison between two scenarios
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectScenario } from '@/types';
import { useCompareScenarios } from '@/hooks/useScenarios';

interface ScenarioCompareViewProps {
    scenarios: ProjectScenario[];
    projectId: string;
}

export function ScenarioCompareView({ scenarios }: ScenarioCompareViewProps) {
    const [scenario1Id, setScenario1Id] = useState<number | undefined>();
    const [scenario2Id, setScenario2Id] = useState<number | undefined>();

    const { data: comparison, isLoading } = useCompareScenarios(scenario1Id, scenario2Id);

    // Set defaults if available
    if (!scenario1Id && !scenario2Id && scenarios.length >= 2) {
        const baseline = scenarios.find(s => s.is_baseline);
        if (baseline) {
            setScenario1Id(baseline.id);
            const other = scenarios.find(s => s.id !== baseline.id);
            if (other) setScenario2Id(other.id);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>시나리오 비교</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Scenario Selectors */}
                <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">시나리오 1 (기준)</label>
                        <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={scenario1Id || ''}
                            onChange={(e) => setScenario1Id(Number(e.target.value) || undefined)}
                        >
                            <option value="">선택...</option>
                            {scenarios.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.is_baseline && '(Baseline)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">시나리오 2 (비교)</label>
                        <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={scenario2Id || ''}
                            onChange={(e) => setScenario2Id(Number(e.target.value) || undefined)}
                        >
                            <option value="">선택...</option>
                            {scenarios.filter(s => s.id !== scenario1Id).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.is_baseline && '(Baseline)'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Comparison Table */}
                {isLoading ? (
                    <div className="text-center py-4">비교 중...</div>
                ) : comparison ? (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className={`p-4 rounded-lg ${comparison.total_delta_days > 0
                            ? 'bg-red-50 text-red-700'
                            : comparison.total_delta_days < 0
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-50 text-gray-700'
                            }`}>
                            <span className="font-medium">총 일정 변화: </span>
                            <span className="font-bold">
                                {comparison.total_delta_days > 0
                                    ? `+${comparison.total_delta_days}일 (지연)`
                                    : comparison.total_delta_days < 0
                                        ? `${comparison.total_delta_days}일 (단축)`
                                        : '변화 없음'}
                            </span>
                        </div>

                        {/* Milestone differences table */}
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 px-2">마일스톤</th>
                                    <th className="text-center py-2 px-2">{comparison.scenario_1_name}</th>
                                    <th className="text-center py-2 px-2">{comparison.scenario_2_name}</th>
                                    <th className="text-center py-2 px-2">차이</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.milestone_comparisons.map((mc, idx) => (
                                    <tr key={idx} className="border-b hover:bg-muted/50">
                                        <td className="py-2 px-2 font-medium">{mc.milestone_name}</td>
                                        <td className="text-center py-2 px-2">
                                            {mc.scenario_1_date
                                                ? format(parseISO(mc.scenario_1_date), 'yyyy-MM-dd')
                                                : '-'}
                                        </td>
                                        <td className="text-center py-2 px-2">
                                            {mc.scenario_2_date
                                                ? format(parseISO(mc.scenario_2_date), 'yyyy-MM-dd')
                                                : '-'}
                                        </td>
                                        <td className={`text-center py-2 px-2 font-bold ${mc.delta_days && mc.delta_days > 0
                                            ? 'text-red-600'
                                            : mc.delta_days && mc.delta_days < 0
                                                ? 'text-green-600'
                                                : ''
                                            }`}>
                                            {mc.delta_days !== null && mc.delta_days !== undefined
                                                ? `${mc.delta_days > 0 ? '+' : ''}${mc.delta_days}일`
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        두 시나리오를 선택하여 비교하세요.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ScenarioCompareView;
