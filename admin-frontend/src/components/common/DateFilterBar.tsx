import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface DateFilterBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  className?: string;
  compact?: boolean;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  selectedDate,
  onSelectDate,
  className = '',
  compact = false
}) => {
  const { t } = useTranslation();

  const isPreset = ['TODAY', 'YESTERDAY', 'WEEK', 'ALL'].includes(selectedDate);
  const isCustom = !isPreset && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate);

  const presets = [
    { key: 'TODAY', label: t('common.dateFilter.today') },
    { key: 'YESTERDAY', label: t('common.dateFilter.yesterday') },
    { key: 'WEEK', label: t('common.dateFilter.week') },
    { key: 'ALL', label: t('common.dateFilter.all') }
  ];

  return (
    <div className={`flex items-center flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-xs ${className}`}>
      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 pl-1 pr-1 font-mono text-[11px] font-semibold select-none flex-shrink-0">
        <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
        {!compact && <span className="hidden sm:inline">{t('common.dateFilter.label')}</span>}
      </div>

      <div className="flex items-center flex-wrap gap-1">
        {presets.map((preset) => {
          const isActive = selectedDate === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onSelectDate(preset.key)}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/80 dark:hover:bg-slate-700/60'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="relative flex items-center flex-shrink-0">
        <input
          type="date"
          value={isCustom ? selectedDate : ''}
          onChange={(e) => {
            if (e.target.value) {
              onSelectDate(e.target.value);
            }
          }}
          title={t('common.dateFilter.selectDate')}
          className={`px-2 py-0.5 text-xs font-mono rounded-md border transition-all duration-150 outline-none max-w-[135px] sm:max-w-none ${
            isCustom
              ? 'bg-blue-50 text-blue-800 border-blue-500 font-bold shadow-xs'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 focus:border-blue-500'
          }`}
        />
        {isCustom && (
          <button
            type="button"
            onClick={() => onSelectDate('TODAY')}
            title={t('common.cancel')}
            className="ml-1 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
