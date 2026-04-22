'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { vmService } from '../../../../lib/vmService';
import LabSidebar from '../../../../components/LabSidebar';

export default function ConsolePage() {
  const { vmid }       = useParams();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const canvasRef      = useRef(null);
  const rfbRef         = useRef(null);
  const [status, setStatus]       = useState('Waiting for VM...');
  const [error, setError]         = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [vmReady, setVmReady]     = useState(false);

  const hasLab = searchParams.get('lab') !== '0';

  // Poll VM status until running, then connect VNC
  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function pollVMStatus() {
      try {
        const res = await vmService.get(vmid);
        const vm = res.data;
        if (vm.status === 'running' && vm.provisioningStatus !== 'creating') {
          if (!cancelled) setVmReady(true);
        } else {
          const label = vm.provisioningStatus === 'creating' ? 'Cloning VM...' : `VM is ${vm.status}, waiting...`;
          if (!cancelled) setStatus(label);
          pollTimer = setTimeout(pollVMStatus, 5000);
        }
      } catch {
        if (!cancelled) pollTimer = setTimeout(pollVMStatus, 5000);
      }
    }

    pollVMStatus();
    return () => { cancelled = true; clearTimeout(pollTimer); };
  }, [vmid]);

  // Connect VNC only once VM is running
  useEffect(() => {
    if (!vmReady) return;
    let cancelled = false;

    async function connect() {
      try {
        setStatus('Connecting...');
        const res = await vmService.vncTicket(vmid);
        const { ticket, port, node } = res.data;

        let RFB = window.RFB;
        if (!RFB) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('noVNC CDN load timed out')), 10000);
            const check = setInterval(() => {
              if (window.RFB) { clearInterval(check); clearTimeout(timeout); resolve(); }
            }, 100);
          });
          RFB = window.RFB;
        }

        if (cancelled) return;

        const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProto}://${window.location.host}/api/console/ws/${node}/${vmid}?ticket=${encodeURIComponent(ticket)}&port=${port}`;

        const rfb = new RFB(canvasRef.current, wsUrl, { credentials: { password: ticket } });
        rfb.scaleViewport = true;
        rfb.resizeSession = true;
        rfb.clipViewport  = false;

        rfb.addEventListener('connect',    () => setStatus('Connected'));
        rfb.addEventListener('disconnect', e => {
          setStatus('Disconnected');
          if (e.detail?.clean === false) setError('Connection lost unexpectedly');
        });
        rfb.addEventListener('credentialsrequired', () => rfb.sendCredentials({ password: ticket }));
        rfbRef.current = rfb;
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to connect');
          setStatus('Error');
        }
      }
    }

    connect();
    return () => { cancelled = true; rfbRef.current?.disconnect(); };
  }, [vmReady, vmid]);

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button className="btn-ghost text-xs" onClick={() => router.push('/')}>← Back</button>
        <span className="text-sm text-gray-400">Console — VM {vmid}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          status === 'Connected'    ? 'bg-green-900 text-green-300' :
          status === 'Error'        ? 'bg-red-900 text-red-300'     :
          status.startsWith('Clon') ? 'bg-blue-900 text-blue-300'   :
                                      'bg-gray-800 text-gray-400'
        }`}>
          {status}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => rfbRef.current?.sendCtrlAltDel()}
            disabled={status !== 'Connected'}
          >
            Ctrl+Alt+Del
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => canvasRef.current?.requestFullscreen?.()}
          >
            Fullscreen
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => setShowSidebar(s => !s)}
          >
            {showSidebar ? '▶ Hide Lab' : '◀ Show Lab'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border-b border-red-800 text-red-300 text-sm px-4 py-2 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Waiting overlay — shown while VM is not yet running */}
      {!vmReady && (
        <div className="flex-1 flex items-center justify-center bg-gray-950 text-gray-400 text-sm gap-3">
          <span className="animate-spin text-lg">⟳</span>
          {status}
        </div>
      )}

      {/* Split layout: console + sidebar */}
      <div className={`flex flex-1 overflow-hidden ${!vmReady ? 'hidden' : ''}`}>
        <div ref={canvasRef} className="flex-1 bg-black overflow-hidden" />
        {showSidebar && hasLab && (
          <LabSidebar vmId={parseInt(vmid)} />
        )}
      </div>
    </div>
  );
}

