import React from 'react';

export default function StatCard({
  title,
  value,
  subvalue,
  icon: Icon,
  trend,
  trendPositive = true,
  color = 'indigo',
  badge,
  className = ''
}) {
  const colorMap = {
    teal: {
      bg: 'bg-teal-50/80',
      text: 'text-teal-600',
      border: 'border-teal-100'
    },
    indigo: {
      bg: 'bg-indigo-50/80',
      text: 'text-indigo-600',
      border: 'border-indigo-100'
    },
    emerald: {
      bg: 'bg-emerald-50/80',
      text: 'text-emerald-600',
      border: 'border-emerald-100'
    },
    amber: {
      bg: 'bg-amber-50/80',
      text: 'text-amber-600',
      border: 'border-amber-100'
    },
    rose: {
      bg: 'bg-rose-50/80',
      text: 'text-rose-600',
      border: 'border-rose-100'
    },
    purple: {
      bg: 'bg-purple-50/80',
      text: 'text-purple-600',
      border: 'border-purple-100'
    },
    blue: {
      bg: 'bg-blue-50/80',
      text: 'text-blue-600',
      border: 'border-blue-100'
    }
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${scheme.bg} ${scheme.text} ${scheme.border} border`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
          {badge && <span className="text-xs font-medium text-slate-400">{badge}</span>}
        </div>
        
        {(subvalue || trend) && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs">
            {trend && (
              <span className={`font-semibold ${trendPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend}
              </span>
            )}
            {subvalue && <span className="text-slate-500">{subvalue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
