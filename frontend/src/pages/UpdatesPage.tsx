import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    CURRENT_RELEASE_NOTE_VERSION,
    ReleaseNotesSections,
} from '@/components/layout/ReleaseNotesModal';

export function UpdatesPage() {
    const { t } = useTranslation('common');

    return (
        <div className="min-h-full bg-slate-50">
            <div className="mx-auto max-w-5xl space-y-6 p-6">
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                            <Sparkles className="h-4 w-4" />
                            <span>{t('releaseNotes.latestBadge')}</span>
                        </div>
                        <div className="grid gap-6 md:grid-cols-[1.6fr,1fr] md:items-end">
                            <div className="space-y-3">
                                <h1 className="text-3xl font-bold tracking-tight">
                                    {t('releaseNotes.pageTitle')}
                                </h1>
                                <p className="max-w-2xl text-sm leading-6 text-slate-200">
                                    {t('releaseNotes.pageDescription')}
                                </p>
                                <div className="rounded-xl border border-blue-400/30 bg-white/5 p-4">
                                    <div className="text-sm font-semibold text-blue-200">
                                        {t('releaseNotes.items.weeklyReports.title')}
                                    </div>
                                    <p className="mt-1 text-sm text-slate-200">
                                        {t('releaseNotes.items.weeklyReports.body')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-300">
                                    {t('releaseNotes.versionLabel')}
                                </div>
                                <div className="text-lg font-semibold">
                                    {CURRENT_RELEASE_NOTE_VERSION}
                                </div>
                                <p className="text-sm text-slate-300">
                                    {t('releaseNotes.tryItHint')}
                                </p>
                                <Button asChild className="w-full justify-between bg-white text-slate-900 hover:bg-slate-100">
                                    <Link to="/dashboard">
                                        {t('releaseNotes.goToWorklogs')}
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <ReleaseNotesSections />

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{t('releaseNotes.quickStartTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-900">1. {t('releaseNotes.quickStart.step1Title')}</div>
                            <p className="mt-1 text-sm text-slate-600">{t('releaseNotes.quickStart.step1Body')}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-900">2. {t('releaseNotes.quickStart.step2Title')}</div>
                            <p className="mt-1 text-sm text-slate-600">{t('releaseNotes.quickStart.step2Body')}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-900">3. {t('releaseNotes.quickStart.step3Title')}</div>
                            <p className="mt-1 text-sm text-slate-600">{t('releaseNotes.quickStart.step3Body')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default UpdatesPage;
