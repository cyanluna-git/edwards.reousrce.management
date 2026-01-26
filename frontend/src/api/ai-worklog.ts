/**
 * AI WorkLog API Client
 */
import apiClient from './client';
import type {
    AIWorklogParseRequest,
    AIWorklogParseResponse,
    AIHealthResponse,
} from '@/types';

/**
 * Parse natural language worklog input using AI
 */
export const parseWorklogWithAI = async (
    request: AIWorklogParseRequest
): Promise<AIWorklogParseResponse> => {
    const response = await apiClient.post('/ai/ai-parse', request);
    return response.data;
};

/**
 * Check AI service health status
 */
export const checkAIHealth = async (): Promise<AIHealthResponse> => {
    const response = await apiClient.get('/ai/ai-health');
    return response.data;
};
