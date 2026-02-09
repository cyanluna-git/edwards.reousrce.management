/**
 * Scenario Selector Component
 * Simple select to choose scenarios for a project
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ProjectScenario } from '@/types';

interface ScenarioSelectorProps {
    scenarios: ProjectScenario[];
    selectedScenarioId?: number;
    onSelect: (scenario: ProjectScenario) => void;
    onCreateNew: () => void;
    onCopy?: (scenario: ProjectScenario) => void;
}

export function ScenarioSelector({
    scenarios,
    selectedScenarioId,
    onSelect,
    onCreateNew,
    onCopy,
}: ScenarioSelectorProps) {
    const { t } = useTranslation('projects');
    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        const scenario = scenarios.find(s => s.id === id);
        if (scenario) {
            onSelect(scenario);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <select
                className="flex-1 p-2 border rounded-md bg-background min-w-[200px]"
                value={selectedScenarioId || ''}
                onChange={handleChange}
            >
                <option value="">{t('scenarios.selectScenario')}</option>
                {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                        {s.is_baseline ? ` ${t('scenarios.baselineTag')}` : ''}
                        {s.is_active ? ' \u2713' : ''}
                    </option>
                ))}
            </select>

            <Button variant="outline" size="sm" onClick={onCreateNew}>
                {t('scenarios.addNew')}
            </Button>

            {selectedScenario && onCopy && (
                <Button variant="outline" size="sm" onClick={() => onCopy(selectedScenario)}>
                    {t('scenarios.copy')}
                </Button>
            )}
        </div>
    );
}

export default ScenarioSelector;
