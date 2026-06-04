// gRPC engine — main-process facade over @grpc/grpc-js and @grpc/proto-loader.
// Supports proto file loading, unary calls, and all three streaming modes
// (server-streaming, client-streaming, bidirectional). Streaming follows the
// same pattern as the WebSocket engine: main holds the live call, the
// renderer drives via IPC, server-to-client messages are pushed back as
// `grpc:stream:*` events on the volt:event bus.

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { BrowserWindow } from 'electron';

const PROTO_LOADER_OPTIONS: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export interface GrpcMethodInfo {
  name: string;
  requestStream: boolean;
  responseStream: boolean;
  requestType: string;
  responseType: string;
}

export interface GrpcServiceInfo {
  name: string;
  methods: GrpcMethodInfo[];
}

export interface LoadProtoResult {
  ok: boolean;
  services: GrpcServiceInfo[];
  error?: string;
}

export async function loadProto(protoPath: string): Promise<LoadProtoResult> {
  try {
    const pkgDef = await protoLoader.load(protoPath, PROTO_LOADER_OPTIONS);
    const services = walkServices(pkgDef);
    return { ok: true, services };
  } catch (e) {
    return { ok: false, services: [], error: (e as Error).message };
  }
}

function walkServices(pkgDef: protoLoader.PackageDefinition): GrpcServiceInfo[] {
  const out: GrpcServiceInfo[] = [];
  for (const [fullName, def] of Object.entries(pkgDef)) {
    if (!isServiceDefinition(def)) continue;
    const methods: GrpcMethodInfo[] = [];
    for (const [methodName, m] of Object.entries(def)) {
      const methodDef = m as protoLoader.MethodDefinition<unknown, unknown>;
      methods.push({
        name: methodName,
        requestStream: !!methodDef.requestStream,
        responseStream: !!methodDef.responseStream,
        requestType: typeName(methodDef.requestType),
        responseType: typeName(methodDef.responseType),
      });
    }
    out.push({ name: fullName, methods });
  }
  return out;
}

function isServiceDefinition(
  def: unknown,
): def is protoLoader.ServiceDefinition {
  // proto-loader returns either a ServiceDefinition (record of MethodDefinitions),
  // a MessageTypeDefinition, or an EnumTypeDefinition. The latter two carry a
  // `format` discriminator string. ServiceDefinitions don't.
  if (!def || typeof def !== 'object') return false;
  if ('format' in def) return false;
  const values = Object.values(def as Record<string, unknown>);
  if (values.length === 0) return false;
  // Every value should look like a MethodDefinition (has a `path` field).
  return values.every(
    (v) => v !== null && typeof v === 'object' && 'path' in (v as object),
  );
}

function typeName(
  t: { type?: { name?: string } } | undefined,
): string {
  return t?.type?.name ?? 'unknown';
}

export interface InvokeUnaryInput {
  address: string;
  protoPath: string;
  service: string;
  method: string;
  message: string; // JSON
  metadata?: Record<string, string>;
  timeoutMs?: number;
}

export type InvokeUnaryResult =
  | { ok: true; response: unknown; durationMs: number }
  | { ok: false; errorCode: string; errorMessage: string; durationMs: number };

export async function invokeUnary(input: InvokeUnaryInput): Promise<InvokeUnaryResult> {
  const start = Date.now();
  try {
    const pkgDef = await protoLoader.load(input.protoPath, PROTO_LOADER_OPTIONS);
    const serviceDef = pkgDef[input.service];
    if (!serviceDef || !isServiceDefinition(serviceDef)) {
      return failure('SERVICE_NOT_FOUND', `Service "${input.service}" not found in proto.`, start);
    }
    const methodDef = (serviceDef as Record<string, protoLoader.MethodDefinition<unknown, unknown>>)[
      input.method
    ];
    if (!methodDef) {
      return failure(
        'METHOD_NOT_FOUND',
        `Method "${input.method}" not found in service "${input.service}".`,
        start,
      );
    }
    if (methodDef.requestStream || methodDef.responseStream) {
      return failure(
        'NOT_UNARY',
        'This is a streaming method — call grpc:openStream instead of grpc:invoke.',
        start,
      );
    }

    let requestObj: unknown;
    try {
      requestObj = JSON.parse(input.message || '{}');
    } catch (e) {
      return failure('INVALID_JSON', `Request message is not valid JSON: ${(e as Error).message}`, start);
    }

    const grpcObj = grpc.loadPackageDefinition(pkgDef);
    const SvcCtor = resolveServiceConstructor(grpcObj, input.service);
    if (!SvcCtor) {
      return failure(
        'SERVICE_NOT_FOUND',
        `Could not resolve service constructor for "${input.service}".`,
        start,
      );
    }
    const client = new SvcCtor(input.address, grpc.credentials.createInsecure());

    const metadata = new grpc.Metadata();
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      metadata.add(k, v);
    }
    const timeoutMs = input.timeoutMs ?? 30_000;
    const callOptions: grpc.CallOptions = {
      deadline: Date.now() + timeoutMs,
    };

    return await new Promise<InvokeUnaryResult>((resolve) => {
      const handler = (err: grpc.ServiceError | null, response: unknown) => {
        const durationMs = Date.now() - start;
        if (err) {
          resolve({
            ok: false,
            errorCode: grpc.status[err.code ?? grpc.status.UNKNOWN] ?? 'UNKNOWN',
            errorMessage: err.details || err.message,
            durationMs,
          });
        } else {
          resolve({ ok: true, response, durationMs });
        }
      };
      // Dynamic method dispatch — the generated client has a method matching
      // the service's method name (camelCase by default, but we set keepCase
      // so it matches the .proto exactly).
      const methodFn = (client as unknown as Record<string, unknown>)[input.method];
      if (typeof methodFn !== 'function') {
        resolve(failure('METHOD_NOT_FOUND', `Client has no method "${input.method}".`, start));
        return;
      }
      (methodFn as (
        req: unknown,
        meta: grpc.Metadata,
        opts: grpc.CallOptions,
        cb: (err: grpc.ServiceError | null, resp: unknown) => void,
      ) => void).call(client, requestObj, metadata, callOptions, handler);
    });
  } catch (e) {
    return failure('CLIENT_ERROR', (e as Error).message, start);
  }
}

function failure(errorCode: string, errorMessage: string, start: number): InvokeUnaryResult {
  return { ok: false, errorCode, errorMessage, durationMs: Date.now() - start };
}

// Walks dotted package path: "helloworld.Greeter" → grpcObj.helloworld.Greeter.
function resolveServiceConstructor(
  grpcObj: grpc.GrpcObject,
  fullName: string,
): (new (
  address: string,
  creds: grpc.ChannelCredentials,
  options?: object,
) => grpc.Client) | null {
  const parts = fullName.split('.');
  let cur: unknown = grpcObj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== 'function') return null;
  return cur as new (
    address: string,
    creds: grpc.ChannelCredentials,
    options?: object,
  ) => grpc.Client;
}

// ─────────────────────────────────────────────────────────
// Streaming RPCs (server / client / bidi)
//
// Lifecycle mirrors WebSocket:
//   openStream    → main creates a Client, dispatches the streaming method,
//                   stores the call by id, wires up event listeners that
//                   push messages back to the renderer.
//   streamSend    → for client/bidi, writes one JSON message into the call.
//   streamClose   → cancels the call (or half-closes if it's client-streaming
//                   and the caller wants the server to finish responding).
//
// Renderer-side: GrpcRequestEditor opens the stream when the user clicks
// "Connect", appends every incoming/outgoing message to a log, and gates
// the Send box on the stream being in the 'open' state.
// ─────────────────────────────────────────────────────────

// Minimal shape of the grpc-js call objects we care about. The library
// returns a Readable/Writable/Duplex depending on the method shape; we
// only ever touch the union of useful methods/events.
interface GrpcCall {
  on(event: 'data', cb: (msg: unknown) => void): GrpcCall;
  on(event: 'error', cb: (err: Error) => void): GrpcCall;
  on(event: 'end', cb: () => void): GrpcCall;
  on(event: 'status', cb: (status: { code: number; details?: string }) => void): GrpcCall;
  write?(message: unknown): boolean;
  end?(): void;
  cancel?(): void;
  destroy?(err?: Error): void;
}

interface OpenStreamRecord {
  call: GrpcCall;
  client: grpc.Client;
  /** 'server' = server-stream, 'client' = client-stream, 'bidi' = both. */
  mode: 'server' | 'client' | 'bidi';
  state: 'open' | 'closed' | 'error';
}

const streams = new Map<string, OpenStreamRecord>();

export interface OpenStreamInput {
  address: string;
  protoPath: string;
  service: string;
  method: string;
  /** Initial request payload. Required for server-streaming, ignored for
   *  client-streaming, optional for bidi (sends a first frame if provided). */
  message?: string;
  metadata?: Record<string, string>;
}

export type OpenStreamResult =
  | { ok: true; connectionId: string; mode: 'server' | 'client' | 'bidi' }
  | { ok: false; errorCode: string; errorMessage: string };

export async function openStream(input: OpenStreamInput): Promise<OpenStreamResult> {
  try {
    const pkgDef = await protoLoader.load(input.protoPath, PROTO_LOADER_OPTIONS);
    const serviceDef = pkgDef[input.service];
    if (!serviceDef || !isServiceDefinition(serviceDef)) {
      return { ok: false, errorCode: 'SERVICE_NOT_FOUND', errorMessage: `Service "${input.service}" not found.` };
    }
    const methodDef = (serviceDef as Record<string, protoLoader.MethodDefinition<unknown, unknown>>)[
      input.method
    ];
    if (!methodDef) {
      return {
        ok: false,
        errorCode: 'METHOD_NOT_FOUND',
        errorMessage: `Method "${input.method}" not found in "${input.service}".`,
      };
    }
    const reqStream = !!methodDef.requestStream;
    const resStream = !!methodDef.responseStream;
    if (!reqStream && !resStream) {
      return {
        ok: false,
        errorCode: 'NOT_STREAMING',
        errorMessage: 'This is a unary method — call grpc:invoke instead.',
      };
    }
    const mode: 'server' | 'client' | 'bidi' =
      reqStream && resStream ? 'bidi' : reqStream ? 'client' : 'server';

    const grpcObj = grpc.loadPackageDefinition(pkgDef);
    const SvcCtor = resolveServiceConstructor(grpcObj, input.service);
    if (!SvcCtor) {
      return {
        ok: false,
        errorCode: 'SERVICE_NOT_FOUND',
        errorMessage: `Could not resolve service constructor for "${input.service}".`,
      };
    }
    const client = new SvcCtor(input.address, grpc.credentials.createInsecure());
    const methodFn = (client as unknown as Record<string, unknown>)[input.method];
    if (typeof methodFn !== 'function') {
      return {
        ok: false,
        errorCode: 'METHOD_NOT_FOUND',
        errorMessage: `Client has no method "${input.method}".`,
      };
    }

    const metadata = new grpc.Metadata();
    for (const [k, v] of Object.entries(input.metadata ?? {})) metadata.add(k, v);

    // For server-streaming the first request is provided up front; bidi
    // accepts an optional first frame; client-streaming sends nothing here.
    let initialMessage: unknown;
    if (mode === 'server' || (mode === 'bidi' && input.message?.trim())) {
      try {
        initialMessage = JSON.parse(input.message?.trim() || '{}');
      } catch (e) {
        return {
          ok: false,
          errorCode: 'INVALID_JSON',
          errorMessage: `Initial message is not valid JSON: ${(e as Error).message}`,
        };
      }
    }

    const connectionId = `grpc_${Math.random().toString(36).slice(2, 12)}`;

    let call: GrpcCall;
    if (mode === 'server') {
      // (req, metadata, options) → ClientReadableStream
      call = (methodFn as (req: unknown, meta: grpc.Metadata) => GrpcCall).call(
        client,
        initialMessage,
        metadata,
      );
    } else if (mode === 'client') {
      // (metadata, options, callback) → ClientWritableStream
      // The callback fires once after stream.end() with the final response.
      call = (methodFn as (
        meta: grpc.Metadata,
        opts: grpc.CallOptions,
        cb: (err: grpc.ServiceError | null, resp: unknown) => void,
      ) => GrpcCall).call(client, metadata, {}, (err, resp) => {
        if (err) {
          handleStreamError(connectionId, err);
        } else {
          emitStreamMessage(connectionId, 'in', resp);
        }
      });
    } else {
      // bidi: (metadata, options) → ClientDuplexStream
      call = (methodFn as (meta: grpc.Metadata) => GrpcCall).call(client, metadata);
      // If the user supplied an initial frame for a bidi call, write it now.
      if (initialMessage !== undefined && call.write) {
        call.write(initialMessage);
        emitStreamMessage(connectionId, 'out', initialMessage);
      }
    }

    streams.set(connectionId, { call, client, mode, state: 'open' });
    emitStreamState(connectionId, 'open');

    call.on('data', (msg: unknown) => {
      emitStreamMessage(connectionId, 'in', msg);
    });
    call.on('error', (err: Error) => {
      handleStreamError(connectionId, err);
    });
    call.on('end', () => {
      const rec = streams.get(connectionId);
      if (!rec || rec.state === 'error') return;
      rec.state = 'closed';
      emitStreamState(connectionId, 'closed');
      streams.delete(connectionId);
      try {
        rec.client.close();
      } catch {
        /* ignore */
      }
    });
    call.on('status', (status) => {
      // Pass status codes through so the UI can show e.g. "UNAVAILABLE".
      const code = grpc.status[status.code] ?? String(status.code);
      if (status.code !== grpc.status.OK) {
        emitStreamState(connectionId, 'status', { code, details: status.details ?? null });
      }
    });

    return { ok: true, connectionId, mode };
  } catch (e) {
    return { ok: false, errorCode: 'CLIENT_ERROR', errorMessage: (e as Error).message };
  }
}

export function streamSend(
  connectionId: string,
  message: string,
): { ok: boolean; error?: string } {
  const rec = streams.get(connectionId);
  if (!rec) return { ok: false, error: 'Stream not found' };
  if (rec.state !== 'open') return { ok: false, error: `Stream is ${rec.state}` };
  if (rec.mode === 'server') {
    return { ok: false, error: 'Server-streaming RPCs only accept the initial request.' };
  }
  if (!rec.call.write) return { ok: false, error: 'This stream is not writable.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(message || '{}');
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  try {
    rec.call.write(parsed);
    emitStreamMessage(connectionId, 'out', parsed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Half-close (client-streaming / bidi) — signals end-of-stream to the
 *  server so it can produce its response, but leaves the read side open. */
export function streamHalfClose(connectionId: string): { ok: boolean; error?: string } {
  const rec = streams.get(connectionId);
  if (!rec) return { ok: false, error: 'Stream not found' };
  if (rec.mode === 'server') {
    return { ok: false, error: 'Server-streaming RPCs are already half-closed by design.' };
  }
  try {
    rec.call.end?.();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function streamClose(connectionId: string): { ok: boolean } {
  const rec = streams.get(connectionId);
  if (!rec) return { ok: true };
  try {
    rec.call.cancel?.();
  } catch {
    /* ignore */
  }
  try {
    rec.client.close();
  } catch {
    /* ignore */
  }
  rec.state = 'closed';
  streams.delete(connectionId);
  emitStreamState(connectionId, 'closed');
  return { ok: true };
}

function handleStreamError(connectionId: string, err: Error) {
  const rec = streams.get(connectionId);
  if (rec) {
    rec.state = 'error';
    try {
      rec.client.close();
    } catch {
      /* ignore */
    }
    streams.delete(connectionId);
  }
  const code = (err as grpc.ServiceError).code;
  emitStreamState(connectionId, 'error', {
    code: code != null ? grpc.status[code] ?? String(code) : 'ERROR',
    details: (err as grpc.ServiceError).details ?? err.message,
  });
}

function emit(payload: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('volt:event', payload);
  }
}

function emitStreamMessage(connectionId: string, direction: 'in' | 'out', payload: unknown) {
  emit({
    kind: 'grpc:stream:message',
    connectionId,
    direction,
    timestamp: Date.now(),
    // Serialize for transport — proto-loader returns plain JS objects.
    text: safeStringify(payload),
  });
}

function emitStreamState(
  connectionId: string,
  state: 'open' | 'closed' | 'error' | 'status',
  details?: { code?: string; details?: string | null },
) {
  emit({
    kind: 'grpc:stream:state',
    connectionId,
    state,
    code: details?.code,
    details: details?.details ?? null,
    timestamp: Date.now(),
  });
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
