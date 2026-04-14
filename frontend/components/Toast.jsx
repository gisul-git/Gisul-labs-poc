'use client';
import { useState, useCallback } from 'react';

const COLORS = {
  success: 'bg-green-800 border-green-600 text-green-100',
  error:   'bg-red-900 border-red-700 text-red-100',
  info:    'bg-gray-800 border-gray-600 text-gray-100',
};

let _add = null;

export function toast(message, type = 'info') {
  _add?.(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  _add = useCallback((message, type) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`border rounded-lg px-4 py-3 text-sm shadow-lg ${COLORS[t.type] || COLORS.info}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
