import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

const data = [
  { subject: 'Food', A: 120, fullMark: 150 },
  { subject: 'Nature', A: 98, fullMark: 150 },
  { subject: 'Culture', A: 86, fullMark: 150 },
  { subject: 'Shopping', A: 99, fullMark: 150 },
  { subject: 'Adventure', A: 85, fullMark: 150 },
  { subject: 'Relaxation', A: 65, fullMark: 150 },
];

export const SpotDiversityVisualization = () => {
  return (
    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
      <h3 className="font-bold text-lg text-slate-900 mb-4">Spot Diversity</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
            <Radar
              name="Trip Style"
              dataKey="A"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
