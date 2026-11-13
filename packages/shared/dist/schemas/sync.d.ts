import { z } from 'zod';
export declare const SyncTable: z.ZodEnum<["collection", "request", "environment", "history"]>;
export type SyncTable = z.infer<typeof SyncTable>;
export declare const SyncChange: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
    op: z.ZodLiteral<"upsert">;
    table: z.ZodEnum<["collection", "request", "environment", "history"]>;
    rowId: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    op: "upsert";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    data: Record<string, unknown>;
}, {
    op: "upsert";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    data: Record<string, unknown>;
}>, z.ZodObject<{
    op: z.ZodLiteral<"delete">;
    table: z.ZodEnum<["collection", "request", "environment", "history"]>;
    rowId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    op: "delete";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
}, {
    op: "delete";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
}>]>;
export type SyncChange = z.infer<typeof SyncChange>;
export declare const SyncPushInput: z.ZodObject<{
    workspaceId: z.ZodString;
    baseRevision: z.ZodString;
    changes: z.ZodArray<z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
        op: z.ZodLiteral<"upsert">;
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    }, {
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"delete">;
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }, {
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    baseRevision: string;
    changes: ({
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    } | {
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    })[];
}, {
    workspaceId: string;
    baseRevision: string;
    changes: ({
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    } | {
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    })[];
}>;
export type SyncPushInput = z.infer<typeof SyncPushInput>;
export declare const SyncPushOutput: z.ZodObject<{
    newRevision: z.ZodString;
    applied: z.ZodArray<z.ZodObject<{
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
        revision: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        revision: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }, {
        revision: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    newRevision: string;
    applied: {
        revision: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }[];
}, {
    newRevision: string;
    applied: {
        revision: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }[];
}>;
export type SyncPushOutput = z.infer<typeof SyncPushOutput>;
export declare const SyncPushConflict: z.ZodObject<{
    error: z.ZodLiteral<"REVISION_CONFLICT">;
    workspaceId: z.ZodString;
    baseRevision: z.ZodString;
    currentRevision: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentRevision: string;
    workspaceId: string;
    error: "REVISION_CONFLICT";
    baseRevision: string;
}, {
    currentRevision: string;
    workspaceId: string;
    error: "REVISION_CONFLICT";
    baseRevision: string;
}>;
export type SyncPushConflict = z.infer<typeof SyncPushConflict>;
export declare const SyncPullInput: z.ZodObject<{
    workspaceId: z.ZodString;
    since: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    since: string;
}, {
    workspaceId: string;
    since: string;
}>;
export type SyncPullInput = z.infer<typeof SyncPullInput>;
export declare const FetchedChange: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
    op: z.ZodLiteral<"upsert">;
    table: z.ZodEnum<["collection", "request", "environment", "history"]>;
    rowId: z.ZodString;
    revision: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    revision: string;
    op: "upsert";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    data: Record<string, unknown>;
}, {
    revision: string;
    op: "upsert";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    data: Record<string, unknown>;
}>, z.ZodObject<{
    op: z.ZodLiteral<"delete">;
    table: z.ZodEnum<["collection", "request", "environment", "history"]>;
    rowId: z.ZodString;
    revision: z.ZodString;
}, "strip", z.ZodTypeAny, {
    revision: string;
    op: "delete";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
}, {
    revision: string;
    op: "delete";
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
}>]>;
export type FetchedChange = z.infer<typeof FetchedChange>;
export declare const SyncPullOutput: z.ZodObject<{
    currentRevision: z.ZodString;
    changes: z.ZodArray<z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
        op: z.ZodLiteral<"upsert">;
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
        revision: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        revision: string;
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    }, {
        revision: string;
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"delete">;
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
        revision: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        revision: string;
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }, {
        revision: string;
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    currentRevision: string;
    changes: ({
        revision: string;
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    } | {
        revision: string;
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    })[];
}, {
    currentRevision: string;
    changes: ({
        revision: string;
        op: "upsert";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        data: Record<string, unknown>;
    } | {
        revision: string;
        op: "delete";
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
    })[];
}>;
export type SyncPullOutput = z.infer<typeof SyncPullOutput>;
export declare const SseChangeEvent: z.ZodObject<{
    type: z.ZodLiteral<"change">;
    workspaceId: z.ZodString;
    newRevision: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "change";
    workspaceId: string;
    newRevision: string;
}, {
    type: "change";
    workspaceId: string;
    newRevision: string;
}>;
export declare const SseHeartbeatEvent: z.ZodObject<{
    type: z.ZodLiteral<"heartbeat">;
    ts: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "heartbeat";
    ts: string;
}, {
    type: "heartbeat";
    ts: string;
}>;
export declare const SseEvent: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"change">;
    workspaceId: z.ZodString;
    newRevision: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "change";
    workspaceId: string;
    newRevision: string;
}, {
    type: "change";
    workspaceId: string;
    newRevision: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"heartbeat">;
    ts: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "heartbeat";
    ts: string;
}, {
    type: "heartbeat";
    ts: string;
}>]>;
export type SseEvent = z.infer<typeof SseEvent>;
export declare const ConflictLogEntry: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    table: z.ZodEnum<["collection", "request", "environment", "history"]>;
    rowId: z.ZodString;
    previousState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    overwrittenBy: z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string;
    }, {
        name: string;
        userId: string;
    }>;
    overwrittenAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    workspaceId: string;
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    previousState: Record<string, unknown>;
    overwrittenBy: {
        name: string;
        userId: string;
    };
    overwrittenAt: string;
}, {
    id: string;
    workspaceId: string;
    table: "request" | "collection" | "environment" | "history";
    rowId: string;
    previousState: Record<string, unknown>;
    overwrittenBy: {
        name: string;
        userId: string;
    };
    overwrittenAt: string;
}>;
export type ConflictLogEntry = z.infer<typeof ConflictLogEntry>;
export declare const ListConflictsInput: z.ZodObject<{
    workspaceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
}, {
    workspaceId: string;
}>;
export declare const ListConflictsOutput: z.ZodObject<{
    conflicts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        table: z.ZodEnum<["collection", "request", "environment", "history"]>;
        rowId: z.ZodString;
        previousState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        overwrittenBy: z.ZodObject<{
            userId: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            userId: string;
        }, {
            name: string;
            userId: string;
        }>;
        overwrittenAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        previousState: Record<string, unknown>;
        overwrittenBy: {
            name: string;
            userId: string;
        };
        overwrittenAt: string;
    }, {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        previousState: Record<string, unknown>;
        overwrittenBy: {
            name: string;
            userId: string;
        };
        overwrittenAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    conflicts: {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        previousState: Record<string, unknown>;
        overwrittenBy: {
            name: string;
            userId: string;
        };
        overwrittenAt: string;
    }[];
}, {
    conflicts: {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment" | "history";
        rowId: string;
        previousState: Record<string, unknown>;
        overwrittenBy: {
            name: string;
            userId: string;
        };
        overwrittenAt: string;
    }[];
}>;
export declare const RestoreConflictInput: z.ZodObject<{
    conflictId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    conflictId: string;
}, {
    conflictId: string;
}>;
