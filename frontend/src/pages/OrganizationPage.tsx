/**
 * OrganizationPage - Organization Management
 * Main page with tabs for Teams, Resources, Positions, and Hiring Plans
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamsTab } from '@/components/organization/TeamsTab';
import { ResourcesTab } from '@/components/organization/ResourcesTab';
import { PositionsTab } from '@/components/organization/PositionsTab';
import { HiringPlansTab } from '@/components/organization/HiringPlansTab';

type TabType = 'teams' | 'resources' | 'positions' | 'hiring';

export const OrganizationPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('teams');
    const { t } = useTranslation('organization');

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                {[
                    { id: 'teams' as TabType, label: t('tabs.teams') },
                    { id: 'resources' as TabType, label: t('tabs.resources') },
                    { id: 'positions' as TabType, label: t('tabs.positions') },
                    { id: 'hiring' as TabType, label: t('tabs.hiring') },
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
