import { z } from 'zod';
export declare const Variable: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
    secretRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    secret: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    value: string;
    key: string;
    secretRef?: string | null | undefined;
    enabled?: boolean | undefined;
    secret?: boolean | undefined;
}, {
    value: string;
    key: string;
    secretRef?: string | null | undefined;
    enabled?: boolean | undefined;
    secret?: boolean | undefined;
}>;
export type Variable = z.infer<typeof Variable>;
export declare const CreateTeamInput: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const InviteTeamMemberInput: z.ZodObject<{
    teamId: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    teamId: string;
}, {
    email: string;
    teamId: string;
}>;
export declare const AcceptInviteInput: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const UpdateMemberRoleInput: z.ZodObject<{
    teamId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodEnum<["OWNER", "EDITOR", "VIEWER"]>;
}, "strip", z.ZodTypeAny, {
    role: "OWNER" | "EDITOR" | "VIEWER";
    teamId: string;
    userId: string;
}, {
    role: "OWNER" | "EDITOR" | "VIEWER";
    teamId: string;
    userId: string;
}>;
export declare const CreateWorkspaceInput: z.ZodObject<{
    name: z.ZodString;
    teamId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id?: string | undefined;
    teamId?: string | undefined;
}, {
    name: string;
    id?: string | undefined;
    teamId?: string | undefined;
}>;
export declare const RenameWorkspaceInput: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
}, {
    name: string;
    id: string;
}>;
export declare const Workspace: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    ownerUserId: z.ZodNullable<z.ZodString>;
    ownerTeamId: z.ZodNullable<z.ZodString>;
    currentRevision: z.ZodEffects<z.ZodUnion<[z.ZodBigInt, z.ZodNumber, z.ZodString]>, string, string | number | bigint>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    ownerUserId: string | null;
    ownerTeamId: string | null;
    currentRevision: string;
    createdAt: string;
}, {
    name: string;
    id: string;
    ownerUserId: string | null;
    ownerTeamId: string | null;
    currentRevision: string | number | bigint;
    createdAt: string;
}>;
export declare const MockDefinition: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodDefault<z.ZodString>;
    /** HTTP method to match. Use '*' to match any method. */
    method: z.ZodDefault<z.ZodString>;
    /** Path pattern. `:name` segments match a single non-slash segment;
     *  `*` matches the rest of the path. Anchored to the start of the URL.
     *  Example: `/users/:id` matches `/users/123` but not `/users/123/posts`. */
    pathPattern: z.ZodDefault<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodNumber>;
    headers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
    }, {
        value: string;
        key: string;
    }>, "many">>;
    contentType: z.ZodDefault<z.ZodString>;
    body: z.ZodDefault<z.ZodString>;
    /** Artificial latency before sending the response. */
    delayMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: number;
    id: string;
    enabled: boolean;
    method: string;
    pathPattern: string;
    headers: {
        value: string;
        key: string;
    }[];
    contentType: string;
    body: string;
    delayMs: number;
}, {
    id: string;
    name?: string | undefined;
    status?: number | undefined;
    enabled?: boolean | undefined;
    method?: string | undefined;
    pathPattern?: string | undefined;
    headers?: {
        value: string;
        key: string;
    }[] | undefined;
    contentType?: string | undefined;
    body?: string | undefined;
    delayMs?: number | undefined;
}>;
export type MockDefinition = z.infer<typeof MockDefinition>;
export declare const Collection: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    parentId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    variables: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        secretRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        secret: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }, {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }>, "many">>;
    mocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodDefault<z.ZodString>;
        /** HTTP method to match. Use '*' to match any method. */
        method: z.ZodDefault<z.ZodString>;
        /** Path pattern. `:name` segments match a single non-slash segment;
         *  `*` matches the rest of the path. Anchored to the start of the URL.
         *  Example: `/users/:id` matches `/users/123` but not `/users/123/posts`. */
        pathPattern: z.ZodDefault<z.ZodString>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        status: z.ZodDefault<z.ZodNumber>;
        headers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            key: string;
        }, {
            value: string;
            key: string;
        }>, "many">>;
        contentType: z.ZodDefault<z.ZodString>;
        body: z.ZodDefault<z.ZodString>;
        /** Artificial latency before sending the response. */
        delayMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        status: number;
        id: string;
        enabled: boolean;
        method: string;
        pathPattern: string;
        headers: {
            value: string;
            key: string;
        }[];
        contentType: string;
        body: string;
        delayMs: number;
    }, {
        id: string;
        name?: string | undefined;
        status?: number | undefined;
        enabled?: boolean | undefined;
        method?: string | undefined;
        pathPattern?: string | undefined;
        headers?: {
            value: string;
            key: string;
        }[] | undefined;
        contentType?: string | undefined;
        body?: string | undefined;
        delayMs?: number | undefined;
    }>, "many">>;
    revision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    workspaceId: string;
    parentId: string | null;
    description: string;
    sortOrder: number;
    variables: {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }[];
    mocks: {
        name: string;
        status: number;
        id: string;
        enabled: boolean;
        method: string;
        pathPattern: string;
        headers: {
            value: string;
            key: string;
        }[];
        contentType: string;
        body: string;
        delayMs: number;
    }[];
    revision?: string | undefined;
}, {
    name: string;
    id: string;
    workspaceId: string;
    parentId: string | null;
    description?: string | undefined;
    sortOrder?: number | undefined;
    variables?: {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }[] | undefined;
    mocks?: {
        id: string;
        name?: string | undefined;
        status?: number | undefined;
        enabled?: boolean | undefined;
        method?: string | undefined;
        pathPattern?: string | undefined;
        headers?: {
            value: string;
            key: string;
        }[] | undefined;
        contentType?: string | undefined;
        body?: string | undefined;
        delayMs?: number | undefined;
    }[] | undefined;
    revision?: string | undefined;
}>;
export type Collection = z.infer<typeof Collection>;
export declare const Environment: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    variables: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        secretRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        secret: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }, {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }>, "many">>;
    revision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    workspaceId: string;
    sortOrder: number;
    variables: {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }[];
    revision?: string | undefined;
}, {
    name: string;
    id: string;
    workspaceId: string;
    sortOrder?: number | undefined;
    variables?: {
        value: string;
        key: string;
        secretRef?: string | null | undefined;
        enabled?: boolean | undefined;
        secret?: boolean | undefined;
    }[] | undefined;
    revision?: string | undefined;
}>;
export type Environment = z.infer<typeof Environment>;
