'use client';
import { useState, useEffect } from 'react';
import { labService } from '../lib/vmService';

export default function LabSidebar({ vmId }) {
  const [session, setSession]       = useState(null);
  const [lab, setLab]               = useState(null);
  const [stepStatus, setStepStatus] = useState({});
  const [expanded, setExpanded]     = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!vmId) return;
    labService.getSession(vmId)
      .then(res => {
        setSession(res.data);
        setLab(res.data.labId);
        const initial = {};
        res.data.labId.steps.forEach(s => {
          initial[s.stepId] = res.data.completedSteps.includes(s.stepId) ? 'completed' : 'pending';
        });
        setStepStatus(initial);
        // Auto-expand first incomplete step
        const first = res.data.labId.steps.find(s => !res.data.completedSteps.includes(s.stepId));
        if (first) setExpanded(first.stepId);
      })
      .catch(() => setError('No active lab session for this VM.'))
      .finally(() => setLoading(false));
  }, [vmId]);

  async function handleManualCheck(step) {
    if (stepStatus[step.stepId] === 'completed') return;
    setStepStatus(prev => ({ ...prev, [step.stepId]: 'completed' }));
    try {
      await labService.executeStep(vmId, step.stepId);
      const updated = await labService.getSession(vmId);
      setSession(updated.data);
    } catch {
      // revert if failed
      setStepStatus(prev => ({ ...prev, [step.stepId]: 'pending' }));
    }
  }

  async function handleExecute(step) {
    setStepStatus(prev => ({ ...prev, [step.stepId]: 'running' }));
    setError('');
    try {
      const res = await labService.executeStep(vmId, step.stepId);
      if (res.data.status === 'success' || res.data.status === 'already_completed') {
        setStepStatus(prev => ({ ...prev, [step.stepId]: 'completed' }));
        const updated = await labService.getSession(vmId);
        setSession(updated.data);
        // Auto-expand next incomplete step
        const next = lab.steps.find(s =>
          !updated.data.completedSteps.includes(s.stepId) && s.stepId !== step.stepId
        );
        if (next) setExpanded(next.stepId);
      }
    } catch (err) {
      setStepStatus(prev => ({ ...prev, [step.stepId]: 'failed' }));
      setError(err.response?.data?.error || 'Step execution failed');
    }
  }

  if (loading) return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex items-center justify-center text-gray-500 text-sm">
      Loading lab...
    </div>
  );

  if (error && !lab) return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 text-gray-500 text-sm">
      <p className="text-gray-400 font-medium mb-1">No Lab Active</p>
      <p>{error}</p>
    </div>
  );

  const completedCount = Object.values(stepStatus).filter(s => s === 'completed').length;
  const totalCount = lab?.steps?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const labComplete = session?.status === 'completed' || completedCount === totalCount;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lab Instructions</p>
        <h2 className="text-sm font-semibold text-gray-100 leading-tight">{lab?.title}</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{lab?.description}</p>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{completedCount}/{totalCount} steps</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1 text-right">{progressPct}%</p>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {lab?.steps?.map((step, idx) => {
          const status    = stepStatus[step.stepId] || 'pending';
          const isDone    = status === 'completed';
          const isRunning = status === 'running';
          const isFailed  = status === 'failed';
          const isManual  = step.type === 'manual';
          const isExpanded = expanded === step.stepId;

          return (
            <div
              key={step.stepId}
              className={`rounded-lg border transition-all ${
                isDone    ? 'border-green-800 bg-green-950/30' :
                isFailed  ? 'border-red-800 bg-red-950/30' :
                isRunning ? 'border-yellow-800 bg-yellow-950/20' :
                            'border-gray-700 bg-gray-800/40'
              }`}
            >
              {/* Step header row */}
              <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : step.stepId)}>
                {/* Checkbox for manual, status icon for action */}
                {isManual ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleManualCheck(step); }}
                    disabled={isDone}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-500 hover:border-green-400 bg-transparent'
                    }`}
                    title={isDone ? 'Completed' : 'Mark as done'}
                  >
                    {isDone && <span className="text-xs leading-none">✓</span>}
                  </button>
                ) : (
                  <span className={`w-4 h-4 flex-shrink-0 text-center text-sm leading-none ${
                    isDone ? 'text-green-400' : isFailed ? 'text-red-400' : isRunning ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    {isDone ? '✓' : isFailed ? '✗' : isRunning ? '⟳' : '○'}
                  </span>
                )}

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isDone ? 'text-green-300' : 'text-gray-200'}`}>
                    {idx + 1}. {step.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {isManual ? 'Manual' : 'Automated'} · {isDone ? 'Done' : isRunning ? 'Running...' : 'Pending'}
                  </p>
                </div>

                <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-2 border-t border-gray-700/50 space-y-3">
                  {/* Instructions */}
                  <div className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                    {step.instructions || 'No additional instructions.'}
                  </div>

                  {/* Command preview for action steps */}
                  {!isManual && step.command && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Command (PowerShell):</p>
                      <pre className="text-xs bg-black/50 rounded p-2 overflow-x-auto text-green-400 whitespace-pre-wrap break-all">
                        {step.command}
                      </pre>
                    </div>
                  )}

                  {/* Action buttons */}
                  {isManual && !isDone && (
                    <button
                      className="w-full text-xs py-1.5 px-3 rounded border border-gray-600 hover:border-green-500 hover:text-green-400 text-gray-300 transition-colors"
                      onClick={() => handleManualCheck(step)}
                    >
                      ✓ Mark as Complete
                    </button>
                  )}

                  {!isManual && !isDone && (
                    <button
                      className="w-full text-xs py-1.5 px-3 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      style={{ backgroundColor: isRunning ? '#374151' : '#2563eb' }}
                      onClick={() => handleExecute(step)}
                      disabled={isRunning}
                    >
                      {isRunning ? '⟳ Running...' : '▶ Execute Step'}
                    </button>
                  )}

                  {isDone && (
                    <p className="text-xs text-green-400 text-center">✓ Step completed</p>
                  )}

                  {isFailed && (
                    <button
                      className="w-full text-xs py-1.5 px-3 rounded bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                      onClick={() => handleExecute(step)}
                    >
                      ↺ Retry Step
                    </button>
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
      {labComplete && (
        <div className="px-4 py-3 bg-green-900/40 border-t border-green-800 text-green-300 text-xs text-center font-medium">
          🎉 Lab Complete! Great work.
        </div>
      )}
    </div>
  );
}
