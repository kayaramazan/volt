#!/usr/bin/env node
"use strict";
// Volt CLI — send saved requests against the same volt.db the desktop uses.
//
// Examples:
//   volt list workspaces
//   volt list requests --workspace Personal
//   volt send Personal/auth/login
//   volt send --id 7f3c…
//   volt send 'auth/login' --env Staging --json
//
// Exit codes:
//   0  success (2xx response)
//   1  HTTP error (non-2xx response, or send-time network failure)
//   2  usage / setup error (no DB, unknown request, bad arguments)
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const resolve_1 = require("./resolve");
const send_1 = require("./send");
const paths_1 = require("./paths");
function parseArgs(argv) {
    const flags = {
        json: false,
        bodyOnly: false,
        verbose: false,
        help: false,
        noVarWarnings: false,
    };
    const positional = [];
    let command = argv[0] ?? '';
    if (!command || command.startsWith('-')) {
        // No command — treat as help.
        return { command: '', positional, flags: { ...flags, help: true } };
    }
    let i = 1;
    while (i < argv.length) {
        const a = argv[i];
        switch (a) {
            case '-w':
            case '--workspace':
                flags.workspace = argv[++i];
                break;
            case '-e':
            case '--env':
            case '--environment':
                flags.env = argv[++i];
                break;
            case '--id':
                flags.id = argv[++i];
                break;
            case '--json':
                flags.json = true;
                break;
            case '--body-only':
            case '--body':
                flags.bodyOnly = true;
                break;
            case '-v':
            case '--verbose':
                flags.verbose = true;
                break;
            case '--no-var-warnings':
                flags.noVarWarnings = true;
                break;
            case '-h':
            case '--help':
                flags.help = true;
                break;
            default:
                if (a.startsWith('-')) {
                    throw new db_1.VoltCliError(`Unknown flag: ${a}`);
                }
                positional.push(a);
        }
        i++;
    }
    return { command, positional, flags };
}
const HELP = `Volt CLI

Usage:
  volt list <workspaces|collections|requests|environments> [--workspace <name>]
  volt send <path>                  Send a saved request. Path is "workspace/.../request"
                                    or just the trailing parts (matched fuzzily).
  volt send --id <uuid>             Send by request id.

Flags:
  -w, --workspace <name>            Override the workspace lookup.
  -e, --env <name>                  Use a specific environment (else the active one).
  --json                            Output a single JSON object instead of pretty text.
  --body-only                       Print just the response body to stdout.
  -v, --verbose                     Include the resolved request + timing info.
  --no-var-warnings                 Suppress warnings about unresolved {{vars}}.
  -h, --help                        This help text.

Environment:
  VOLT_DB        Override the path to volt.db.
  VOLT_USER_DATA Override the userData directory (parent of volt.db).

Exit codes:
  0  2xx success     1  non-2xx response or network error     2  usage / lookup error
`;
async function main(argv) {
    const { command, positional, flags } = parseArgs(argv);
    if (flags.help || !command) {
        process.stdout.write(HELP);
        return 0;
    }
    switch (command) {
        case 'list':
            return runList(positional, flags);
        case 'send':
            return runSend(positional, flags);
        case 'where':
            // Convenience: print the resolved volt.db path and exit.
            process.stdout.write(`${(0, paths_1.dbPath)()}\n`);
            return 0;
        default:
            throw new db_1.VoltCliError(`Unknown command: ${command}. Try \`volt --help\`.`);
    }
}
// ─────────────────────────────────────────────────────────
// list
// ─────────────────────────────────────────────────────────
function runList(positional, flags) {
    const what = (positional[0] ?? 'workspaces').toLowerCase();
    if (what === 'workspaces' || what === 'ws') {
        const ws = (0, db_1.listWorkspaces)();
        if (flags.json) {
            process.stdout.write(JSON.stringify(ws, null, 2) + '\n');
            return 0;
        }
        for (const w of ws) {
            process.stdout.write(`${w.id}\t${w.name}\n`);
        }
        return 0;
    }
    const workspace = pickWorkspace(flags);
    if (what === 'collections' || what === 'cols') {
        const cols = (0, db_1.listCollections)(workspace.id);
        if (flags.json) {
            process.stdout.write(JSON.stringify(cols, null, 2) + '\n');
            return 0;
        }
        for (const c of cols) {
            const breadcrumb = collectionBreadcrumb(c, cols);
            process.stdout.write(`${c.id}\t${breadcrumb}\n`);
        }
        return 0;
    }
    if (what === 'requests' || what === 'reqs') {
        const reqs = (0, db_1.listRequests)(workspace.id);
        const cols = (0, db_1.listCollections)(workspace.id);
        if (flags.json) {
            process.stdout.write(JSON.stringify(reqs, null, 2) + '\n');
            return 0;
        }
        for (const r of reqs) {
            const col = r.collectionId ? cols.find((c) => c.id === r.collectionId) ?? null : null;
            const breadcrumb = col ? collectionBreadcrumb(col, cols) : '(no collection)';
            process.stdout.write(`${r.id}\t${r.method.padEnd(6)}\t${breadcrumb}/${r.name}\n`);
        }
        return 0;
    }
    if (what === 'environments' || what === 'envs') {
        const envs = (0, db_1.listEnvironments)(workspace.id);
        if (flags.json) {
            process.stdout.write(JSON.stringify(envs, null, 2) + '\n');
            return 0;
        }
        for (const e of envs) {
            process.stdout.write(`${e.id}\t${e.name}${e.id === workspace.activeEnvironmentId ? '\t[active]' : ''}\n`);
        }
        return 0;
    }
    throw new db_1.VoltCliError(`Unknown list target: ${what}.`);
}
// ─────────────────────────────────────────────────────────
// send
// ─────────────────────────────────────────────────────────
async function runSend(positional, flags) {
    let req = null;
    if (flags.id) {
        req = (0, db_1.getRequest)(flags.id);
        if (!req)
            throw new db_1.VoltCliError(`No request with id ${flags.id}`);
    }
    else {
        const pathArg = positional[0];
        if (!pathArg)
            throw new db_1.VoltCliError('Missing request path. Try `volt send <workspace/.../name>`.');
        const found = findRequestByPath(pathArg, flags);
        req = found;
    }
    const workspaceObj = (0, db_1.listWorkspaces)().find((w) => w.id === req.workspaceId);
    if (!workspaceObj)
        throw new db_1.VoltCliError(`Workspace ${req.workspaceId} not found.`);
    const cols = (0, db_1.listCollections)(req.workspaceId);
    const chain = (0, resolve_1.collectionChainFor)(req, cols);
    // Environment: flag overrides, otherwise active env on the workspace.
    const envs = (0, db_1.listEnvironments)(req.workspaceId);
    let env = null;
    if (flags.env) {
        env = envs.find((e) => e.name.toLowerCase() === flags.env.toLowerCase()) ?? null;
        if (!env)
            throw new db_1.VoltCliError(`Environment "${flags.env}" not found in workspace "${workspaceObj.name}".`);
    }
    else if (workspaceObj.activeEnvironmentId) {
        env = envs.find((e) => e.id === workspaceObj.activeEnvironmentId) ?? null;
    }
    const { resolved, warnings } = (0, resolve_1.resolveRequest)(req, {
        collectionChain: chain,
        environment: env,
        globals: (0, db_1.listGlobals)(),
    });
    if (!flags.json && !flags.bodyOnly) {
        process.stderr.write(`▶ ${resolved.method} ${resolved.url}${env ? `  [env: ${env.name}]` : ''}\n`);
    }
    if (!flags.noVarWarnings)
        emitWarnings(warnings, flags);
    const result = await (0, send_1.sendRequest)(resolved);
    return emitResult(result, resolved, flags);
}
function emitWarnings(warnings, flags) {
    for (const w of warnings) {
        if (flags.json)
            continue; // included in the JSON payload instead
        process.stderr.write(`⚠ ${w.message}\n`);
    }
}
function emitResult(result, resolved, flags) {
    if (!result.ok) {
        if (flags.json) {
            process.stdout.write(JSON.stringify({ ...result, request: resolved }, null, 2) + '\n');
        }
        else {
            process.stderr.write(`✗ ${result.errorCode}: ${result.errorMessage} (${result.durationMs}ms)\n`);
        }
        return 1;
    }
    const bodyText = result.body.toString('utf-8');
    if (flags.bodyOnly) {
        process.stdout.write(bodyText);
        if (!bodyText.endsWith('\n'))
            process.stdout.write('\n');
        return result.statusCode >= 200 && result.statusCode < 300 ? 0 : 1;
    }
    if (flags.json) {
        let parsedBody = bodyText;
        if ((result.contentType ?? '').includes('json')) {
            try {
                parsedBody = JSON.parse(bodyText);
            }
            catch {
                parsedBody = bodyText;
            }
        }
        process.stdout.write(JSON.stringify({
            ok: true,
            statusCode: result.statusCode,
            durationMs: result.durationMs,
            headers: result.headers,
            contentType: result.contentType,
            body: parsedBody,
            request: flags.verbose ? resolved : undefined,
        }, null, 2) + '\n');
        return result.statusCode >= 200 && result.statusCode < 300 ? 0 : 1;
    }
    // Pretty text output to stdout.
    process.stderr.write(`${statusGlyph(result.statusCode)} ${result.statusCode}  ${result.durationMs}ms  ${formatBytes(result.body.length)}\n`);
    if (flags.verbose) {
        for (const [k, v] of Object.entries(result.headers)) {
            process.stderr.write(`  ${k}: ${v}\n`);
        }
        process.stderr.write('\n');
    }
    process.stdout.write(maybePrettyJson(bodyText, result.contentType));
    if (!bodyText.endsWith('\n'))
        process.stdout.write('\n');
    return result.statusCode >= 200 && result.statusCode < 300 ? 0 : 1;
}
// ─────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────
function pickWorkspace(flags) {
    const all = (0, db_1.listWorkspaces)();
    if (all.length === 0)
        throw new db_1.VoltCliError('No workspaces in volt.db.');
    if (flags.workspace) {
        const w = (0, db_1.findWorkspaceByName)(flags.workspace);
        if (!w) {
            throw new db_1.VoltCliError(`Workspace "${flags.workspace}" not found. Available: ${all.map((x) => x.name).join(', ')}`);
        }
        return w;
    }
    if (all.length === 1)
        return all[0];
    throw new db_1.VoltCliError(`Multiple workspaces present (${all
        .map((x) => x.name)
        .join(', ')}); pick one with --workspace.`);
}
/**
 * Resolves a path like "Personal/auth/login" or just "login" into a
 * request row. Matches are case-insensitive and segment-by-segment from
 * the rightmost piece (the request name) backwards.
 */
function findRequestByPath(rawPath, flags) {
    const segs = rawPath.split('/').map((s) => s.trim()).filter(Boolean);
    if (segs.length === 0)
        throw new db_1.VoltCliError('Empty request path.');
    const requestName = segs[segs.length - 1];
    const folderSegs = segs.slice(0, -1);
    // Workspace: explicit --workspace wins; otherwise treat segs[0] as a workspace name
    // if it matches one, else fall back to single-workspace auto-pick.
    let workspace = flags.workspace ? (0, db_1.findWorkspaceByName)(flags.workspace) : null;
    let folderInsideWs = folderSegs;
    if (!workspace && folderSegs.length > 0) {
        const candidate = (0, db_1.findWorkspaceByName)(folderSegs[0]);
        if (candidate) {
            workspace = candidate;
            folderInsideWs = folderSegs.slice(1);
        }
    }
    if (!workspace)
        workspace = pickWorkspace(flags);
    const requests = (0, db_1.listRequests)(workspace.id);
    const collections = (0, db_1.listCollections)(workspace.id);
    const byCollection = new Map(collections.map((c) => [c.id, c]));
    const candidates = requests.filter((r) => r.name.toLowerCase() === requestName.toLowerCase());
    if (candidates.length === 0) {
        throw new db_1.VoltCliError(`No request named "${requestName}" found in workspace "${workspace.name}".`);
    }
    // If the user gave a folder path, narrow by it.
    if (folderInsideWs.length > 0) {
        const matched = candidates.filter((r) => folderPathMatches(r, folderInsideWs, byCollection));
        if (matched.length === 1)
            return matched[0];
        if (matched.length > 1) {
            throw new db_1.VoltCliError(`Ambiguous request "${rawPath}" — ${matched.length} matches.`);
        }
        throw new db_1.VoltCliError(`Request "${requestName}" exists but not under folder "${folderInsideWs.join('/')}".`);
    }
    if (candidates.length === 1)
        return candidates[0];
    // Multiple — try to disambiguate by full breadcrumb in the error.
    const labels = candidates.map((r) => {
        const breadcrumb = r.collectionId
            ? collectionBreadcrumb(byCollection.get(r.collectionId), collections)
            : '(no collection)';
        return `${breadcrumb}/${r.name}`;
    });
    throw new db_1.VoltCliError(`Ambiguous request "${requestName}" — ${candidates.length} matches:\n  ${labels.join('\n  ')}`);
}
function folderPathMatches(req, folderSegs, byId) {
    // Walk the request's collection chain root→deepest. The folderSegs must
    // appear as a contiguous suffix (case-insensitive). Example: a request
    // under "API/v1/users" matches segs ["v1","users"] and ["users"], but
    // not ["v2","users"].
    const chain = [];
    let id = req.collectionId;
    while (id) {
        const c = byId.get(id);
        if (!c)
            break;
        chain.unshift(c.name);
        id = c.parentId;
    }
    if (folderSegs.length > chain.length)
        return false;
    for (let i = 0; i < folderSegs.length; i++) {
        const a = chain[chain.length - folderSegs.length + i];
        const b = folderSegs[i];
        if (a.toLowerCase() !== b.toLowerCase())
            return false;
    }
    return true;
}
function collectionBreadcrumb(c, all) {
    const byId = new Map(all.map((x) => [x.id, x]));
    const parts = [];
    let cur = c;
    while (cur) {
        parts.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join('/');
}
// ─────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────
function statusGlyph(code) {
    if (code >= 200 && code < 300)
        return '✓';
    if (code >= 300 && code < 400)
        return '↻';
    if (code >= 400 && code < 500)
        return '⚠';
    return '✗';
}
function formatBytes(n) {
    if (n < 1024)
        return `${n}B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(2)}MB`;
}
function maybePrettyJson(text, contentType) {
    if (!contentType || !contentType.toLowerCase().includes('json'))
        return text;
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    }
    catch {
        return text;
    }
}
// ─────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────
main(process.argv.slice(2))
    .then((code) => {
    (0, db_1.closeDb)();
    process.exit(code ?? 0);
})
    .catch((e) => {
    (0, db_1.closeDb)();
    if (e instanceof db_1.VoltCliError) {
        process.stderr.write(`volt: ${e.message}\n`);
        process.exit(e.exitCode);
    }
    process.stderr.write(`volt: ${e.message}\n`);
    if (process.env.VOLT_DEBUG) {
        process.stderr.write(e.stack + '\n');
    }
    process.exit(2);
});
