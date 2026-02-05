import { useQuery } from '@tanstack/react-query';
import { getFrequentSelections, FrequentItem } from '@/api/worklogs';

const FREQUENT_KEY = 'worklog-frequent';

export function useFrequentSelections(type: 'worktype' | 'project', userId?: string) {
    const { data } = useQuery({
        queryKey: [FREQUENT_KEY, userId],
        queryFn: () => getFrequentSelections(),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const topItems: FrequentItem[] = type === 'worktype'
        ? (data?.work_types ?? [])
        : (data?.projects ?? []);

    return { topItems };
}
