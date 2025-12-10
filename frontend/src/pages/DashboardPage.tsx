import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    FolderKanban,
    Users,
    Clock,
    TrendingUp,
    AlertCircle,
} from 'lucide-react'

const stats = [
    {
        title: 'Active Projects',
        value: '24',
        change: '+2 this month',
        icon: FolderKanban,
        color: 'bg-blue-500',
    },
    {
        title: 'Team Members',
        value: '124',
        change: '98 active',
        icon: Users,
        color: 'bg-green-500',
    },
    {
        title: 'Hours Logged (MTD)',
        value: '3,842',
        change: '+12% vs last month',
        icon: Clock,
        color: 'bg-purple-500',
    },
    {
        title: 'TBD Positions',
        value: '8',
        change: 'Needs assignment',
        icon: AlertCircle,
        color: 'bg-amber-500',
    },
]

export function DashboardPage() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500">
                    Welcome to Edwards Project Operation Board
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {stat.title}
                            </CardTitle>
                            <div className={`rounded-lg p-2 ${stat.color}`}>
                                <stat.icon className="h-4 w-4 text-white" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-slate-500">{stat.change}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main content area */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Projects */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5" />
                            Recent Projects
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { name: 'EUV Gen4 Tumalo', status: 'WIP', progress: 65 },
                                { name: 'Havasu', status: 'WIP', progress: 40 },
                                { name: 'Ruby - SIC integration', status: 'WIP', progress: 80 },
                                { name: 'Protron Dual CVD', status: 'Hold', progress: 30 },
                            ].map((project) => (
                                <div key={project.name} className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium">{project.name}</p>
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs ${project.status === 'WIP'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}
                                            >
                                                {project.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                                            <div
                                                className="h-2 rounded-full bg-blue-500"
                                                style={{ width: `${project.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Team Capacity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Team Capacity (This Month)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { team: 'Control Engineering', capacity: 85, members: 15 },
                                { team: 'NPI Abatement', capacity: 92, members: 22 },
                                { team: 'ETO', capacity: 78, members: 8 },
                                { team: 'Central Engineering', capacity: 65, members: 12 },
                            ].map((team) => (
                                <div key={team.team} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{team.team}</span>
                                        <span className="text-slate-500">
                                            {team.members} members · {team.capacity}% utilized
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-100">
                                        <div
                                            className={`h-2 rounded-full ${team.capacity > 90
                                                    ? 'bg-red-500'
                                                    : team.capacity > 75
                                                        ? 'bg-amber-500'
                                                        : 'bg-green-500'
                                                }`}
                                            style={{ width: `${team.capacity}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
