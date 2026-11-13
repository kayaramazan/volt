"use strict";
// Sends a resolved request via undici and returns a structured result.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRequest = sendRequest;
const undici_1 = require("undici");
async function sendRequest(req) {
    const start = Date.now();
    try {
        const url = req.url;
        const headers = { ...req.headers };
        let body;
        if (req.body.type === 'raw') {
            body = req.body.content;
            // Auto-default content-type for raw bodies if the caller didn't set one.
            const hasCT = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
            if (!hasCT && body.length > 0)
                headers['content-type'] = 'application/json';
        }
        const res = await (0, undici_1.request)(url, {
            method: req.method,
            headers,
            body,
            headersTimeout: req.timeoutMs,
            bodyTimeout: req.timeoutMs,
        });
        const buf = Buffer.from(await res.body.arrayBuffer());
        const flatHeaders = {};
        for (const [k, v] of Object.entries(res.headers)) {
            flatHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        }
        const contentType = flatHeaders['content-type'] ?? null;
        return {
            ok: true,
            statusCode: res.statusCode,
            headers: flatHeaders,
            body: buf,
            contentType,
            durationMs: Date.now() - start,
        };
    }
    catch (e) {
        const err = e;
        return {
            ok: false,
            errorCode: err.code ?? 'ERR',
            errorMessage: err.message ?? String(e),
            durationMs: Date.now() - start,
        };
    }
}
