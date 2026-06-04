// Variables context — exposes the merged globals + environment + collection
// variable map, plus the active workspace/environment metadata that the
// VarEditor popover needs to know where to persist edits.

import { createContext, useContext, type ReactNode } from 'react';

export type VarScope = 'globals' | 'env' | 'collection';

export interface VarInfo {
  value: string;
  scope: VarScope;
  /** Env id, collection id, or null for globals. */
  scopeId: string | null;
  /** Human-readable scope label shown in the popover. */
  scopeName: string;
}

export interface VariablesContextValue {
  /** Resolved variable name → info (value + which scope it came from). */
  vars: Map<string, VarInfo>;
  /** Workspace the request belongs to — needed for globals mutations. */
  workspaceId: string;
  /** Active environment id (null when "No Environment" is selected). */
  activeEnvId: string | null;
  /** Active environment name, for the "Save to" label on unresolved vars. */
  activeEnvName: string | null;
}

const Ctx = createContext<VariablesContextValue | null>(null);

export function VariablesProvider({
  value,
  children,
}: {
  value: VariablesContextValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVariables(): VariablesContextValue | null {
  return useContext(Ctx);
}

/** Convenience: resolve a single var name. Returns undefined if not set. */
export function useVarInfo(name: string): VarInfo | undefined {
  const ctx = useContext(Ctx);
  return ctx?.vars.get(name);
}
