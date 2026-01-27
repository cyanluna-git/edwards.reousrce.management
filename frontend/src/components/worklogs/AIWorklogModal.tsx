/**
 * AI WorkLog Modal Component
 * Modal wrapper for AI-assisted worklog entry with date selection
 */
import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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
    const handleComplete = () => {
        onComplete?.();
        onClose();
    };

    const formattedDate = format(targetDate, 'yyyy-MM-dd (EEE)', { locale: ko });

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>AI 업무 입력 - {formattedDate}</DialogTitle>
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
