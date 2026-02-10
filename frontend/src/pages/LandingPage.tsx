import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  ClipboardList,
  Eye,
  Clock,
  Calendar,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

// Reusable fade-in section wrapper
function FadeInSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, isVisible } = useIntersectionObserver();
  return (
    <div
      ref={ref}
      className={`fade-in-section ${isVisible ? 'visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// Mock UI Components
function WorklogMockUI({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="text-xs font-medium text-slate-600 mb-2">{label}</div>
      <div className="space-y-2">
        <div className="h-7 bg-slate-100 rounded flex items-center px-2">
          <div className="h-2 w-16 bg-blue-300 rounded" />
        </div>
        <div className="h-7 bg-slate-100 rounded flex items-center px-2">
          <div className="h-2 w-20 bg-green-300 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 flex-1 bg-slate-100 rounded" />
          <div className="h-7 w-16 bg-blue-500 rounded" />
        </div>
      </div>
    </div>
  );
}

function ResourceMatrixMockUI({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="text-xs font-medium text-slate-600 mb-2">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {['Jan', 'Feb', 'Mar', 'Apr'].map((m) => (
          <div key={m} className="text-[8px] text-slate-400 text-center">
            {m}
          </div>
        ))}
        {[0.8, 0.6, 1.0, 0.4, 0.5, 0.9, 0.7, 0.3].map((v, i) => (
          <div
            key={i}
            className="h-5 rounded"
            style={{
              backgroundColor: `rgba(59, 130, 246, ${v})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineMockUI({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="text-xs font-medium text-slate-600 mb-2">{label}</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <div className="h-2 flex-1 bg-green-200 rounded" />
          <span className="text-[8px] text-slate-400">G3</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <div className="h-2 w-3/4 bg-blue-200 rounded" />
          <span className="text-[8px] text-slate-400">G5</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <div className="h-2 w-1/2 bg-slate-100 rounded" />
          <span className="text-[8px] text-slate-400">G6</span>
        </div>
      </div>
    </div>
  );
}

function DashboardMockUI({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="text-xs font-medium text-slate-600 mb-2">{label}</div>
      <div className="flex gap-1.5 mb-2">
        <div className="h-2 w-12 bg-blue-400 rounded" />
        <div className="h-2 w-8 bg-green-400 rounded" />
        <div className="h-2 w-6 bg-amber-400 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}

function AISummaryMockUI({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white shadow-lg p-3 w-56">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-purple-500" />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-purple-100 rounded" />
        <div className="h-2 w-4/5 bg-purple-100 rounded" />
        <div className="h-2 w-3/4 bg-purple-100 rounded" />
      </div>
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <div className="h-1.5 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  mockUI: React.ReactNode;
}

function FeatureCard({ icon, title, description, mockUI }: FeatureCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-6 hover:shadow-2xl transition-shadow duration-300">
      <div className="flex items-start gap-4 mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex justify-center pt-2">{mockUI}</div>
    </div>
  );
}

// Problem card component
interface ProblemCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ProblemCard({ icon, title, description }: ProblemCardProps) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

// Step component
interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation('auth');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 relative">
        <div className="text-center max-w-3xl mx-auto">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-8 shadow-xl shadow-blue-500/30">
            <BarChart3 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>

          {/* Headlines */}
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            {t('landing.heroTitle')}
            <br />
            <span className="text-blue-600">{t('landing.heroSubtitle')}</span>
          </h1>
          <p className="text-xl text-slate-600 mb-3">
            {t('landing.heroTagline')}
          </p>
          <p className="text-base text-slate-500 mb-8 max-w-xl mx-auto">
            {t('landing.heroDescription')}
          </p>

          {/* CTA Button */}
          <Link to="/login">
            <Button className="h-14 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 text-lg transition-all duration-200">
              {t('landing.login')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ChevronDown className="w-8 h-8 text-slate-400 animate-bounce-down" />
        </div>
      </section>

      {/* Problem Statement Section */}
      <FadeInSection>
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
              {t('landing.problemsTitle')}
            </h2>
            <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
              {t('landing.problemsSubtitle')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ProblemCard
                icon={
                  <FileSpreadsheet className="w-8 h-8 text-red-500" />
                }
                title={t('landing.scatteredData')}
                description={t('landing.scatteredDataDesc')}
              />
              <ProblemCard
                icon={<ClipboardList className="w-8 h-8 text-red-500" />}
                title={t('landing.manualTracking')}
                description={t('landing.manualTrackingDesc')}
              />
              <ProblemCard
                icon={<Eye className="w-8 h-8 text-red-500" />}
                title={t('landing.limitedVisibility')}
                description={t('landing.limitedVisibilityDesc')}
              />
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Feature Showcase Section */}
      <FadeInSection>
        <section className="py-20 px-4 bg-white/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Clock className="w-6 h-6 text-white" />}
                title={t('landing.worklogTracking')}
                description={t('landing.worklogTrackingDesc')}
                mockUI={<WorklogMockUI label={t('landing.mockWorklogEntry')} />}
              />
              <FeatureCard
                icon={<Calendar className="w-6 h-6 text-white" />}
                title={t('landing.resourceForecasting')}
                description={t('landing.resourceForecastingDesc')}
                mockUI={<ResourceMatrixMockUI label={t('landing.mockResourceMatrix')} />}
              />
              <FeatureCard
                icon={<FolderKanban className="w-6 h-6 text-white" />}
                title={t('landing.projectManagement')}
                description={t('landing.projectManagementDesc')}
                mockUI={<TimelineMockUI label={t('landing.mockProjectTimeline')} />}
              />
              <FeatureCard
                icon={<LayoutDashboard className="w-6 h-6 text-white" />}
                title={t('landing.teamDashboard')}
                description={t('landing.teamDashboardDesc')}
                mockUI={<DashboardMockUI label={t('landing.mockTeamDashboard')} />}
              />
              <FeatureCard
                icon={<Sparkles className="w-6 h-6 text-white" />}
                title={t('landing.aiWeeklySummary')}
                description={t('landing.aiWeeklySummaryDesc')}
                mockUI={<AISummaryMockUI label={t('landing.mockAiSummary')} />}
              />
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* How It Works Section */}
      <FadeInSection>
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
              {t('landing.howToUseTitle')}
            </h2>
            <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
              {t('landing.howToUseSubtitle')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Step
                number={1}
                title={t('landing.step1Title')}
                description={t('landing.step1Desc')}
              />
              <Step
                number={2}
                title={t('landing.step2Title')}
                description={t('landing.step2Desc')}
              />
              <Step
                number={3}
                title={t('landing.step3Title')}
                description={t('landing.step3Desc')}
              />
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Footer Section */}
      <FadeInSection>
        <section className="py-16 px-4 bg-slate-800">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-6">
              {t('landing.ctaTitle')}
            </h2>
            <Link to="/login">
              <Button className="h-12 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-xl shadow-lg transition-all duration-200">
                {t('landing.login')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-slate-400 text-sm mt-8">
              {t('common:footer.copyright', { year: new Date().getFullYear() })}
            </p>
          </div>
        </section>
      </FadeInSection>
    </div>
  );
}
