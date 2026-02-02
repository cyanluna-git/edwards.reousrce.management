/**
 * Hooks for Internal IO CRUD operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getInternalIOs,
    getInternalIO,
    createInternalIO,
    updateInternalIO,
    deleteInternalIO,
    findOrCreateInternalIO,
    InternalIOCreate,
    InternalIOUpdate,
    InternalIOResponse,
} from '@/api/client';

const internalIOKeys = {
    all: ['internal-ios'] as const,
    list: (params?: { search?: string; is_active?: boolean }) => [...internalIOKeys.all, 'list', params] as const,
    detail: (id: string) => [...internalIOKeys.all, 'detail', id] as const,
};

export function useInternalIOsList(params?: { search?: string; is_active?: boolean }) {
    return useQuery<InternalIOResponse[], Error>({
        queryKey: internalIOKeys.list(params),
        queryFn: () => getInternalIOs(params),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

export function useInternalIO(id: string) {
    return useQuery<InternalIOResponse, Error>({
        queryKey: internalIOKeys.detail(id),
        queryFn: () => getInternalIO(id),
        enabled: !!id,
    });
}

export function useCreateInternalIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: InternalIOCreate) => createInternalIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: internalIOKeys.all });
        },
    });
}

export function useUpdateInternalIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: InternalIOUpdate }) =>
            updateInternalIO(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: internalIOKeys.all });
        },
    });
}

export function useDeleteInternalIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteInternalIO(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: internalIOKeys.all });
        },
    });
}

export function useFindOrCreateInternalIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: InternalIOCreate) => findOrCreateInternalIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: internalIOKeys.all });
        },
    });
}
