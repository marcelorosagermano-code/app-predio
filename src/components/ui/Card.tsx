import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', id, ...props }) => {
  return (
    <div
      id={id}
      className={`bg-white rounded-xl border border-slate-200/90 shadow-2xs transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '', id, ...props }) => {
  return (
    <div
      id={id}
      className={`p-5 pb-4 border-b border-slate-100 flex flex-col gap-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  id,
  ...props
}) => {
  return (
    <h3
      id={id}
      className={`text-base font-semibold text-slate-900 tracking-tight flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  id,
  ...props
}) => {
  return (
    <p id={id} className={`text-xs text-slate-500 font-normal leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className = '', id, ...props }) => {
  return (
    <div id={id} className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ children, className = '', id, ...props }) => {
  return (
    <div
      id={id}
      className={`p-4 px-5 bg-slate-50/60 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
