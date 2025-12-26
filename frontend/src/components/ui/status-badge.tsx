import { STATUS_COLORS } from '@/lib/constants';

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

/**
 * Reusable status badge component for project/resource statuses
 * Consolidates duplicated StatusBadge implementations across pages
 */
export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
    };

    return (
        <span
            className={`rounded-full font-medium ${colors.bg} ${colors.text} border border-opacity-20 ${sizeClasses[size]}`}
        >
            {status}
        </span>
    );
}

export default StatusBadge;
