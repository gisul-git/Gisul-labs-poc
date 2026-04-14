'use client';
export default function StatsBar({ summary }) {
  if (!summary) return null;
  const stats = [
    { label: 'Total VMs',  value: summary.total,              color: 'text-gray-100' },
    { label: 'Running',    value: summary.running,            color: 'text-green-400' },
    { label: 'Stopped',    value: summary.stopped,            color: 'text-gray-400' },
    { label: 'Avg CPU',    value: `${summary.avgCpu}%`,       color: 'text-blue-400' },
    { label: 'RAM Used',   value: `${summary.memUsedGB} GB`,  color: 'text-purple-400' },
    { label: 'RAM Total',  value: `${summary.memTotalGB} GB`, color: 'text-gray-400' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className="card py-3 text-center">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
