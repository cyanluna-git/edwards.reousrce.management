/**
 * Portal service definitions.
 *
 * tokenRelay:
 *   - "fragment" => https://<url>/#token=<jwt>&refresh=<refresh>
 *   - "query"    => https://<url>/?token=<jwt>&refresh=<refresh>  (Next.js SSR)
 */

export interface PortalService {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  tokenRelay: 'fragment' | 'query';
  /** If true, navigates within EOB instead of opening a new tab */
  internal?: boolean;
}

export const PORTAL_SERVICES: PortalService[] = [
  {
    id: 'eob-dashboard',
    name: 'EOB Dashboard',
    description: 'Edwards Operation Board - Project management, resource planning, and work tracking',
    url: '/',
    icon: 'LayoutDashboard',
    color: 'bg-blue-600',
    tokenRelay: 'fragment',
    internal: true,
  },
  {
    id: 'oqc',
    name: 'OQC',
    description: 'Outgoing Quality Control - Automated test execution and equipment commissioning',
    url: import.meta.env.VITE_OQC_URL || 'https://oqc.edwards.local',
    icon: 'ClipboardCheck',
    color: 'bg-emerald-600',
    tokenRelay: 'fragment',
  },
  {
    id: 'jarvis',
    name: 'Jarvis',
    description: 'AI-powered analytics and intelligent reporting platform',
    url: import.meta.env.VITE_JARVIS_URL || 'https://jarvis.edwards.local',
    icon: 'BrainCircuit',
    color: 'bg-purple-600',
    tokenRelay: 'query',
  },
  {
    id: 'testrig',
    name: 'TestRig',
    description: 'Hardware test bench control and measurement data acquisition',
    url: import.meta.env.VITE_TESTRIG_URL || 'https://testrig.edwards.local',
    icon: 'Wrench',
    color: 'bg-amber-600',
    tokenRelay: 'fragment',
  },
];
