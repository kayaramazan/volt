import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestEditor } from '@/components/request/RequestEditor';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { TabStrip } from '@/components/layout/TabStrip';
import { EmptyState } from '@/components/layout/EmptyState';
import { ConflictBanner } from '@/components/conflict/ConflictBanner';
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

  const [responseInThisTab, setResponseInThisTab] = useState<unknown>(null);

  // Show response from store if not just set in current tab
  const response = requestId ? (lastResponses.get(requestId) ?? responseInThisTab) : null;
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
              <PanelGroup direction="vertical" className="flex-1">
                <Panel defaultSize={60} minSize={25}>
                  <RequestEditor
                    requestId={requestId}
                    workspaceId={workspaceId}
                    onResponse={(r) => {
                      setResponseInThisTab(r);
                      setLastResponse(requestId, r);
                      // Auto-open the response panel when a response arrives,
                      // even if the user had collapsed it before sending.
                      setResponsePanelOpen(true);
                    }}
                  />
                </Panel>
                {responsePanelOpen && (
                  <>
                    <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-accent/40" />
                    <Panel defaultSize={40} minSize={15}>
                      <ResponseViewer response={response as never} loading={sending} />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            ) : (
              <EmptyState />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
