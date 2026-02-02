/**
 * Hooks for Recharge IO CRUD operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getRechargeIOs,
    getRechargeIO,
    createRechargeIO,
    updateRechargeIO,
    deleteRechargeIO,
    findOrCreateRechargeIO,
    getRechargeIOsByBusinessUnit,
    RechargeIOCreate,
    RechargeIOUpdate,
    RechargeIOResponse,
} from '@/api/client';

const rechargeIOKeys = {
    all: ['recharge-ios'] as const,
    list: (params?: { search?: string; is_active?: boolean }) => [...rechargeIOKeys.all, 'list', params] as const,
    detail: (id: string) => [...rechargeIOKeys.all, 'detail', id] as const,
    byBusinessUnit: (buId: string) => [...rechargeIOKeys.all, 'by-bu', buId] as const,
};

export function useRechargeIOsList(params?: { search?: string; is_active?: boolean }) {
    return useQuery<RechargeIOResponse[], Error>({
        queryKey: rechargeIOKeys.list(params),
        queryFn: () => getRechargeIOs(params),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

export function useRechargeIO(id: string) {
    return useQuery<RechargeIOResponse, Error>({
        queryKey: rechargeIOKeys.detail(id),
        queryFn: () => getRechargeIO(id),
        enabled: !!id,
    });
}

export function useRechargeIOsByBusinessUnit(buId: string | undefined) {
    return useQuery<RechargeIOResponse[], Error>({
        queryKey: rechargeIOKeys.byBusinessUnit(buId || ''),
        queryFn: () => getRechargeIOsByBusinessUnit(buId!),
        enabled: !!buId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateRechargeIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: RechargeIOCreate) => createRechargeIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rechargeIOKeys.all });
        },
    });
}

export function useUpdateRechargeIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RechargeIOUpdate }) =>
            updateRechargeIO(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rechargeIOKeys.all });
        },
    });
}

export function useDeleteRechargeIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteRechargeIO(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rechargeIOKeys.all });
        },
    });
}

export function useFindOrCreateRechargeIO() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: RechargeIOCreate) => findOrCreateRechargeIO(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rechargeIOKeys.all });
        },
    });
}
