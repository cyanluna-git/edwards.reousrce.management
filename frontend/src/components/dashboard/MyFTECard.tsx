import { useTranslation } from 'react-i18next';
import { useMyFTE } from '@/hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MyFTEProjectItem } from '@/api/client';

interface MyFTECardProps {
  year: number;
  month: number;
}

// Category badge colors
const CATEGORY_COLORS: Record<string, string> = {
  PRODUCT: 'bg-blue-100 text-blue-700',
  FUNCTIONAL: 'bg-amber-100 text-amber-700',
  SUPPORT: 'bg-green-100 text-green-700',
};

// Utilization indicator
function UtilizationIndicator({ percent }: { percent: number | null }) {
  if (percent === null) return null;

  if (percent > 110) {
    return (
      <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
        <TrendingUp className="w-3 h-3" />
        {percent}%
      </span>
    );
  }
  if (percent < 80) {
    return (
      <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
        <TrendingDown className="w-3 h-3" />
        {percent}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
      <Minus className="w-3 h-3" />
      {percent}%
    </span>
  );
}

// Progress bar for planned projects
function FTEProgressBar({ item, t }: { item: MyFTEProjectItem; t: (key: string, options?: Record<string, unknown>) => string }) {
  const plannedPercent = item.planned_fte ? Math.min((item.planned_fte / 1.0) * 100, 100) : 0;
  const actualPercent = Math.min((item.actual_fte / 1.0) * 100, 100);
  const displayName = item.project_name || item.project_code || '-';

  return (
    <div className="py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm truncate" title={displayName}>
            {displayName}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-600'}`}
          >
            {item.category}
          </span>
          {item.project_code && (
            <span className="text-xs text-slate-400">{item.project_code}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {item.planned_fte !== null && (
            <span className="text-slate-500">{t('myFte.planned')} {item.planned_fte.toFixed(2)}</span>
          )}
          <span className="font-medium">{t('myFte.actual')} {item.actual_fte.toFixed(2)}</span>
          <UtilizationIndicator percent={item.utilization_percent} />
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-1">
        {item.planned_fte !== null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-8">{t('myFte.planned')}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-300 rounded-full transition-all duration-300"
                style={{ width: `${plannedPercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-8">{t('myFte.actual')}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item.utilization_percent && item.utilization_percent > 110
                  ? 'bg-red-500'
                  : item.utilization_percent && item.utilization_percent < 80
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
              }`}
              style={{ width: `${actualPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple row for unplanned/support projects
function FTESimpleRow({ item }: { item: MyFTEProjectItem }) {
  const displayName = item.project_name || item.project_code || '-';

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="truncate" title={displayName}>
          {displayName}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-600'}`}
        >
          {item.category}
        </span>
        {item.project_code && (
          <span className="text-xs text-slate-400">{item.project_code}</span>
        )}
      </div>
      <span className="font-medium">{item.actual_fte.toFixed(2)} FTE</span>
    </div>
  );
}

export function MyFTECard({ year, month }: MyFTECardProps) {
  const { t } = useTranslation('dashboard');
  const { data, isLoading, error } = useMyFTE(year, month);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('myFte.loading')}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-500">
          {t('myFte.loadFailed')}
        </CardContent>
      </Card>
    );
  }

  const { summary, product_functional, support } = data;
  const hasPlanned = product_functional.planned.length > 0;
  const hasUnplanned = product_functional.unplanned.length > 0;
  const hasSupport = support.length > 0;
  const hasNoData = !hasPlanned && !hasUnplanned && !hasSupport;

  // Calculate support total
  const supportTotalFTE = support.reduce((sum, item) => sum + item.actual_fte, 0);

  // Check for over-allocation warning
  const isOverAllocated = summary.actual_fte > 1.1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t('myFte.title', { year, month })}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-slate-500">{t('myFte.planned')}</span>{' '}
              <span className="font-semibold">{summary.planned_fte.toFixed(2)} FTE</span>
            </div>
            <div className="text-sm">
              <span className="text-slate-500">{t('myFte.actual')}</span>{' '}
              <span className="font-semibold">{summary.actual_fte.toFixed(2)} FTE</span>
            </div>
            {summary.utilization_percent !== null && (
              <UtilizationIndicator percent={summary.utilization_percent} />
            )}
            {isOverAllocated && (
              <span className="flex items-center gap-1 text-amber-600 text-xs">
                <AlertTriangle className="w-4 h-4" />
                {t('myFte.overAllocated')}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNoData ? (
          <div className="text-center py-6 text-muted-foreground">
            {t('myFte.noData')}
          </div>
        ) : (
          <>
            {/* Product / Functional Section */}
            {(hasPlanned || hasUnplanned) && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full" />
                  Product / Functional
                </h4>

                {/* Planned projects */}
                {hasPlanned && (
                  <div className="mb-3">
                    <div className="text-xs text-slate-500 mb-1 pl-3">{t('myFte.plannedLabel')}</div>
                    <div className="bg-slate-50 rounded-lg px-3">
                      {product_functional.planned.map((item) => (
                        <FTEProgressBar key={item.project_id} item={item} t={t} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Unplanned projects */}
                {hasUnplanned && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1 pl-3">{t('myFte.unplannedLabel')}</div>
                    <div className="bg-amber-50 rounded-lg px-3 py-1">
                      {product_functional.unplanned.map((item) => (
                        <FTESimpleRow key={item.project_id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Support Section */}
            {hasSupport && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded-full" />
                  Support
                </h4>
                <div className="bg-green-50 rounded-lg px-3 py-1">
                  {support.map((item) => (
                    <FTESimpleRow key={item.project_id} item={item} />
                  ))}
                  {support.length > 1 && (
                    <div className="flex items-center justify-between py-1.5 text-sm border-t border-green-200 mt-1">
                      <span className="text-slate-500">{t('myFte.subtotal')}</span>
                      <span className="font-semibold">{supportTotalFTE.toFixed(2)} FTE</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="bg-slate-100 rounded-lg p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{t('myFte.grandTotal')}</span>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-slate-500">{t('myFte.planned')}</span>{' '}
                  <span className="font-bold">{summary.planned_fte.toFixed(2)} FTE</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">{t('myFte.actual')}</span>{' '}
                  <span className="font-bold">{summary.actual_fte.toFixed(2)} FTE</span>
                </div>
                {summary.utilization_percent !== null && (
                  <span
                    className={`text-sm font-medium px-2 py-0.5 rounded ${
                      summary.utilization_percent > 110
                        ? 'bg-red-100 text-red-700'
                        : summary.utilization_percent < 80
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {summary.utilization_percent}%
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
