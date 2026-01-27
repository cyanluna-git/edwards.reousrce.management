/**
 * React Query hooks for AI WorkLog
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AIWorklogParseRequest } from '@/types';
import { parseWorklogWithAI, checkAIHealth } from '@/api/ai-worklog';

// Query keys
const AI_HEALTH_KEY = 'ai-health';
const AI_PARSE_KEY = 'ai-worklog-parse';
const WORKLOGS_KEY = 'worklogs';

/**
 * Hook to check AI service health
 */
export function useAIHealth() {
    return useQuery({
        queryKey: [AI_HEALTH_KEY],
        queryFn: checkAIHealth,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refetch every minute
        retry: 1,
    });
}

/**
 * Hook to parse worklog with AI
 */
export function useAIWorklogParse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: AIWorklogParseRequest) => parseWorklogWithAI(request),
        onSuccess: () => {
            // Optionally invalidate related queries
            queryClient.invalidateQueries({ queryKey: [AI_PARSE_KEY] });
        },
    });
}

/**
 * Hook to invalidate worklogs after AI entries are saved
 */
export function useInvalidateWorklogs() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: [WORKLOGS_KEY] });
    };
}
