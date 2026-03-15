import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { acknowledgeReleaseNotes } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';

export const CURRENT_RELEASE_NOTE_VERSION = '2026-03-weekly-report-and-portal';

export function ReleaseNotesSections() {
    const { t } = useTranslation('common');

    return (
        <div className="space-y-4">
            <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5">
                <h3 className="text-base font-semibold text-slate-900">
                    {t('releaseNotes.items.weeklyReports.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    {t('releaseNotes.items.weeklyReports.body')}
                </p>
                <div className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    {t('releaseNotes.items.weeklyReports.highlight')}
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                    {t('releaseNotes.items.aiSummary.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    {t('releaseNotes.items.aiSummary.body')}
                </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                    {t('releaseNotes.items.portal.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    {t('releaseNotes.items.portal.body')}
                </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                    {t('releaseNotes.items.navigation.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    {t('releaseNotes.items.navigation.body')}
                </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                    {t('releaseNotes.items.aiWorklog.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    {t('releaseNotes.items.aiWorklog.body')}
                </p>
            </section>
        </div>
    );
}

export function ReleaseNotesModal() {
    const { user } = useAuth();
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const ackStartedRef = useRef(false);

    const shouldShow = Boolean(
        user &&
        !dismissed &&
        user.seen_release_note_version !== CURRENT_RELEASE_NOTE_VERSION
    );

    useEffect(() => {
        if (shouldShow) {
            setOpen(true);
        }
    }, [shouldShow]);

    const acknowledgeAndClose = async () => {
        if (!user || ackStartedRef.current) {
            setOpen(false);
            setDismissed(true);
            return;
        }

        ackStartedRef.current = true;
        setIsSaving(true);
        setOpen(false);
        setDismissed(true);

        try {
            await acknowledgeReleaseNotes(CURRENT_RELEASE_NOTE_VERSION);
        } catch {
            // Keep the UI non-blocking; the modal may reappear on a future login if save fails.
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    void acknowledgeAndClose();
                    return;
                }
                setOpen(nextOpen);
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('releaseNotes.title')}</DialogTitle>
                    <DialogDescription>{t('releaseNotes.description')}</DialogDescription>
                </DialogHeader>

                <ReleaseNotesSections />

                <DialogFooter>
                    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button asChild variant="outline">
                            <Link to="/updates">{t('releaseNotes.viewFullHistory')}</Link>
                        </Button>
                        <Button onClick={() => void acknowledgeAndClose()} disabled={isSaving}>
                            {t('releaseNotes.confirm')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ReleaseNotesHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReleaseNotesHistoryDialog({
    open,
    onOpenChange,
}: ReleaseNotesHistoryDialogProps) {
    const { user } = useAuth();
    const { t } = useTranslation('common');

    if (!user) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('releaseNotes.title')}</DialogTitle>
                    <DialogDescription>{t('releaseNotes.description')}</DialogDescription>
                </DialogHeader>

                <ReleaseNotesSections />

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>
                        {t('buttons.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
