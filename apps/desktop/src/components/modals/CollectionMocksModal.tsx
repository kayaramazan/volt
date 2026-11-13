// Per-collection mock-server CRUD. The local mock server (main process)
// walks every collection's `mocks[]` and routes incoming HTTP requests to
// the first enabled, matching entry. Sharing a mock = sharing the
// collection — mocks ride on the existing collection sync.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Server } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CodeEditor } from '@/components/request/CodeEditor';
import { KeyValueEditor } from '@/components/request/KeyValueEditor';
import {
  useCollections,
  useMockStatus,
  useStartMockServer,
  useUpdateCollection,
} from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { cn, rowId } from '@/lib/util';

const METHODS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface Mock {
  id: string;
  name: string;
  method: string;
  pathPattern: string;
  enabled: boolean;
  status: number;
  headers: Array<{ key: string; value: string }>;
  contentType: string;
  body: string;
  delayMs: number;
}

function blank(): Mock {
  return {
    id: rowId('mock'),
    name: 'New mock',
    method: 'GET',
    pathPattern: '/hello',
    enabled: true,
    status: 200,
    headers: [],
    contentType: 'application/json',
    body: '{"message":"hello"}',
    delayMs: 0,
  };
}

export function CollectionMocksModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'collection-mocks';
  const collectionId = current.kind === 'collection-mocks' ? current.collectionId : null;
  const { workspaceId } = useSelection();
  const { data: collections } = useCollections(workspaceId);
  const collection = collections?.find((c) => c.id === collectionId) ?? null;
  const updateCollection = useUpdateCollection();

  const { data: mockStatus } = useMockStatus();
  const startMock = useStartMockServer();

  const [mocks, setMocks] = useState<Mock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Raw text of the status field while the user types: clamping to 100–599
  // on every keystroke made "4" jump to "100", so 404 could never be typed.
  const [statusDraft, setStatusDraft] = useState('');

  // Hydrate when the collection changes (or the modal opens).
  useEffect(() => {
    if (!collection) return;
    const cur = (collection as { mocks?: Mock[] }).mocks ?? [];
    setMocks(cur);
    setSelectedId(cur[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection?.id, isOpen]);

  const selected = useMemo(() => mocks.find((m) => m.id === selectedId) ?? null, [mocks, selectedId]);

  useEffect(() => {
    setStatusDraft(selected ? String(selected.status) : '');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced write: one DB row + sync push per burst of typing instead of
  // one per keystroke. Flushed on close/unmount so nothing is lost.
  const saveTimerRef = useRef<number | null>(null);
  // Carries its own collection id: by the time the close-cleanup runs the
  // modal state has already moved on and `collectionId` is null.
  const pendingRef = useRef<{ id: string; mocks: Mock[] } | null>(null);
  const updateCollectionRef = useRef(updateCollection);
  updateCollectionRef.current = updateCollection;
  const flush = useCallback(() => {
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    void updateCollectionRef.current.mutateAsync({ id: pending.id, mocks: pending.mocks });
  }, []);
  useEffect(() => {
    return () => flush();
  }, [isOpen, collectionId, flush]);

  function persist(next: Mock[], immediate = false) {
    setMocks(next);
    if (!collectionId) return;
    pendingRef.current = { id: collectionId, mocks: next };
    if (immediate) {
      flush();
      return;
    }
    if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      flush();
    }, 400);
  }

  function addMock() {
    const m = blank();
    const next = [...mocks, m];
    persist(next, true);
    setSelectedId(m.id);
  }

  function deleteMock(id: string) {
    if (!confirm('Delete this mock?')) return;
    const next = mocks.filter((m) => m.id !== id);
    persist(next, true);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function patchSelected(p: Partial<Mock>) {
    if (!selected) return;
    const next = mocks.map((m) => (m.id === selected.id ? { ...m, ...p } : m));
    persist(next);
  }

  const baseUrl = mockStatus?.running ? `http://127.0.0.1:${mockStatus.port}` : null;
  const exampleUrl =
    baseUrl && selected
      ? `${baseUrl}${selected.pathPattern.startsWith('/') ? '' : '/'}${selected.pathPattern}`
      : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title={collection ? `Mocks · ${collection.name}` : 'Mocks'}
      className="max-w-4xl"
    >
      {!collection ? (
        <p className="text-xs text-text-muted">Collection not found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Server status banner */}
          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs',
              mockStatus?.running
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-border bg-bg text-text-muted',
            )}
          >
            <div className="flex items-center gap-2">
              <Server size={12} />
              {mockStatus?.running ? (
                <span>
                  Mock server is <span className="font-semibold">running</span> on{' '}
                  <span className="font-mono">127.0.0.1:{mockStatus.port}</span> ·{' '}
                  {mockStatus.activeMockCount} active mock
                  {mockStatus.activeMockCount === 1 ? '' : 's'}
                </span>
              ) : (
                <span>Mock server is stopped.</span>
              )}
            </div>
            {!mockStatus?.running && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => startMock.mutate({})}
                disabled={startMock.isPending}
              >
                Start server
              </Button>
            )}
          </div>

          <div className="grid grid-cols-[14rem_1fr] gap-3" style={{ minHeight: '24rem' }}>
            {/* Left — list */}
            <div className="flex flex-col gap-1 overflow-y-auto border-r border-border pr-2">
              {mocks.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-text-muted">No mocks yet.</p>
              )}
              {mocks.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'group flex items-center gap-1.5 rounded px-2 py-1.5 text-xs',
                    selectedId === m.id ? 'bg-bg-elevated text-text' : 'hover:bg-bg-elevated/60 text-text-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={(e) => {
                      const next = mocks.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x));
                      persist(next, true);
                    }}
                    className="accent-accent"
                    title={m.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className="flex flex-1 items-center gap-1.5 truncate text-left"
                    title={m.name}
                  >
                    <span className="font-mono text-[10px] font-semibold text-accent">{m.method}</span>
                    <span className="truncate">{m.name || m.pathPattern || '(unnamed)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMock(m.id)}
                    className="rounded p-0.5 text-text-muted opacity-0 hover:bg-bg hover:text-error group-hover:opacity-100"
                    aria-label="Delete mock"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMock}
                className="mt-1 flex items-center justify-center gap-1.5 rounded border border-dashed border-border px-2 py-1.5 text-xs text-text-muted hover:bg-bg-elevated hover:text-text"
              >
                <Plus size={11} /> New mock
              </button>
            </div>

            {/* Right — editor */}
            <div className="flex flex-col gap-2 overflow-y-auto">
              {!selected ? (
                <p className="px-2 py-6 text-center text-xs text-text-muted">
                  Select a mock on the left, or create a new one.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-text-muted">
                      Name
                      <Input value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} />
                    </label>
                    <label className="text-xs text-text-muted">
                      Status
                      <Input
                        type="number"
                        min={100}
                        max={599}
                        value={statusDraft}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStatusDraft(v);
                          const n = Number(v);
                          if (Number.isInteger(n) && n >= 100 && n <= 599) patchSelected({ status: n });
                        }}
                        onBlur={() => setStatusDraft(String(selected.status))}
                        className="font-mono"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-[6rem_1fr] gap-2">
                    <label className="text-xs text-text-muted">
                      Method
                      <Select
                        value={selected.method}
                        onChange={(e) => patchSelected({ method: e.target.value })}
                        options={METHODS.map((m) => ({ value: m, label: m === '*' ? '* (any)' : m }))}
                        className="font-mono font-semibold"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Path pattern
                      <Input
                        value={selected.pathPattern}
                        onChange={(e) => patchSelected({ pathPattern: e.target.value })}
                        placeholder="/users/:id"
                        className="font-mono"
                      />
                    </label>
                  </div>

                  {exampleUrl && (
                    <p className="rounded border border-border bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
                      curl -X {selected.method === '*' ? 'GET' : selected.method} {exampleUrl}
                    </p>
                  )}

                  <div className="grid grid-cols-[1fr_8rem] gap-2">
                    <label className="text-xs text-text-muted">
                      Content-Type
                      <Input
                        value={selected.contentType}
                        onChange={(e) => patchSelected({ contentType: e.target.value })}
                        placeholder="application/json"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Delay (ms)
                      <Input
                        type="number"
                        min={0}
                        max={60_000}
                        value={selected.delayMs}
                        onChange={(e) =>
                          patchSelected({
                            delayMs: Math.max(0, Math.min(60_000, Number(e.target.value) || 0)),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted">Response headers</label>
                    <KeyValueEditor
                      rows={selected.headers.map((h, i) => ({
                        id: String(i),
                        key: h.key,
                        value: h.value,
                        enabled: true,
                      })) as never}
                      onChange={(rows) =>
                        patchSelected({
                          headers: (rows as Array<{ key: string; value: string }>).map((r) => ({
                            key: r.key,
                            value: r.value,
                          })),
                        })
                      }
                      keyPlaceholder="header"
                      valuePlaceholder="value"
                    />
                  </div>

                  <div className="flex min-h-[10rem] flex-1 flex-col rounded border border-border">
                    <div className="border-b border-border bg-bg-elevated px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Response body
                    </div>
                    <CodeEditor
                      value={selected.body}
                      onChange={(v) => patchSelected({ body: v })}
                      language={selected.contentType.includes('json') ? 'json' : 'text'}
                      className="flex-1"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
