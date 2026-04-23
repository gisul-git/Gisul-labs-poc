'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { vmService } from '../../../../lib/vmService';
import LabSidebar from '../../../../components/LabSidebar';

const SIDEBAR_W = 320;

export default function ConsolePage() {
  const { vmid }       = useParams();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const canvasRef      = useRef(null);
  const rfbRef         = useRef(null);
  const fullscreenRef  = useRef(null);
  const hideTimer      = useRef(null);

  const [status, setStatus]           = useState('Waiting for VM...');
  const [error, setError]             = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [vmReady, setVmReady]         = useState(false);
  const [navVisible, setNavVisible]   = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasLab = searchParams.get('lab') !== '0';
  const sidebarVisible = showSidebar && hasLab;

  // Track fullscreen state
  useEffect(() => {
    function onFSChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // When entering fullscreen, start hide timer; when exiting, always show nav
      if (fs) {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setNavVisible(false), 3000);
      } else {
        clearTimeout(hideTimer.current);
        setNavVisible(true);
      }
    }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // Auto-hide nav after 3s on mount — only in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    hideTimer.current = setTimeout(() => setNavVisible(false), 3000);
    return () => clearTimeout(hideTimer.current);
  }, [isFullscreen]);

  const showNav = useCallback(() => {
    clearTimeout(hideTimer.current);
    setNavVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setNavVisible(false), 2000);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isFullscreen) return;
    if (e.clientY < 60) {
      showNav();
    } else if (navVisible) {
      scheduleHide();
    }
  }, [isFullscreen, navVisible, showNav, scheduleHide]);

  // Poll VM status until running
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

  // Connect VNC once VM is running
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
        rfb.clipViewport  = false;
        rfb.resizeSession = false;

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
    <div
      ref={fullscreenRef}
      className="flex flex-col h-screen bg-black overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      {/* Hover trigger zone — only active in fullscreen */}
      {isFullscreen && (
        <div
          className="absolute top-0 left-0 right-0 h-12 z-30"
          onMouseEnter={showNav}
        />
      )}

      {/* Top nav — slides in/out */}
      <div className={`left-0 right-0 z-40 flex items-center gap-2 px-3 py-2 bg-gray-900/95 backdrop-blur border-b border-gray-800 transition-all duration-300 ${
        isFullscreen ? 'absolute top-0' : 'relative'
      } ${
        !isFullscreen || navVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
        onMouseEnter={showNav}
        onMouseLeave={scheduleHide}
      >
        <button className="btn-ghost text-xs" onClick={() => router.push('/')}>← Back</button>
        <span className="text-sm text-gray-400 truncate">Console — VM {vmid}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
          status === 'Connected'    ? 'bg-green-900 text-green-300' :
          status === 'Error'        ? 'bg-red-900 text-red-300'     :
          status.startsWith('Clon') ? 'bg-blue-900 text-blue-300'   :
                                      'bg-gray-800 text-gray-400'
        }`}>
          {status}
        </span>
        <div className="ml-auto flex gap-1 flex-shrink-0">
          <button className="btn-ghost text-xs" onClick={() => rfbRef.current?.sendCtrlAltDel()} disabled={status !== 'Connected'}>
            Ctrl+Alt+Del
          </button>
          <button className="btn-ghost text-xs" onClick={() => fullscreenRef.current?.requestFullscreen?.()}>
            Fullscreen
          </button>
          <button className="btn-ghost text-xs" onClick={() => setShowSidebar(s => !s)}>
            {sidebarVisible ? '▶ Hide Lab' : '◀ Show Lab'}
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute top-10 left-0 right-0 z-40 bg-red-900/50 border-b border-red-800 text-red-300 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {/* Main content: canvas + sidebar side by side */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!vmReady ? (
          <div className="flex-1 flex items-center justify-center bg-gray-950 text-gray-400 text-sm gap-3">
            <span className="animate-spin text-lg">⟳</span>
            {status}
          </div>
        ) : (
          <div className="flex-1 min-w-0 bg-black novnc-container">
            <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {sidebarVisible && (
          <div className="flex-shrink-0 h-full overflow-y-auto" style={{ width: SIDEBAR_W }}>
            <LabSidebar vmId={parseInt(vmid)} />
          </div>
        )}
      </div>
    </div>
  );
}
