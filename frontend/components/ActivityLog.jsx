'use client';
import { useState, useEffect } from 'react';
import { usageService } from '../lib/vmService';

const ACTION_COLORS = {
  start: 'text-green-400', stop: 'text-gray-400', restart: 'text-yellow-400',
  create: 'text-blue-400', delete: 'text-red-400', remove: 'text-red-400',
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    usageService.logs({ limit: 20 }).then(res => setLogs(res.data)).catch(() => {});
  }, []);

  if (!logs.length) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Recent Activity</h2>
      <div className="card divide-y divide-gray-800">
        {logs.map(log => (
          <div key={log.id} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className={`font-medium capitalize ${ACTION_COLORS[log.action] || 'text-gray-300'}`}>{log.action}</span>
              <span className="text-gray-400">VM {log.vmid}</span>
              {log.meta?.name && <span className="text-gray-500 text-xs">({log.meta.name})</span>}
            </div>
            <span className="text-xs text-gray-600">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
