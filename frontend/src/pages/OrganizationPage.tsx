/**
 * OrganizationPage - Organization Management
 * Main page with tabs for Teams, Resources, Positions, and Hiring Plans
 */
import React, { useState } from 'react';
import { TeamsTab } from '@/components/organization/TeamsTab';
import { ResourcesTab } from '@/components/organization/ResourcesTab';
import { PositionsTab } from '@/components/organization/PositionsTab';
import { HiringPlansTab } from '@/components/organization/HiringPlansTab';

type TabType = 'teams' | 'resources' | 'positions' | 'hiring';

export const OrganizationPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('teams');

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">조직 관리</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                {[
                    { id: 'teams' as TabType, label: 'Teams' },
                    { id: 'resources' as TabType, label: 'Resources' },
                    { id: 'positions' as TabType, label: 'Job Positions' },
                    { id: 'hiring' as TabType, label: 'Hiring Plans' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        className={`px-4 py-2 -mb-px ${activeTab === tab.id
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'teams' && <TeamsTab />}
            {activeTab === 'resources' && <ResourcesTab />}
            {activeTab === 'positions' && <PositionsTab />}
            {activeTab === 'hiring' && <HiringPlansTab />}
        </div>
    );
};

export default OrganizationPage;
