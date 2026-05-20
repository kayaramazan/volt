import { Select } from '@/components/ui/Select';
import { KeyValueEditor, type KeyValueRow } from './KeyValueEditor';
import { CodeEditor } from './CodeEditor';

interface RawBody {
  type: 'raw';
  language?: string;
  content: string;
}
interface FormBody {
  type: 'form';
  fields: Array<{ id: string; key: string; kind: 'text' | 'file'; value: string; enabled?: boolean }>;
}
interface UrlencodedBody {
  type: 'urlencoded';
  fields: KeyValueRow[];
}
interface BinaryBody {
  type: 'binary';
  filePath: string;
}
interface NoneBody {
  type: 'none';
}
export type Body = RawBody | FormBody | UrlencodedBody | BinaryBody | NoneBody;

interface Props {
  body: Body;
  onChange: (body: Body) => void;
}

/**
 * Body editor — top selector picks body type, then renders the appropriate
 * editor. We store the body type alongside its data so switching types
 * doesn't immediately drop user data (a soft user-friendliness).
 */
export function BodyEditor({ body, onChange }: Props) {
  function setType(newType: Body['type']) {
    if (newType === body.type) return;
    switch (newType) {
      case 'none':
        onChange({ type: 'none' });
        return;
      case 'raw':
        onChange({ type: 'raw', language: 'json', content: '' });
        return;
      case 'form':
        onChange({ type: 'form', fields: [] });
        return;
      case 'urlencoded':
        onChange({ type: 'urlencoded', fields: [] });
        return;
      case 'binary':
        onChange({ type: 'binary', filePath: '' });
        return;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-xs text-text-muted">Type</span>
        <Select
          value={body.type}
          onChange={(e) => setType(e.target.value as Body['type'])}
          options={[
            { value: 'none', label: 'None' },
            { value: 'raw', label: 'Raw' },
            { value: 'form', label: 'Form data' },
            { value: 'urlencoded', label: 'URL-encoded' },
            { value: 'binary', label: 'Binary' },
          ]}
          className="w-32"
        />
        {body.type === 'raw' && (
          <>
            <span className="text-xs text-text-muted">Language</span>
            <Select
              value={body.language ?? 'json'}
              onChange={(e) => onChange({ ...body, language: e.target.value })}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'xml', label: 'XML' },
                { value: 'html', label: 'HTML' },
                { value: 'javascript', label: 'JavaScript' },
                { value: 'text', label: 'Text' },
              ]}
              className="w-28"
            />
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {body.type === 'none' && (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            This request has no body.
          </div>
        )}
        {body.type === 'raw' && (
          <CodeEditor
            value={body.content}
            onChange={(v) => onChange({ ...body, content: v })}
            language={(body.language as never) ?? 'json'}
            className="h-full"
            placeholder="Type the request body…"
          />
        )}
        {body.type === 'urlencoded' && (
          <KeyValueEditor rows={body.fields} onChange={(fields) => onChange({ ...body, fields })} />
        )}
        {body.type === 'form' && (
          <div className="flex flex-col">
            <KeyValueEditor
              rows={body.fields.map((f) => ({
                id: f.id,
                key: f.key,
                value: f.value,
                enabled: f.enabled,
              }))}
              onChange={(rows) =>
                onChange({
                  ...body,
                  fields: rows.map((r) => ({
                    id: r.id,
                    key: r.key,
                    value: r.value,
                    enabled: r.enabled,
                    kind: body.fields.find((f) => f.id === r.id)?.kind ?? 'text',
                  })),
                })
              }
            />
            <p className="border-t border-border px-2 py-1 text-[10px] text-text-muted">
              For file fields, edit JSON manually in v1.0 — file picker coming soon.
            </p>
          </div>
        )}
        {body.type === 'binary' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-xs">
            <p className="text-text-muted">{body.filePath || 'No file selected'}</p>
            <button
              type="button"
              onClick={async () => {
                const result = await window.volt['app:showFilePicker']({});
                if (!result.cancelled && result.filePath) {
                  onChange({ ...body, filePath: result.filePath });
                }
              }}
              className="rounded border border-border px-3 py-1 text-text hover:bg-bg-elevated"
            >
              Choose file…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
