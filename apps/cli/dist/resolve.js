"use strict";
// Variable substitution + request resolution. Mirrors the desktop's
// electron/core/http/resolve.ts logic at a smaller scope — we only need
// to support what the CLI can send (no GraphQL editor body, no binary
// uploads, etc., but we leave hooks so they can be added later).
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVarMap = buildVarMap;
exports.substituteWith = substituteWith;
exports.resolveRequest = resolveRequest;
exports.collectionChainFor = collectionChainFor;
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
function buildVarMap(ctx) {
    const m = new Map();
    // Globals → env → collection chain (deepest last so it overrides).
    for (const [k, v] of Object.entries(ctx.globals)) {
        if (v != null)
            m.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    if (ctx.environment) {
        for (const v of ctx.environment.variables)
            m.set(v.key, v.value);
    }
    for (const c of [...ctx.collectionChain].reverse()) {
        for (const v of c.variables)
            m.set(v.key, v.value);
    }
    return m;
}
function substituteWith(vars, warnings) {
    return (s) => s.replace(VAR_RE, (_, name) => {
        const hit = vars.get(name);
        if (hit == null) {
            warnings.push({
                kind: 'unresolved-var',
                message: `Unresolved variable: {{${name}}}`,
            });
            return '';
        }
        return hit;
    });
}
function resolveRequest(req, ctx) {
    const warnings = [];
    const vars = buildVarMap(ctx);
    const subst = substituteWith(vars, warnings);
    // Headers (skip disabled, subst key + value)
    const headers = {};
    for (const h of req.headers ?? []) {
        if (h.enabled === false)
            continue;
        if (!h.key)
            continue;
        headers[subst(h.key)] = subst(h.value);
    }
    // URL + query params
    let url = subst(req.url);
    const qs = (req.queryParams ?? [])
        .filter((q) => q.enabled !== false && q.key)
        .map((q) => `${encodeURIComponent(subst(q.key))}=${encodeURIComponent(subst(q.value))}`)
        .join('&');
    if (qs)
        url += (url.includes('?') ? '&' : '?') + qs;
    // Body — handle the common cases. Anything unsupported emits a warning
    // and falls back to no body so the CLI still sends *something*.
    const bodyOut = resolveBody(req, subst, warnings);
    // Auth — Bearer/Basic/API key map to headers (or to query for apiKey w/ placement=query).
    applyAuth(req, headers, url, subst, warnings);
    // Pre/post scripts — explicitly unsupported in this build.
    if (req.preRequestScript?.trim() || req.postResponseScript?.trim()) {
        warnings.push({
            kind: 'unsupported-script',
            message: 'Pre/post-request scripts are not yet executed by the CLI; sending raw request.',
        });
    }
    return {
        resolved: {
            method: req.method,
            url,
            headers,
            body: bodyOut,
            timeoutMs: 60_000,
        },
        warnings,
    };
}
function resolveBody(req, subst, warnings) {
    const body = req.body;
    const type = body?.type ?? 'none';
    if (type === 'none')
        return { type: 'none' };
    if (type === 'raw') {
        const content = body.content ?? '';
        return { type: 'raw', content: subst(content) };
    }
    if (type === 'urlencoded') {
        const fields = body
            .fields ?? [];
        const content = fields
            .filter((f) => f.enabled !== false && f.key)
            .map((f) => `${encodeURIComponent(subst(f.key))}=${encodeURIComponent(subst(f.value))}`)
            .join('&');
        return { type: 'raw', content };
    }
    if (type === 'graphql') {
        const q = body.query ?? '';
        const v = body.variables ?? '';
        let variables = undefined;
        if (v.trim()) {
            try {
                variables = JSON.parse(subst(v));
            }
            catch {
                warnings.push({
                    kind: 'unsupported-body',
                    message: 'GraphQL variables were not valid JSON; sending the query without variables.',
                });
            }
        }
        return {
            type: 'raw',
            content: JSON.stringify({ query: subst(q), variables }),
        };
    }
    warnings.push({
        kind: 'unsupported-body',
        message: `Body type "${type}" is not yet supported by the CLI; sending no body.`,
    });
    return { type: 'none' };
}
function applyAuth(req, headers, _url, subst, warnings) {
    const auth = req.auth;
    const t = auth?.type ?? 'none';
    if (t === 'none')
        return;
    if (t === 'bearer') {
        const token = auth.token ?? '';
        if (token)
            headers['Authorization'] = `Bearer ${subst(token)}`;
        return;
    }
    if (t === 'basic') {
        const u = auth.username ?? '';
        const p = auth.password ?? '';
        const encoded = Buffer.from(`${subst(u)}:${subst(p)}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
        return;
    }
    if (t === 'apiKey') {
        const key = auth.key ?? '';
        const value = auth.value ?? '';
        const placement = auth.placement ?? 'header';
        if (placement === 'header') {
            headers[subst(key)] = subst(value);
        }
        else {
            // The url is only available read-only here; we'd have to mutate. For
            // first milestone we route apiKey-in-query through headers if asked,
            // but real apiKey-in-query support is on the polish list.
            warnings.push({
                kind: 'unsupported-auth',
                message: 'API key in query string is not yet wired in the CLI; sent as header instead.',
            });
            headers[subst(key)] = subst(value);
        }
        return;
    }
    warnings.push({
        kind: 'unsupported-auth',
        message: `Auth type "${t}" is not yet supported by the CLI; sending unauthenticated request.`,
    });
}
/** Walk parents upward, returning the chain from the request's collection
 *  (deepest) → root. Caller reverses if they want root-first.
 */
function collectionChainFor(req, collections) {
    const chain = [];
    let id = req.collectionId;
    const byId = new Map(collections.map((c) => [c.id, c]));
    while (id) {
        const c = byId.get(id);
        if (!c)
            break;
        chain.push(c);
        id = c.parentId;
    }
    return chain;
}
