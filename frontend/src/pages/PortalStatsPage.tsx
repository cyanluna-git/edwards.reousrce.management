import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { apiClient } from '@/api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowLeft, Users, Activity, BarChart3, Clock } from 'lucide-react';

interface TopUser {
  user_id: string;
  name: string;
  count: number;
}

interface HourlyActivity {
  hour: number;
  count: number;
}

interface PortalStats {
  service_counts: Record<string, number>;
  top_users: TopUser[];
  hourly_activity: HourlyActivity[];
}

const SERVICE_COLORS: Record<string, string> = {
  eob: '#2563eb',
  oqc: '#059669',
  jarvis: '#7c3aed',
  testrig: '#d97706',
};

const SERVICE_LABELS: Record<string, string> = {
  eob: 'EOB Dashboard',
  oqc: 'OQC',
  jarvis: 'Jarvis',
  testrig: 'TestRig',
};

export default function PortalStatsPage() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    apiClient.get('/portal/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-lg text-slate-500">Access denied.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-red-500">{error || 'No data'}</p>
        <button onClick={() => navigate('/portal')} className="text-sm text-slate-500 underline">
          Back to Portal
        </button>
      </div>
    );
  }

  const totalAccess = Object.values(stats.service_counts).reduce((a, b) => a + b, 0);

  const pieData = Object.entries(stats.service_counts).map(([key, value]) => ({
    name: SERVICE_LABELS[key] || key,
    value,
    color: SERVICE_COLORS[key] || '#94a3b8',
  }));

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const found = stats.hourly_activity.find((h) => h.hour === i);
    return { hour: `${i.toString().padStart(2, '0')}:00`, count: found?.count || 0 };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/portal')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Portal Usage Statistics</h1>
          <p className="text-sm text-slate-500">Last 30 days</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Activity className="h-5 w-5" />} label="Total Access" value={totalAccess} color="text-red-500" bg="bg-red-50" />
        <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="Services Used" value={Object.keys(stats.service_counts).length} color="text-blue-500" bg="bg-blue-50" />
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Active Users" value={stats.top_users.length} color="text-emerald-500" bg="bg-emerald-50" />
        <SummaryCard icon={<Clock className="h-5 w-5" />} label="Peak Hour" value={getPeakHour(stats.hourly_activity)} color="text-amber-500" bg="bg-amber-50" isText />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Usage Pie */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Service Usage</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Activity Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Hourly Activity (UTC)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Users Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Top Users</h2>
        {stats.top_users.length === 0 ? (
          <p className="text-sm text-slate-400">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Rank</th>
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 text-right">Access Count</th>
                  <th className="pb-3 pl-6">Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_users.map((u, i) => (
                  <tr key={u.user_id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-400">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-slate-800">{u.name || u.user_id}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{u.count}</td>
                    <td className="py-3 pl-6">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${totalAccess ? (u.count / totalAccess) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {totalAccess ? Math.round((u.count / totalAccess) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color, bg, isText }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; bg: string; isText?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 ${isText ? 'text-xl' : 'text-2xl'} font-semibold tracking-tight text-slate-950`}>{value}</p>
    </div>
  );
}

function getPeakHour(activity: HourlyActivity[]): string {
  if (!activity.length) return '--';
  const peak = activity.reduce((max, h) => (h.count > max.count ? h : max), activity[0]);
  return `${peak.hour.toString().padStart(2, '0')}:00`;
}
