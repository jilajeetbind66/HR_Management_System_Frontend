import React from 'react';

export default function Card({ children, title, subtitle, action, className = '', headerClassName = '', bodyClassName = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden ${className}`}>
      {(title || subtitle || action) && (
        <div className={`px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${headerClassName}`}>
          <div>
            {title && <h3 className="font-semibold text-slate-800 text-sm sm:text-base">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`p-4 sm:p-6 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
