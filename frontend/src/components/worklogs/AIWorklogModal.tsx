/**
 * AI WorkLog Modal Component
 * Modal wrapper for AI-assisted worklog entry with date selection
 */
import React from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/hooks/useFormatters';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AIWorklogInput } from './AIWorklogInput';

interface AIWorklogModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetDate: Date;
    onComplete?: () => void;
}

export const AIWorklogModal: React.FC<AIWorklogModalProps> = ({
    isOpen,
    onClose,
    targetDate,
    onComplete,
}) => {
    const { t } = useTranslation('worklogs');
    const { locale } = useFormatters();

    const handleComplete = () => {
        onComplete?.();
        onClose();
    };

    const formattedDate = format(targetDate, 'yyyy-MM-dd (EEE)', { locale });

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('modal.aiTitle')} - {formattedDate}</DialogTitle>
                </DialogHeader>
                <AIWorklogInput
                    targetDate={targetDate}
                    onComplete={handleComplete}
                />
            </DialogContent>
        </Dialog>
    );
};

export default AIWorklogModal;
