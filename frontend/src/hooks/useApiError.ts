import { useTranslation } from 'react-i18next';
import { getApiError } from '@/api/client';

/**
 * Hook that extracts API error and returns localized message.
 * Uses error code from backend to look up i18n translation.
 * Falls back to server-provided message if no translation found.
 */
export function useApiError() {
  const { t } = useTranslation('errors');

  return (error: unknown): string => {
    const apiError = getApiError(error);
    return t(`code.${apiError.code}`, { defaultValue: apiError.message });
  };
}
