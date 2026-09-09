import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'indigo';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  id?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  id,
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    success: {
      container: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      dot: 'bg-emerald-500',
    },
    warning: {
      container: 'bg-amber-50 text-amber-800 border border-amber-200/80',
      dot: 'bg-amber-500',
    },
    danger: {
      container: 'bg-rose-50 text-rose-700 border border-rose-200/80',
      dot: 'bg-rose-500',
    },
    info: {
      container: 'bg-sky-50 text-sky-700 border border-sky-200/80',
      dot: 'bg-sky-500',
    },
    indigo: {
      container: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
      dot: 'bg-indigo-500',
    },
    neutral: {
      container: 'bg-slate-100 text-slate-700 border border-slate-200',
      dot: 'bg-slate-400',
    },
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap tracking-normal leading-none shrink-0 ${sizeStyles[size]} ${variantStyles[variant].container} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantStyles[variant].dot}`} />}
      <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">{children}</span>
    </span>
  );
};
