import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateWorkspace } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';

export function NewWorkspaceModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'new-workspace';
  const [name, setName] = useState('');
  const createWorkspace = useCreateWorkspace();
  const setWorkspaceId = useSelection((s) => s.setWorkspaceId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const result = await createWorkspace.mutateAsync({ name: name.trim() });
      if (result?.id) setWorkspaceId(result.id);
      setName('');
      close();
    } catch {
      // Hook already toasts the error; keep the modal open so the user can retry.
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="New workspace">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API project"
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || createWorkspace.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
