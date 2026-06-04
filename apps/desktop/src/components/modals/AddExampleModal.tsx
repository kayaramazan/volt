import { useEffect, useState, type FormEvent } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRequest, useUpdateRequest } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useDrafts } from '@/stores/drafts';
import { rowId, tryDecodeBase64 } from '@/lib/util';

type RawResponse = {
  ok: boolean;
  statusCode?: number;
  headers?: [string, string][];
  bodyBase64?: string | null;
  bodyContentType?: string | null;
  bodySizeBytes?: number;
  errorCode?: string;
  errorMessage?: string;
  timing?: { totalMs: number };
};

type RawRequest = {
  method: string;
  url: string;
  headers: unknown;
  queryParams: unknown;
  bodyType: string;
  body: unknown;
  auth: unknown;
  preRequestScript?: string;
  postResponseScript?: string;
  examples?: unknown[];
};

/**
 * Capture the current saved request + last response as an "example" snapshot.
 * Stored on the request's `examples` array; viewable from the Examples tab.
 */
export function AddExampleModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'add-example';
  const requestId = current.kind === 'add-example' ? current.requestId : null;

  const { data: request } = useRequest(requestId);
  const update = useUpdateRequest();
  const lastResponses = useDrafts((s) => s.lastResponses);
  const lastResponse = requestId ? (lastResponses.get(requestId) as RawResponse | undefined) : undefined;

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(suggestedName(lastResponse));
    setError(null);
  }, [isOpen, lastResponse]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const snapshot = buildSnapshot(request as unknown as RawRequest, lastResponse, trimmed);
      const currentExamples =
        ((request as unknown as RawRequest).examples as unknown[]) ?? [];
      await update.mutateAsync({
        id: request.id,
        examples: [...currentExamples, snapshot],
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title={request ? `Add example · ${request.name}` : 'Add example'}
      className="max-w-md"
    >
      {!request ? (
        <p className="text-xs text-text-muted">Request not found.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Successful login (200)"
              autoFocus
            />
          </div>

          <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
            {lastResponse ? (
              <p>
                Captures the saved request plus the last response (
                <span className="font-mono text-text">
                  {lastResponse.ok ? `${lastResponse.statusCode}` : `error: ${lastResponse.errorCode}`}
                </span>
                ,{' '}
                <span className="font-mono text-text">{lastResponse.timing?.totalMs ?? 0}ms</span>).
              </p>
            ) : (
              <p>
                No response captured yet — send the request first if you want the example to include
                the response, or save without one to just snapshot the request.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={close} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!name.trim() || update.isPending}>
              Save example
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function suggestedName(resp?: RawResponse): string {
  if (!resp) return 'Untitled example';
  if (!resp.ok) return `Error · ${resp.errorCode ?? 'failed'}`;
  return `Response ${resp.statusCode ?? ''}`.trim();
}

function buildSnapshot(req: RawRequest, resp: RawResponse | undefined, name: string) {
  return {
    id: rowId('ex'),
    name,
    createdAt: Date.now(),
    request: {
      method: req.method,
      url: req.url,
      headers: (req.headers as Array<{ key: string; value: string }>) ?? [],
      queryParams: (req.queryParams as Array<{ key: string; value: string }>) ?? [],
      bodyType: req.bodyType,
      body: req.body,
      auth: req.auth,
      // Snapshot the scripts so the example reproduces the exact pre/post
      // behavior it was captured with — not whatever the user has now.
      preRequestScript: req.preRequestScript ?? '',
      postResponseScript: req.postResponseScript ?? '',
    },
    response: resp
      ? resp.ok
        ? {
            ok: true,
            statusCode: resp.statusCode,
            headers: resp.headers ?? [],
            contentType: resp.bodyContentType ?? null,
            // tryDecodeBase64 returns { text, isBinary } — we only persist the
            // decoded text. Binary bodies (images, etc.) are stored as null.
            bodyText: resp.bodyBase64
              ? tryDecodeBase64(resp.bodyBase64, resp.bodyContentType ?? null).text
              : null,
            bodySizeBytes: resp.bodySizeBytes ?? 0,
            durationMs: resp.timing?.totalMs ?? 0,
          }
        : {
            ok: false,
            errorCode: resp.errorCode,
            errorMessage: resp.errorMessage,
            durationMs: resp.timing?.totalMs ?? 0,
          }
      : null,
  };
}
