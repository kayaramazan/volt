// Local MCP server panel: how to connect an AI agent, docs for every tool the
// server exposes, and a live view of connected agents and their tool calls.
// Data comes from the mcp:info IPC (electron/core/mcp/*); main pushes a
// `mcp:activity` event whenever a client connects or calls a tool.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useModals } from '@/stores/modals';
import { onVoltEvent, voltApi } from '@/lib/volt-api';
import { toast } from '@/stores/toasts';
import { cn } from '@/lib/util';

type McpInfo = Awaited<ReturnType<(typeof voltApi)['mcp:info']>>;
type McpTool = McpInfo['tools'][number];
type McpCall = McpInfo['calls'][number];

/** Shared query: the modal and the top-bar indicator both read it. */
export function useMcpInfo(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    return onVoltEvent((event) => {
      if ((event as { kind?: string }).kind === 'mcp:activity') {
        void qc.invalidateQueries({ queryKey: ['mcp-info'] });
      }
    });
  }, [qc]);
  return useQuery({
    queryKey: ['mcp-info'],
    queryFn: () => voltApi['mcp:info']({}),
    enabled,
    // "Active" is time-based (seen in the last 5 min); refresh it now and then.
    refetchInterval: 30_000,
  });
}

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
}

export function McpModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'mcp';
  const { data } = useMcpInfo(isOpen);
  const [tab, setTab] = useState('connect');

  const activeClients = data?.clients.filter((c) => c.active).length ?? 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="MCP server"
      description="Let AI agents browse, edit and run your API collections while Volt is open."
      className="h-[80vh] max-w-4xl"
    >
      {!data ? (
        <p className="py-6 text-center text-xs text-text-muted">Loading…</p>
      ) : (
        <div className="flex h-full flex-col gap-3">
          <StatusBar status={data.status} />
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="px-0">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="tools">Tools ({data.tools.length})</TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                {activeClients > 0 && (
                  <span className="ml-1.5 rounded bg-success/20 px-1 text-[10px] text-success">
                    {activeClients} active
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="connect" className="pt-3">
              <ConnectTab url={data.status.url} onShowTools={() => setTab('tools')} />
            </TabsContent>
            <TabsContent value="tools" className="pt-3">
              <ToolsTab tools={data.tools} />
            </TabsContent>
            <TabsContent value="activity" className="pt-3">
              <ActivityTab info={data} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Dialog>
  );
}

function StatusBar({ status }: { status: McpInfo['status'] }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-xs">
      <span className={cn('h-2 w-2 rounded-full', status.running ? 'bg-success' : 'bg-error')} />
      {status.running ? (
        <>
          <span className="text-text-muted">Listening on</span>
          <code className="font-mono text-text">{status.url}</code>
          <Button size="icon" variant="ghost" className="ml-auto" title="Copy URL" onClick={() => copy(status.url)}>
            <Copy size={12} />
          </Button>
        </>
      ) : (
        <span className="text-error">{status.error ?? 'Not running'}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Connect
// ─────────────────────────────────────────────────────────

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-text">{label}</p>
      <div className="relative">
        <pre className="overflow-x-auto rounded border border-border bg-bg p-2 pr-9 font-mono text-[11px] text-text">
          {text}
        </pre>
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1"
          title="Copy"
          onClick={() => copy(text)}
        >
          <Copy size={12} />
        </Button>
      </div>
    </div>
  );
}

function ConnectTab({ url, onShowTools }: { url: string; onShowTools: () => void }) {
  const jsonConfig = JSON.stringify({ mcpServers: { volt: { type: 'http', url } } }, null, 2);
  const bridgeConfig = JSON.stringify(
    { mcpServers: { volt: { command: 'npx', args: ['-y', 'mcp-remote', url] } } },
    null,
    2,
  );
  return (
    <div className="space-y-4 text-xs text-text-muted">
      <p>
        Volt serves the Model Context Protocol over Streamable HTTP while the app is open. Connected agents work on the
        same data as this window: changes show up here right away and sync like your own edits.
      </p>

      <Snippet label="Claude Code" text={`claude mcp add --transport http volt ${url}`} />
      <Snippet label="Cursor, VS Code and other clients with HTTP support (mcp.json)" text={jsonConfig} />
      <Snippet label="Clients that only support stdio (e.g. Claude Desktop) via mcp-remote" text={bridgeConfig} />

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-text">What agents can do</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Browse the collection tree and search requests by name or URL</li>
          <li>Create, edit, move and delete collections, folders and requests</li>
          <li>Import Postman, Insomnia, OpenAPI, cURL and HAR; export Postman, Insomnia, OpenAPI and Markdown</li>
          <li>Manage environments and switch the active one</li>
          <li>Send saved requests like the Send button (environment, auth, scripts) and read the response</li>
        </ul>
        <button type="button" className="text-accent hover:underline" onClick={onShowTools}>
          See every tool and its parameters →
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-text">Security</p>
        <p>
          The server listens on 127.0.0.1 only and refuses requests from web pages, so websites can&apos;t reach it.
          Any program running on this computer can connect without a token. Change the port with the{' '}
          <code className="font-mono text-text">VOLT_MCP_PORT</code> environment variable.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tools (docs generated from the live tool catalogue)
// ─────────────────────────────────────────────────────────

interface SchemaProp {
  type?: string | string[];
  description?: string;
  enum?: string[];
  default?: unknown;
}

function typeLabel(p: SchemaProp): string {
  if (p.enum) return p.enum.join(' | ');
  if (Array.isArray(p.type)) return p.type.join(' | ');
  return p.type ?? 'any';
}

function ToolsTab({ tools }: { tools: McpTool[] }) {
  const [filter, setFilter] = useState('');
  const shown = tools.filter((t) =>
    `${t.name} ${t.title} ${t.description}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter tools…"
        className="w-full rounded border border-border bg-bg px-2 py-1 text-xs text-text outline-none focus:border-accent"
      />
      {shown.map((t) => (
        <ToolDoc key={t.name} tool={t} />
      ))}
    </div>
  );
}

function ToolDoc({ tool }: { tool: McpTool }) {
  const schema = tool.inputSchema as { properties?: Record<string, SchemaProp>; required?: string[] };
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  return (
    <div className="rounded-md border border-border bg-bg p-3 text-xs">
      <div className="flex items-center gap-2">
        <code className="font-mono font-semibold text-text">{tool.name}</code>
        <span className="text-text-muted">{tool.title}</span>
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px]',
            tool.destructive
              ? 'bg-error/15 text-error'
              : tool.readOnly
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning',
          )}
        >
          {tool.destructive ? 'destructive' : tool.readOnly ? 'read-only' : 'writes'}
        </span>
      </div>
      <p className="mt-1 text-text-muted">{tool.description}</p>
      {props.length > 0 && (
        <table className="mt-2 w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            <col className="w-36" />
            <col className="w-44" />
            <col />
          </colgroup>
          <tbody>
            {props.map(([name, p]) => (
              <tr key={name} className="border-t border-border align-top">
                <td className="truncate py-1 pr-3 font-mono text-text">
                  {name}
                  {required.has(name) && <span className="text-error">*</span>}
                </td>
                <td className="break-words py-1 pr-3 font-mono text-text-muted">{typeLabel(p)}</td>
                <td className="py-1 text-text-muted">{p.description ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ActivityTab({ info }: { info: McpInfo }) {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const calls = useMemo(
    () => (clientFilter ? info.calls.filter((c) => c.sessionId === clientFilter) : info.calls),
    [info.calls, clientFilter],
  );

  const clear = async () => {
    await voltApi['mcp:clearActivity']({});
    setClientFilter(null);
    void qc.invalidateQueries({ queryKey: ['mcp-info'] });
  };

  return (
    <div className="space-y-4 text-xs">
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Agents</h4>
          <Button size="sm" variant="ghost" onClick={clear} title="Clear the call log and closed sessions">
            <Trash2 size={12} /> Clear
          </Button>
        </div>
        {info.clients.length === 0 ? (
          <p className="rounded border border-dashed border-border px-3 py-4 text-center text-text-muted">
            No agent has connected since Volt started. Use the Connect tab to add Volt to your agent.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded border border-border">
            {info.clients.map((c) => (
              <button
                type="button"
                key={c.sessionId}
                onClick={() => setClientFilter(clientFilter === c.sessionId ? null : c.sessionId)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg',
                  clientFilter === c.sessionId && 'bg-accent/10',
                )}
                title="Click to show only this agent's calls"
              >
                <Bot size={13} className={c.active ? 'text-success' : 'text-text-muted'} />
                <span className="font-medium text-text">{c.name}</span>
                {c.version && <span className="font-mono text-[10px] text-text-muted">v{c.version}</span>}
                <span
                  className={cn(
                    'rounded px-1 text-[10px]',
                    c.active ? 'bg-success/15 text-success' : 'bg-bg-elevated text-text-muted',
                  )}
                >
                  {c.closed ? 'disconnected' : c.active ? 'active' : 'idle'}
                </span>
                <span className="ml-auto text-[11px] text-text-muted">
                  {c.callCount} call{c.callCount === 1 ? '' : 's'} · last seen {timeAgo(c.lastSeenAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Tool calls{clientFilter && ' (filtered)'}
          <span className="ml-1 normal-case tracking-normal">· {calls.length}</span>
        </h4>
        {calls.length === 0 ? (
          <p className="rounded border border-dashed border-border px-3 py-4 text-center text-text-muted">
            No tool calls yet.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded border border-border">
            {calls.map((c) => (
              <CallRow key={c.id} call={c} />
            ))}
          </div>
        )}
        <p className="text-[10px] text-text-muted">Kept in memory for this session only (last 300 calls).</p>
      </section>
    </div>
  );
}

function CallRow({ call }: { call: McpCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-bg"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-text-muted">{clockTime(call.at)}</span>
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', call.ok ? 'bg-success' : 'bg-error')} />
        <code className="shrink-0 font-mono text-text">{call.tool}</code>
        <span className="shrink-0 text-text-muted">{call.clientName}</span>
        {!call.ok && call.error && <span className="min-w-0 truncate text-error">{call.error}</span>}
        <span className="ml-auto whitespace-nowrap font-mono text-[10px] text-text-muted">{call.durationMs} ms</span>
      </button>
      {open && (
        <div className="space-y-2 bg-bg px-3 pb-3 pt-1">
          <Block label="Arguments" text={call.args} />
          {call.error && <Block label="Error" text={call.error} error />}
          {call.result && <Block label="Result" text={call.result} />}
        </div>
      )}
    </div>
  );
}

function Block({ label, text, error }: { label: string; text: string; error?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <pre
        className={cn(
          'max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-bg-elevated p-2 font-mono text-[11px]',
          error ? 'text-error' : 'text-text',
        )}
      >
        {text}
      </pre>
    </div>
  );
}
