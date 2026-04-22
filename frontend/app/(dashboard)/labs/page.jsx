'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { labService } from '../../../lib/vmService';
import { ToastContainer, toast } from '../../../components/Toast';

export default function LabsPage() {
  const router = useRouter();
  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null); // labId being started

  useEffect(() => {
    labService.list()
      .then(res => setLabs(res.data))
      .catch(() => toast('Failed to load labs', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleStart(lab) {
    setStarting(lab._id);
    try {
      const res = await labService.start(lab._id);
      toast(`Lab started — VM ${res.data.vmId} is being provisioned`, 'success');
      // Navigate to console with lab sidebar
      setTimeout(() => router.push(`/console/${res.data.vmId}?lab=1`), 1200);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to start lab', 'error');
    } finally {
      setStarting(null);
    }
  }

  return (
    <div>
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Labs</h1>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading labs...</p>
      ) : labs.length === 0 ? (
        <p className="text-gray-500 text-sm">No labs found. Run the seed script to add labs.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {labs.map(lab => (
            <div key={lab._id} className="card flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-gray-100">{lab.title}</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{lab.description}</p>
              </div>

              <div className="text-xs text-gray-500">
                <span className="text-gray-400">{lab.steps?.length || 0} steps</span>
                <span className="mx-2">·</span>
                <span>Template ID: {lab.templateId}</span>
              </div>

              {/* Step list preview */}
              <ul className="space-y-1">
                {lab.steps?.map((step, i) => (
                  <li key={step.stepId} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-4 h-4 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0">
                      {i + 1}
                    </span>
                    {step.title}
                  </li>
                ))}
              </ul>

              <button
                className="btn-primary text-xs mt-auto"
                onClick={() => handleStart(lab)}
                disabled={starting === lab._id}
              >
                {starting === lab._id ? 'Starting...' : '▶ Start Lab'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
