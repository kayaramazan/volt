// Variables context — exposes the merged globals + environment + collection
// variable map, plus the active workspace/environment metadata that the
// VarEditor popover needs to know where to persist edits.

import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { setVarResolver } from './var-highlight';
import { isVariableResolved } from './variables';

export type VarScope = 'globals' | 'env' | 'collection';

export interface VarInfo {
  value: string;
  scope: VarScope;
  /** Env id, collection id, or null for globals. */
  scopeId: string | null;
  /** Human-readable scope label shown in the popover. */
  scopeName: string;
  /** Secret variables are masked wherever their value is previewed. */
  secret?: boolean;
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
  // Feed the CodeMirror highlighter (which can't read React context) so body
  // editors paint unresolved {{vars}} in red and re-paint when scopes change.
  useEffect(() => {
    const vars = value.vars;
    setVarResolver((name) => isVariableResolved(name, vars));
  }, [value.vars]);

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

/**
 * Whether `{{name}}` would resolve right now (user-defined in any scope, or a
 * `$dynamic` variable). Outside a provider every non-dynamic name counts as
 * resolved so stand-alone inputs don't paint everything red.
 */
export function useIsVarResolved(name: string): boolean {
  const ctx = useContext(Ctx);
  if (!ctx) return true;
  return isVariableResolved(name, ctx.vars);
}
