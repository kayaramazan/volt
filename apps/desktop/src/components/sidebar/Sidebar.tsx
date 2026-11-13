import { Plus, Upload, FolderPlus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { CollectionTree } from './CollectionTree';
import { HistoryPane } from './HistoryPane';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';

interface Props {
  workspaceId: string;
}

/**
 * Left sidebar — tabbed between Collections and History.
 * Top has quick actions: new request, new collection, import.
 */
export function Sidebar({ workspaceId }: Props) {
  const { open: openModal } = useModals();
  // Controlled + persisted so the pane survives workspace switches / restarts.
  const sidebarTab = useSelection((s) => s.sidebarTab);
  const setSidebarTab = useSelection((s) => s.setSidebarTab);

  return (
    <div className="flex h-full flex-col border-r border-border bg-bg">
      {/* Quick actions */}
      <div className="flex gap-1 border-b border-border p-2">
        <Button
          size="sm"
          variant="default"
          className="flex-1"
          onClick={() => openModal({ kind: 'new-request', collectionId: null })}
          title="New request (⌘N)"
        >
          <Plus size={12} />
          Request
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'new-collection', parentId: null })}
          title="New collection"
        >
          <FolderPlus size={13} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'import' })}
          title="Import"
        >
          <Upload size={13} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={sidebarTab}
        onValueChange={(v) => setSidebarTab(v === 'history' ? 'history' : 'collections')}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="collections" className="min-h-0 flex-1 overflow-y-auto">
          <CollectionTree workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto">
          <HistoryPane workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
