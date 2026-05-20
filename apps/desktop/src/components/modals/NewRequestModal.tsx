import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useCreateRequest } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function NewRequestModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'new-request';
  const collectionId = current.kind === 'new-request' ? current.collectionId : null;

  const { workspaceId, selectRequest } = useSelection();
  const createRequest = useCreateRequest();
  const [name, setName] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;
    const r = await createRequest.mutateAsync({
      workspaceId,
      collectionId,
      name: name.trim(),
      method,
      url: url.trim(),
    });
    if (r?.id) selectRequest(r.id);
    setName('');
    setUrl('');
    close();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="New request">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Get users"
            autoFocus
            required
          />
        </div>
        <div className="flex gap-2">
          <div className="w-28">
            <label className="mb-1 block text-xs text-text-muted">Method</label>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={METHODS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-muted">URL (optional)</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/users"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || createRequest.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
