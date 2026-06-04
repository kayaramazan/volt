import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Download, FilePlus2, Loader2, Puzzle } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { CodeEditor } from '@/components/request/CodeEditor';
import { useModals } from '@/stores/modals';
import { usePlugins } from '@/hooks/useData';
import { cn, formatBytes, formatDuration, statusColorClass, tryDecodeBase64 } from '@/lib/util';
import { parseCookies, type ParsedCookie } from '@/lib/cookies';
import { suggestFilename } from '@/lib/contentDisposition';
import { voltApi } from '@/lib/volt-api';

interface SendResponse {
  ok: boolean;
  statusCode?: number;
  statusText?: string;
  headers?: [string, string][];
  bodyBase64?: string | null;
  bodyTempFile?: string | null;
  bodyContentType?: string | null;
  bodySizeBytes?: number;
  errorCode?: string;
  errorMessage?: string;
  timing: {
    dnsMs: number | null;
    tcpMs: number | null;
    tlsMs: number | null;
    ttfbMs: number | null;
    downloadMs: number | null;
    totalMs: number;
  };
  preScript?: { logs: string[]; error: string | null };
  postScript?: { logs: string[]; error: string | null };
}

interface Props {
  response: SendResponse | null;
  loading?: boolean;
  /** When set, the "Save as example" button opens the AddExample modal for this request. */
  requestId?: string | null;
}

export function ResponseViewer({ response, loading, requestId }: Props) {
  if (!response) {
    if (loading) {
      return (
        <div className="relative flex h-full flex-col bg-bg">
          <IndeterminateBar />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <p>Waiting for response…</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="text-center text-xs text-text-muted">
          <p>Press <kbd className="rounded border border-border bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd> to send the request</p>
        </div>
      </div>
    );
  }

  if (!response.ok) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <div className="border-b border-border px-3 py-2">
          <div className="text-xs">
            <span className="font-medium text-error">Request failed</span>
            <span className="ml-2 text-text-muted">{response.timing.totalMs} ms</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md text-center">
            <p className="font-mono text-xs text-error">{response.errorCode}</p>
            <p className="mt-2 text-sm text-text">{response.errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {loading && <IndeterminateBar />}
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex items-baseline gap-3 text-xs">
          <span className={cn('font-mono font-semibold', statusColorClass(response.statusCode))}>
            {response.statusCode} {response.statusText}
          </span>
          <span className="text-text-muted">{formatDuration(response.timing.totalMs)}</span>
          <span className="text-text-muted">{formatBytes(response.bodySizeBytes ?? 0)}</span>
          {loading && (
            <span className="flex items-center gap-1 text-accent">
              <Loader2 size={11} className="animate-spin" />
              Sending…
            </span>
          )}
        </div>
      </div>

      <ScriptOutputBanner pre={response.preScript} post={response.postScript} />

      <ResponseTabs response={response} requestId={requestId ?? null} />
    </div>
  );
}

function ResponseTabs({
  response,
  requestId,
}: {
  response: SendResponse;
  requestId: string | null;
}) {
  const cookies = useMemo(() => parseCookies(response.headers), [response.headers]);
  return (
    <Tabs defaultValue="body" className="flex flex-1 flex-col overflow-hidden">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="headers">
          Headers
          {response.headers && response.headers.length > 0 && (
            <span className="ml-1 text-[10px] text-text-muted">{response.headers.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="cookies">
          Cookies
          {cookies.length > 0 && (
            <span className="ml-1 text-[10px] text-text-muted">{cookies.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="timing">Timing</TabsTrigger>
      </TabsList>

      <TabsContent value="body" className="overflow-hidden">
        <BodyTab response={response} requestId={requestId ?? null} />
      </TabsContent>
      <TabsContent value="headers" className="overflow-y-auto">
        <HeadersTab headers={response.headers ?? []} />
      </TabsContent>
      <TabsContent value="cookies" className="overflow-y-auto">
        <CookiesTab cookies={cookies} />
      </TabsContent>
      <TabsContent value="timing" className="overflow-y-auto">
        <TimingTab timing={response.timing} />
      </TabsContent>
    </Tabs>
  );
}

function BodyTab({ response, requestId }: { response: SendResponse; requestId: string | null }) {
  const [copied, setCopied] = useState(false);
  const { open: openModal } = useModals();
  const { data: pluginsData } = usePlugins();

  const isImage = (response.bodyContentType ?? '').toLowerCase().startsWith('image/');
  const canSaveBody = Boolean(response.bodyBase64 || response.bodyTempFile);

  // Transformers from loaded plugins that match this response's content-type.
  // An unset matchContentType means "any", so the entry shows up everywhere.
  const transformers = useMemo(() => {
    const all = pluginsData?.plugins.flatMap((p) => (p.error ? [] : p.transformers)) ?? [];
    const ct = (response.bodyContentType ?? '').toLowerCase();
    return all.filter(
      (t) =>
        !t.matchContentType ||
        ct.includes((t.matchContentType ?? '').toLowerCase()),
    );
  }, [pluginsData, response.bodyContentType]);

  // Active transformer + its output, if any.
  const [transformerId, setTransformerId] = useState<string>('');
  const [transformResult, setTransformResult] = useState<
    | { ok: true; body: string; contentType: string | null; transformerName: string }
    | { ok: false; error: string; transformerName: string }
    | null
  >(null);
  const [transforming, setTransforming] = useState(false);

  // Reset transformer state on body change (new request fired, etc.).
  useEffect(() => {
    setTransformerId('');
    setTransformResult(null);
  }, [response.bodyBase64, response.bodyContentType]);

  const saveToFile = async () => {
    const defaultName = suggestFilename(response.headers, response.bodyContentType);
    try {
      await voltApi['response:saveBody']({
        defaultName,
        contentBase64: response.bodyBase64 ?? null,
        tempPath: response.bodyTempFile ?? null,
      });
    } catch (e) {
      // Surface in console; the native dialog already gives the user feedback.
      console.error('Failed to save response body', e);
    }
  };

  const runTransformer = async (id: string, decodedText: string) => {
    if (!id) {
      setTransformerId('');
      setTransformResult(null);
      return;
    }
    const t = transformers.find((x) => x.id === id);
    if (!t) return;
    setTransformerId(id);
    setTransforming(true);
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of response.headers ?? []) headers[k] = v;
      const out = await voltApi['plugins:applyTransformer']({
        transformerId: id,
        body: decodedText,
        contentType: response.bodyContentType ?? null,
        headers,
      });
      if (out.ok) {
        setTransformResult({
          ok: true,
          body: out.body,
          contentType: out.contentType,
          transformerName: t.name,
        });
      } else {
        setTransformResult({ ok: false, error: out.error, transformerName: t.name });
      }
    } finally {
      setTransforming(false);
    }
  };

  // Decode body — first see if it's text-ish
  const { text, isBinary } = useMemo(
    () => tryDecodeBase64(response.bodyBase64 ?? null, response.bodyContentType ?? null),
    [response.bodyBase64, response.bodyContentType],
  );

  const language: 'json' | 'xml' | 'html' | 'javascript' | 'text' = useMemo(() => {
    const ct = (response.bodyContentType ?? '').toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml')) return 'xml';
    if (ct.includes('html')) return 'html';
    if (ct.includes('javascript')) return 'javascript';
    return 'text';
  }, [response.bodyContentType]);

  // Pretty-print JSON when applicable
  const formattedText = useMemo(() => {
    if (!text) return '';
    if (language !== 'json') return text;
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }, [text, language]);

  // If a transformer ran successfully, its output replaces the displayed body
  // (and we re-derive the editor language from the transformer's content-type).
  const displayedText =
    transformResult && transformResult.ok ? transformResult.body : formattedText;
  const displayedLanguage: 'json' | 'xml' | 'html' | 'javascript' | 'text' = useMemo(() => {
    if (!transformResult || !transformResult.ok) return language;
    const ct = (transformResult.contentType ?? '').toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml')) return 'xml';
    if (ct.includes('html')) return 'html';
    if (ct.includes('javascript')) return 'javascript';
    return 'text';
  }, [transformResult, language]);

  // Image preview takes priority over the binary/temp-file branches so users
  // see the image inline instead of a "binary content" placeholder.
  if (isImage && response.bodyBase64) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <img
            src={`data:${response.bodyContentType};base64,${response.bodyBase64}`}
            alt="Response"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[10px] text-text-muted">
          <span>
            {response.bodyContentType} · {formatBytes(response.bodySizeBytes ?? 0)}
          </span>
          {canSaveBody && (
            <SaveBodyButton onClick={saveToFile} />
          )}
        </div>
      </div>
    );
  }

  if (isImage && response.bodyTempFile) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-xs text-text-muted">
            Image too large to preview inline ({formatBytes(response.bodySizeBytes ?? 0)})
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{response.bodyContentType}</p>
          <SaveBodyButton onClick={saveToFile} className="mt-3" />
        </div>
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-xs text-text-muted">
            Binary content — {formatBytes(response.bodySizeBytes ?? 0)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{response.bodyContentType}</p>
          {canSaveBody && <SaveBodyButton onClick={saveToFile} className="mt-3" />}
        </div>
      </div>
    );
  }

  if (response.bodyTempFile) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-xs text-text-muted">
            Response too large to display ({formatBytes(response.bodySizeBytes ?? 0)})
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{response.bodyTempFile}</p>
          <SaveBodyButton onClick={saveToFile} className="mt-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="absolute right-3 top-2 z-10 flex items-center gap-1">
        {transformers.length > 0 && (
          <div className="flex items-center gap-1 rounded bg-bg-elevated/80 px-1 py-0.5 text-[10px] text-text-muted">
            <Puzzle size={11} className={transforming ? 'animate-pulse text-accent' : undefined} />
            <select
              value={transformerId}
              onChange={(e) => runTransformer(e.target.value, formattedText)}
              className="cursor-pointer appearance-none bg-transparent pr-1 text-[10px] text-text-muted outline-none hover:text-text"
              title="Apply a plugin transformer to this response body"
            >
              <option value="">Transform…</option>
              {transformers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {canSaveBody && (
          <button
            type="button"
            onClick={saveToFile}
            className="flex items-center gap-1 rounded bg-bg-elevated/80 px-2 py-1 text-[10px] text-text-muted hover:text-text"
            title="Save response body to a file"
          >
            <Download size={11} />
            Save
          </button>
        )}
        {requestId && (
          <button
            type="button"
            onClick={() => openModal({ kind: 'add-example', requestId })}
            className="flex items-center gap-1 rounded bg-bg-elevated/80 px-2 py-1 text-[10px] text-text-muted hover:text-text"
            title="Save this request + response as an example"
          >
            <FilePlus2 size={11} />
            Save as example
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(displayedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 rounded bg-bg-elevated/80 px-2 py-1 text-[10px] text-text-muted hover:text-text"
        >
          {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {transformResult && !transformResult.ok && (
        <div className="absolute inset-x-3 top-10 z-10 rounded border border-error/30 bg-error/10 px-2 py-1 text-[11px] text-error">
          {transformResult.transformerName}: {transformResult.error}
        </div>
      )}
      {transformResult && transformResult.ok && (
        <div className="absolute inset-x-3 top-10 z-10 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] text-accent">
          Transformed by <span className="font-semibold">{transformResult.transformerName}</span> ·{' '}
          {transformResult.contentType ?? 'no content-type'}
        </div>
      )}
      <CodeEditor value={displayedText} language={displayedLanguage} readOnly className="h-full" />
    </div>
  );
}

function SaveBodyButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border bg-bg-elevated px-2 py-1 text-[11px] text-text hover:bg-bg',
        className,
      )}
      title="Save response body to a file"
    >
      <Download size={12} />
      Save to file
    </button>
  );
}

function HeadersTab({ headers }: { headers: [string, string][] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {headers.map(([k, v], i) => (
          <tr key={i} className="border-b border-border/40">
            <td className="w-1/3 px-3 py-1.5 font-mono text-text-muted">{k}</td>
            <td className="px-3 py-1.5 font-mono text-text break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CookiesTab({ cookies }: { cookies: ParsedCookie[] }) {
  if (cookies.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-text-muted">
        No cookies set by this response.
      </p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border bg-bg-elevated text-[10px] uppercase tracking-wide text-text-muted">
          <th className="px-3 py-1.5 text-left font-semibold">Name</th>
          <th className="px-3 py-1.5 text-left font-semibold">Value</th>
          <th className="px-3 py-1.5 text-left font-semibold">Domain</th>
          <th className="px-3 py-1.5 text-left font-semibold">Path</th>
          <th className="px-3 py-1.5 text-left font-semibold">Expires</th>
          <th className="px-3 py-1.5 text-left font-semibold">Flags</th>
        </tr>
      </thead>
      <tbody>
        {cookies.map((c, i) => {
          const flags = [
            c.httpOnly && 'HttpOnly',
            c.secure && 'Secure',
            c.sameSite && `SameSite=${c.sameSite}`,
          ].filter(Boolean);
          const expires = c.expires ?? (c.maxAge != null ? `Max-Age=${c.maxAge}` : '');
          return (
            <tr key={i} className="border-b border-border/40 align-top">
              <td className="px-3 py-1.5 font-mono text-text">{c.name}</td>
              <td className="px-3 py-1.5 font-mono text-text break-all">{c.value}</td>
              <td className="px-3 py-1.5 font-mono text-text-muted">{c.domain ?? '—'}</td>
              <td className="px-3 py-1.5 font-mono text-text-muted">{c.path ?? '—'}</td>
              <td className="px-3 py-1.5 font-mono text-text-muted">{expires || '—'}</td>
              <td className="px-3 py-1.5 font-mono text-text-muted">
                {flags.length > 0 ? flags.join(' · ') : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TimingTab({ timing }: { timing: SendResponse['timing'] }) {
  const phases = [
    { label: 'DNS', ms: timing.dnsMs },
    { label: 'TCP', ms: timing.tcpMs },
    { label: 'TLS', ms: timing.tlsMs },
    { label: 'TTFB', ms: timing.ttfbMs },
    { label: 'Download', ms: timing.downloadMs },
    { label: 'Total', ms: timing.totalMs, total: true },
  ];

  const max = Math.max(...phases.filter((p) => !p.total).map((p) => p.ms ?? 0));

  return (
    <div className="p-4">
      <div className="space-y-2">
        {phases.map((p) => (
          <div key={p.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className={cn(p.total ? 'font-semibold text-text' : 'text-text-muted')}>{p.label}</span>
              <span className="font-mono text-text">{p.ms == null ? '—' : `${p.ms} ms`}</span>
            </div>
            {!p.total && p.ms != null && max > 0 && (
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-bg-elevated">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(p.ms / max) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 2px indeterminate progress bar pinned to the top of the response viewer.
 * Animation defined in global.css (.volt-indeterminate-bar).
 */
function IndeterminateBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden bg-accent/15">
      <div className="volt-indeterminate-bar h-full w-1/3 bg-accent" />
    </div>
  );
}

function ScriptOutputBanner({
  pre,
  post,
}: {
  pre?: { logs: string[]; error: string | null };
  post?: { logs: string[]; error: string | null };
}) {
  const hasPre = pre && (pre.logs.length > 0 || pre.error);
  const hasPost = post && (post.logs.length > 0 || post.error);
  if (!hasPre && !hasPost) return null;
  return (
    <div className="border-b border-border bg-bg-elevated px-3 py-1.5 text-[11px]">
      {hasPre && <ScriptOutputRow label="Pre-request" output={pre!} />}
      {hasPost && <ScriptOutputRow label="Post-response" output={post!} />}
    </div>
  );
}

function ScriptOutputRow({
  label,
  output,
}: {
  label: string;
  output: { logs: string[]; error: string | null };
}) {
  return (
    <details>
      <summary className="cursor-pointer">
        <span className="font-semibold text-text">{label}</span>{' '}
        {output.error ? (
          <span className="text-error">script error</span>
        ) : (
          <span className="text-text-muted">{output.logs.length} log{output.logs.length === 1 ? '' : 's'}</span>
        )}
      </summary>
      <div className="mt-1 space-y-0.5 font-mono">
        {output.error && <p className="text-error">{output.error}</p>}
        {output.logs.map((line, i) => (
          <p key={i} className="text-text-muted">{line}</p>
        ))}
      </div>
    </details>
  );
}
