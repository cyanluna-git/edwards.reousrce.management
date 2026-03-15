import { useAuth } from '@/hooks/useAuth';
import { PORTAL_SERVICES } from '@/config/portalServices';
import { ServiceCard } from '@/components/portal/ServiceCard';

export function PortalPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Service Portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.name
            ? `Welcome, ${user.name}. Select a service to get started.`
            : 'Select a service to get started.'}
        </p>
      </div>

      {/* Service Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {PORTAL_SERVICES.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  );
}

export default PortalPage;
