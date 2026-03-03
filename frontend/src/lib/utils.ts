import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Returns the localized name based on the current language.
 * When language is 'ko', returns name_ko (falling back to name).
 * Otherwise, returns name (the English name).
 */
export function getLocalizedName(
    item: { name: string; name_ko?: string | null },
    language: string
): string {
    if (language === 'ko') {
        return item.name_ko || item.name;
    }
    return item.name;
}
