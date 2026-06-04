import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestEditor } from '@/components/request/RequestEditor';
import { GrpcRequestEditor } from '@/components/request/GrpcRequestEditor';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { TabStrip } from '@/components/layout/TabStrip';
import { EmptyState } from '@/components/layout/EmptyState';
import { ConflictBanner } from '@/components/conflict/ConflictBanner';
import { useRequest } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useDrafts } from '@/stores/drafts';

interface Props {
  workspaceId: string;
}

/**
 * Two-column layout: sidebar | (request editor stacked above response viewer).
 * Sidebar is resizable horizontally; request/response split is resizable
 * vertically.
 */
export function Workspace({ workspaceId }: Props) {
  const { requestId, responsePanelOpen, sidebarOpen, setResponsePanelOpen } = useSelection();
  const setLastResponse = useDrafts((s) => s.setLastResponse);
  const lastResponses = useDrafts((s) => s.lastResponses);
  const inFlight = useDrafts((s) => s.inFlight);

  // Each request's last response is cached by requestId in the drafts store,
  // so switching between requests shows each one's own response (or nothing
  // if it hasn't been sent yet in this session).
  const response = requestId ? (lastResponses.get(requestId) ?? null) : null;
  const sending = !!(requestId && inFlight.get(requestId));

  return (
    <div className="flex h-full flex-col">
      <ConflictBanner workspaceId={workspaceId} />

      <PanelGroup direction="horizontal" className="flex-1">
        {sidebarOpen && (
          <>
            <Panel defaultSize={20} minSize={14} maxSize={35}>
              <Sidebar workspaceId={workspaceId} />
            </Panel>
            <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent/40" />
          </>
        )}

        <Panel defaultSize={80} minSize={40}>
          <div className="flex h-full flex-col bg-bg">
            <TabStrip />
            {requestId ? (
              <EditorPane
                requestId={requestId}
                workspaceId={workspaceId}
                responsePanelOpen={responsePanelOpen}
                onResponse={(r) => {
                  setLastResponse(requestId, r);
                  setResponsePanelOpen(true);
                }}
                response={response}
                sending={sending}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function EditorPane({
  requestId,
  workspaceId,
  responsePanelOpen,
  onResponse,
  response,
  sending,
}: {
  requestId: string;
  workspaceId: string;
  responsePanelOpen: boolean;
  onResponse: (r: unknown) => void;
  response: unknown;
  sending: boolean;
}) {
  // Peek at the saved row so we can dispatch on body.type. gRPC requests get a
  // dedicated editor that owns the full pane (no separate ResponseViewer — the
  // gRPC response renders inside its own Response tab).
  const { data: saved } = useRequest(requestId);
  const isGrpc = (saved?.body as { type?: string } | undefined)?.type === 'grpc';

  if (isGrpc) {
    return <GrpcRequestEditor requestId={requestId} workspaceId={workspaceId} />;
  }

  return (
    <PanelGroup direction="vertical" className="flex-1">
      <Panel defaultSize={60} minSize={25}>
        <RequestEditor requestId={requestId} workspaceId={workspaceId} onResponse={onResponse} />
      </Panel>
      {responsePanelOpen && (
        <>
          <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-accent/40" />
          <Panel defaultSize={40} minSize={15}>
            <ResponseViewer response={response as never} loading={sending} requestId={requestId} />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
