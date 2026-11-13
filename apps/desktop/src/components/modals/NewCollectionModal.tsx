import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCollection } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';

export function NewCollectionModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'new-collection';
  const parentId = current.kind === 'new-collection' ? current.parentId : null;
  const { workspaceId } = useSelection();

  const create = useCreateCollection();
  const [name, setName] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;
    try {
      await create.mutateAsync({ workspaceId, parentId, name: name.trim() });
      setName('');
      close();
    } catch {
      // Hook already toasts the error; keep the modal open so the user can retry.
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title={parentId ? 'New sub-folder' : 'New collection'}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auth API" autoFocus required />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
