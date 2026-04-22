'use client';
import { useState, useEffect } from 'react';
import { labService } from '../lib/vmService';

const STATUS_STYLES = {
  completed: 'bg-green-900 text-green-300 border-green-800',
  running:   'bg-yellow-900 text-yellow-300 border-yellow-800',
  failed:    'bg-red-900 text-red-300 border-red-800',
  pending:   'bg-gray-800 text-gray-400 border-gray-700',
};

const STATUS_ICON = {
  completed: '✓',
  running:   '⟳',
  failed:    '✗',
  pending:   '○',
};

export default function LabSidebar({ vmId }) {
  const [session, setSession]         = useState(null);
  const [lab, setLab]                 = useState(null);
  const [stepStatus, setStepStatus]   = useState({}); // stepId -> 'pending'|'running'|'completed'|'failed'
  const [expanded, setExpanded]       = useState(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!vmId) return;
    labService.getSession(vmId)
      .then(res => {
        setSession(res.data);
        setLab(res.data.labId);
        // Seed completed steps from DB
        const initial = {};
        res.data.labId.steps.forEach(s => {
          initial[s.stepId] = res.data.completedSteps.includes(s.stepId) ? 'completed' : 'pending';
        });
        setStepStatus(initial);
      })
      .catch(() => setError('No active lab session for this VM.'))
      .finally(() => setLoading(false));
  }, [vmId]);

  async function handleExecute(step) {
    setStepStatus(prev => ({ ...prev, [step.stepId]: 'running' }));
    setError('');
    try {
      const res = await labService.executeStep(vmId, step.stepId);
      if (res.data.status === 'success' || res.data.status === 'already_completed') {
        setStepStatus(prev => ({ ...prev, [step.stepId]: 'completed' }));
        // Refresh session to sync completedSteps
        const updated = await labService.getSession(vmId);
        setSession(updated.data);
      }
    } catch (err) {
      setStepStatus(prev => ({ ...prev, [step.stepId]: 'failed' }));
      setError(err.response?.data?.error || 'Step execution failed');
    }
  }

  if (loading) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex items-center justify-center text-gray-500 text-sm">
        Loading lab...
      </div>
    );
  }

  if (error && !lab) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 text-gray-500 text-sm">
        <p className="text-gray-400 font-medium mb-1">No Lab Active</p>
        <p>{error}</p>
      </div>
    );
  }

  const completedCount = Object.values(stepStatus).filter(s => s === 'completed').length;
  const totalCount = lab?.steps?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lab Instructions</p>
        <h2 className="text-sm font-semibold text-gray-100 leading-tight">{lab?.title}</h2>
        <p className="text-xs text-gray-500 mt-1">{lab?.description}</p>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{completedCount}/{totalCount} steps</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {lab?.steps?.map((step, idx) => {
          const status = stepStatus[step.stepId] || 'pending';
          const isExpanded = expanded === step.stepId;
          const isDone = status === 'completed';
          const isRunning = status === 'running';

          return (
            <div
              key={step.stepId}
              className={`rounded-lg border transition-colors ${STATUS_STYLES[status]}`}
            >
              {/* Step header */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                onClick={() => setExpanded(isExpanded ? null : step.stepId)}
              >
                <span className="text-base w-5 text-center flex-shrink-0">
                  {isRunning
                    ? <span className="inline-block animate-spin">⟳</span>
                    : STATUS_ICON[status]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    Step {idx + 1}: {step.title}
                  </p>
                </div>
                <span className="text-xs opacity-60">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-current border-opacity-20 pt-2">
                  {/* Instructions */}
                  <div className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                    {step.instructions || 'No additional instructions.'}
                  </div>

                  {/* Command preview */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Command (PowerShell):</p>
                    <pre className="text-xs bg-black/40 rounded p-2 overflow-x-auto text-green-400 whitespace-pre-wrap break-all">
                      {step.command}
                    </pre>
                  </div>

                  {/* Execute button */}
                  {!isDone && (
                    <button
                      className="w-full text-xs py-1.5 px-3 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: isRunning ? '#374151' : '#2563eb' }}
                      onClick={() => handleExecute(step)}
                      disabled={isRunning}
                    >
                      {isRunning ? 'Running...' : '▶ Execute Step'}
                    </button>
                  )}
                  {isDone && (
                    <p className="text-xs text-green-400 text-center">✓ Completed</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-t border-red-800 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Lab complete banner */}
      {session?.status === 'completed' && (
        <div className="px-4 py-3 bg-green-900/40 border-t border-green-800 text-green-300 text-xs text-center font-medium">
          🎉 Lab Complete!
        </div>
      )}
    </div>
  );
}
