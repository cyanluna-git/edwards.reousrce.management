import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  BrainCircuit,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/api/client';
import type { PortalService } from '@/config/portalServices';

/** Map icon name string to Lucide component */
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  ClipboardCheck,
  BrainCircuit,
  Wrench,
};

interface ServiceCardProps {
  service: PortalService;
}

/**
 * Build a URL with the current user's JWT tokens appended.
 * - 'fragment' → https://host/#token=<at>&refresh=<rt>
 * - 'query'    → https://host/?token=<at>&refresh=<rt>
 * - 'none'     → https://host/
 */
function buildRelayUrl(base: string, relay: PortalService['tokenRelay']): string {
  if (relay === 'none') return base;
  const at = localStorage.getItem('authToken');
  if (!at) return base;
  const rt = localStorage.getItem('refreshToken') || '';
  const params = `token=${encodeURIComponent(at)}&refresh=${encodeURIComponent(rt)}`;
  return relay === 'query' ? `${base}?${params}` : `${base}#${params}`;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[service.icon] || LayoutDashboard;

  const logAccess = () => {
    apiClient.post('/portal/access-log', { service_id: service.id }).catch(() => {});
  };

  if (service.internal) {
    return (
      <button
        onClick={() => { logAccess(); navigate(service.url); }}
        className={cn(
          'group relative flex min-h-[220px] flex-col items-start gap-6 overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/90 p-7 text-left shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] transition-all',
          'hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_28px_70px_-38px_rgba(127,29,29,0.24)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
        )}
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.12),transparent_48%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.04),transparent_45%)]" />
        <div className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm ring-1 ring-black/5', service.color)}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="relative space-y-2">
          <h3 className="text-xl font-semibold leading-none tracking-tight text-slate-950">{service.name}</h3>
          <p className="text-sm leading-7 text-slate-600">{service.description}</p>
        </div>
      </button>
    );
  }

  const href = buildRelayUrl(service.url, service.tokenRelay);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={logAccess}
      className={cn(
        'group relative flex min-h-[220px] flex-col items-start gap-6 overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/90 p-7 text-left shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] transition-all',
        'hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_28px_70px_-38px_rgba(127,29,29,0.24)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
      )}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.12),transparent_48%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.04),transparent_45%)]" />
      <div className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm ring-1 ring-black/5', service.color)}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="relative space-y-2">
        <h3 className="text-xl font-semibold leading-none tracking-tight text-slate-950">{service.name}</h3>
        <p className="text-sm leading-7 text-slate-600">{service.description}</p>
      </div>
      <ExternalLink className="absolute right-5 top-5 h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}
