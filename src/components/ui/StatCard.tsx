import React from 'react';
import { Card } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  onClick?: () => void;
  id?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-indigo-50',
  iconColor = 'text-indigo-600',
  trend,
  onClick,
  id,
}) => {
  return (
    <Card
      id={id}
      onClick={onClick}
      className={`p-5 relative overflow-hidden transition-all ${
        onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-xs' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            {title}
          </span>
          <div className="text-2xl font-bold text-slate-900 tracking-tight font-display">
            {value}
          </div>
        </div>
        <div className={`p-2.5 rounded-xl ${iconBgColor} ${iconColor} shrink-0`}>
          {icon}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
          {trend && (
            <span
              className={`font-semibold shrink-0 ml-auto flex items-center gap-1 ${
                trend.isNeutral
                  ? 'text-slate-500'
                  : trend.isPositive
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
