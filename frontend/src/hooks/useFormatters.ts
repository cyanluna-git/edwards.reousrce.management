import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format as dateFnsFormat, parseISO, type Locale } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { enUS } from 'date-fns/locale/en-US';

const localeMap: Record<string, Locale> = { ko, en: enUS };

export function useFormatters() {
  const { i18n } = useTranslation();
  const locale = localeMap[i18n.language] ?? enUS;

  const formatDate = useCallback(
    (date: Date | string, fmt = 'yyyy-MM-dd') => {
      const d = typeof date === 'string' ? parseISO(date) : date;
      return dateFnsFormat(d, fmt, { locale });
    },
    [locale],
  );

  const formatHours = useCallback(
    (value: number) => `${value.toFixed(0)}h`,
    [],
  );

  const formatFTE = useCallback(
    (value: number, decimals = 2) => `${value.toFixed(decimals)} FTE`,
    [],
  );

  const formatPercent = useCallback(
    (value: number) => `${Math.round(value)}%`,
    [],
  );

  const formatNumber = useCallback(
    (value: number, decimals = 0) =>
      value.toLocaleString(i18n.language, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [i18n.language],
  );

  const formatPersonCount = useCallback(
    (count: number) => (i18n.language === 'ko' ? `${count}명` : `${count}`),
    [i18n.language],
  );

  return {
    locale,
    formatDate,
    formatHours,
    formatFTE,
    formatPercent,
    formatNumber,
    formatPersonCount,
  };
}
