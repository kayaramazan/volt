// Small modal for controlling the local mock server: change port, start/stop,
// see active-mock count. Opened from the top-bar indicator.

import { useState, useEffect } from 'react';
import { Server, Power } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMockStatus, useStartMockServer, useStopMockServer } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { cn } from '@/lib/util';

export function MockSettingsModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'mock-settings';
  const { data: status } = useMockStatus();
  const startMock = useStartMockServer();
  const stopMock = useStopMockServer();

  const [port, setPort] = useState('3001');

  // Sync port input with the current status when the modal opens.
  useEffect(() => {
    if (isOpen && status?.port) setPort(String(status.port));
  }, [isOpen, status?.port]);

  const portNum = Number(port);
  const portValid = Number.isFinite(portNum) && portNum >= 1 && portNum <= 65535;
  const running = !!status?.running;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Mock server"
      className="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
            running
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-bg text-text-muted',
          )}
        >
          <Server size={12} />
          {running ? (
            <span>
              Running on{' '}
              <span className="font-mono text-text">127.0.0.1:{status?.port}</span> ·{' '}
              {status?.activeMockCount ?? 0} active mock
              {(status?.activeMockCount ?? 0) === 1 ? '' : 's'}
            </span>
          ) : (
            <span>Stopped</span>
          )}
        </div>
        {status?.error && !running && (
          <p className="rounded border border-error/30 bg-error/10 px-2 py-1.5 text-[11px] text-error">
            {status.error}
          </p>
        )}

        <label className="text-xs text-text-muted">
          Port
          <Input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="font-mono"
            disabled={running}
          />
        </label>
        {running && (
          <p className="text-[11px] text-text-muted">
            Stop the server to change the port.
          </p>
        )}

        <p className="rounded border border-border bg-bg-elevated p-2 text-[11px] text-text-muted">
          Mocks are configured per-collection — right-click a collection in the sidebar →
          <span className="text-text"> Mocks…</span> to add or edit entries. The server walks
          every collection’s mocks on each incoming request, so you can toggle entries on/off
          without restarting.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          {running ? (
            <Button
              variant="danger"
              onClick={() => stopMock.mutate()}
              disabled={stopMock.isPending}
            >
              <Power size={12} /> Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => startMock.mutate({ port: portNum })}
              disabled={!portValid || startMock.isPending}
            >
              <Power size={12} /> Start
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
