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

const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/** Map icon name string to Lucide component */
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  ClipboardCheck,
  BrainCircuit,
  Wrench,
};

function buildRelayUrl(
  baseUrl: string,
  tokenRelay: 'fragment' | 'query',
  accessToken: string,
  refreshToken: string,
): string {
  const params = `token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`;
  if (tokenRelay === 'query') {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${params}`;
  }
  return `${baseUrl}#${params}`;
}

interface ServiceCardProps {
  service: PortalService;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[service.icon] || LayoutDashboard;

  const handleClick = async () => {
    // Log access (fire-and-forget, do not block navigation on failure)
    apiClient
      .post('/portal/access-log', { service_id: service.id })
      .catch(() => {
        // Access log is best-effort; silently ignore errors
      });

    if (service.internal) {
      navigate(service.url);
      return;
    }

    const accessToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || '';
    const relayUrl = buildRelayUrl(service.url, service.tokenRelay, accessToken, refreshToken);
    window.open(relayUrl, '_blank', 'noopener');
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group relative flex flex-col items-start gap-4 rounded-xl border bg-card p-6 text-left shadow transition-all',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
      )}
    >
      {/* Icon badge */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg text-white',
          service.color,
        )}
      >
        <Icon className="h-6 w-6" />
      </div>

      {/* Text */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold leading-none tracking-tight text-foreground">
          {service.name}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {service.description}
        </p>
      </div>

      {/* External link indicator */}
      {!service.internal && (
        <ExternalLink className="absolute right-4 top-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
