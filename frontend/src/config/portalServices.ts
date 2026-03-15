/**
 * Portal service definitions.
 *
 * tokenRelay:
 *   - "fragment" => https://<url>/#token=<jwt>&refresh=<refresh>
 *   - "query"    => https://<url>/?token=<jwt>&refresh=<refresh>  (Next.js SSR)
 *   - "none"     => https://<url>/                         (plain external link)
 */

export interface PortalService {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  tokenRelay: 'fragment' | 'query' | 'none';
  /** If true, navigates within EOB instead of opening a new tab */
  internal?: boolean;
}

export const PORTAL_SERVICES: PortalService[] = [
  {
    id: 'eob-dashboard',
    name: 'Engineering Operation Board',
    description: 'Edwards Operation Board - Project management, resource planning, and work tracking',
    url: '/dashboard',
    icon: 'LayoutDashboard',
    color: 'bg-blue-600',
    tokenRelay: 'fragment',
    internal: true,
  },
  {
    id: 'oqc',
    name: 'Outbound Quality Control',
    description: 'Outgoing Quality Control - Automated test execution and equipment commissioning',
    url: import.meta.env.VITE_OQC_URL || 'https://oqc.edwards.local',
    icon: 'ClipboardCheck',
    color: 'bg-emerald-600',
    tokenRelay: 'fragment',
  },
  {
    id: 'jarvis',
    name: 'IS Software Portal',
    description: 'Integrated Software Team - Jira and Confluence driven software delivery, release, sprint, and knowledge visibility portal',
    url: import.meta.env.VITE_JARVIS_URL || 'https://jarvis.edwards.local',
    icon: 'BrainCircuit',
    color: 'bg-purple-600',
    tokenRelay: 'query',
  },
  {
    id: 'testrig',
    name: 'Virtual TestRig',
    description: 'Virtual Testrig - Digital Twin product end-to-end integrated test bench service',
    url: import.meta.env.VITE_TESTRIG_URL || 'https://testrig.edwards.local',
    icon: 'Wrench',
    color: 'bg-amber-600',
    tokenRelay: 'fragment',
  },
  {
    id: 'pcas-software-portal',
    name: 'Software Request Desk',
    description: 'Software inquiry intake portal for NPI integrated systems and Abatement support, covering issues, troubleshooting, and new requirements.',
    url: 'https://ac-avi.atlassian.net/servicedesk/customer/portal/1',
    icon: 'ClipboardCheck',
    color: 'bg-rose-600',
    tokenRelay: 'none',
  },
];
