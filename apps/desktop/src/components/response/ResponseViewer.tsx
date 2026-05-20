import { useMemo, useState } from 'react';
import { Copy, Check, Download, Loader2 } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { CodeEditor } from '@/components/request/CodeEditor';
import { cn, formatBytes, formatDuration, statusColorClass, tryDecodeBase64 } from '@/lib/util';

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
}

export function ResponseViewer({ response, loading }: Props) {
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

      <Tabs defaultValue="body" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            {response.headers && response.headers.length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">{response.headers.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="overflow-hidden">
          <BodyTab response={response} />
        </TabsContent>
        <TabsContent value="headers" className="overflow-y-auto">
          <HeadersTab headers={response.headers ?? []} />
        </TabsContent>
        <TabsContent value="timing" className="overflow-y-auto">
          <TimingTab timing={response.timing} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BodyTab({ response }: { response: SendResponse }) {
  const [copied, setCopied] = useState(false);

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

  if (isBinary) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-xs text-text-muted">Binary content — {formatBytes(response.bodySizeBytes ?? 0)}</p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{response.bodyContentType}</p>
          {response.bodyTempFile && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigator.clipboard.writeText(response.bodyTempFile!)}>
              <Download size={12} />
              Copy file path
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (response.bodyTempFile) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-xs text-text-muted">Response too large to display ({formatBytes(response.bodySizeBytes ?? 0)})</p>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{response.bodyTempFile}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(formattedText);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-3 top-2 z-10 flex items-center gap-1 rounded bg-bg-elevated/80 px-2 py-1 text-[10px] text-text-muted hover:text-text"
      >
        {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <CodeEditor value={formattedText} language={language} readOnly className="h-full" />
    </div>
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
