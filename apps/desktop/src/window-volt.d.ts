// Renderer-side typings for window.volt.
// Maps each IPC channel to its typed input/output.

import type { MainEvent, IpcChannel, IpcInput, IpcOutput } from '@volt/shared';

declare global {
  interface Window {
    volt: {
      [K in IpcChannel]: (input: IpcInput<K>) => Promise<IpcOutput<K>>;
    } & {
      on(listener: (event: MainEvent) => void): () => void;
    };
    voltMeta: {
      channels: string[];
      buildVersion: string;
    };
  }
}

export {};
