import { z } from 'zod';
export declare const HeaderRow: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    id: string;
    key: string;
    enabled: boolean;
    description?: string | undefined;
}, {
    value: string;
    id: string;
    key: string;
    enabled?: boolean | undefined;
    description?: string | undefined;
}>;
export type HeaderRow = z.infer<typeof HeaderRow>;
export declare const QueryParam: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    id: string;
    key: string;
    enabled: boolean;
    description?: string | undefined;
}, {
    value: string;
    id: string;
    key: string;
    enabled?: boolean | undefined;
    description?: string | undefined;
}>;
export type QueryParam = z.infer<typeof QueryParam>;
export declare const PathVariable: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    id: string;
    key: string;
    enabled: boolean;
    description?: string | undefined;
}, {
    value: string;
    id: string;
    key: string;
    enabled?: boolean | undefined;
    description?: string | undefined;
}>;
export type PathVariable = z.infer<typeof PathVariable>;
export declare const RawBody: z.ZodObject<{
    type: z.ZodLiteral<"raw">;
    language: z.ZodEnum<["json", "xml", "html", "text", "javascript"]>;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "raw";
    language: "json" | "xml" | "html" | "text" | "javascript";
    content: string;
}, {
    type: "raw";
    language: "json" | "xml" | "html" | "text" | "javascript";
    content: string;
}>;
export declare const FormBody: z.ZodObject<{
    type: z.ZodLiteral<"form">;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        kind: z.ZodEnum<["text", "file"]>;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        kind: "text" | "file";
    }, {
        value: string;
        id: string;
        key: string;
        kind: "text" | "file";
        enabled?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "form";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        kind: "text" | "file";
    }[];
}, {
    type: "form";
    fields: {
        value: string;
        id: string;
        key: string;
        kind: "text" | "file";
        enabled?: boolean | undefined;
    }[];
}>;
export declare const UrlEncodedBody: z.ZodObject<{
    type: z.ZodLiteral<"urlencoded">;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "urlencoded";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }[];
}, {
    type: "urlencoded";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }[];
}>;
export declare const BinaryBody: z.ZodObject<{
    type: z.ZodLiteral<"binary">;
    filePath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "binary";
    filePath: string;
}, {
    type: "binary";
    filePath: string;
}>;
export declare const GraphQLBody: z.ZodObject<{
    type: z.ZodLiteral<"graphql">;
    query: z.ZodDefault<z.ZodString>;
    variables: z.ZodDefault<z.ZodString>;
    operationName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    type: "graphql";
    variables: string;
    operationName?: string | undefined;
}, {
    type: "graphql";
    query?: string | undefined;
    variables?: string | undefined;
    operationName?: string | undefined;
}>;
export declare const GrpcBody: z.ZodObject<{
    type: z.ZodLiteral<"grpc">;
    address: z.ZodDefault<z.ZodString>;
    protoPath: z.ZodDefault<z.ZodString>;
    service: z.ZodDefault<z.ZodString>;
    method: z.ZodDefault<z.ZodString>;
    message: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "grpc";
    method: string;
    address: string;
    protoPath: string;
    service: string;
    metadata: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }[];
}, {
    type: "grpc";
    message?: string | undefined;
    method?: string | undefined;
    address?: string | undefined;
    protoPath?: string | undefined;
    service?: string | undefined;
    metadata?: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }[] | undefined;
}>;
export declare const NoBody: z.ZodObject<{
    type: z.ZodLiteral<"none">;
}, "strip", z.ZodTypeAny, {
    type: "none";
}, {
    type: "none";
}>;
export declare const RequestBody: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"none">;
}, "strip", z.ZodTypeAny, {
    type: "none";
}, {
    type: "none";
}>, z.ZodObject<{
    type: z.ZodLiteral<"raw">;
    language: z.ZodEnum<["json", "xml", "html", "text", "javascript"]>;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "raw";
    language: "json" | "xml" | "html" | "text" | "javascript";
    content: string;
}, {
    type: "raw";
    language: "json" | "xml" | "html" | "text" | "javascript";
    content: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"form">;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        kind: z.ZodEnum<["text", "file"]>;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        kind: "text" | "file";
    }, {
        value: string;
        id: string;
        key: string;
        kind: "text" | "file";
        enabled?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "form";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        kind: "text" | "file";
    }[];
}, {
    type: "form";
    fields: {
        value: string;
        id: string;
        key: string;
        kind: "text" | "file";
        enabled?: boolean | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"urlencoded">;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "urlencoded";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }[];
}, {
    type: "urlencoded";
    fields: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"binary">;
    filePath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "binary";
    filePath: string;
}, {
    type: "binary";
    filePath: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"graphql">;
    query: z.ZodDefault<z.ZodString>;
    variables: z.ZodDefault<z.ZodString>;
    operationName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    type: "graphql";
    variables: string;
    operationName?: string | undefined;
}, {
    type: "graphql";
    query?: string | undefined;
    variables?: string | undefined;
    operationName?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"grpc">;
    address: z.ZodDefault<z.ZodString>;
    protoPath: z.ZodDefault<z.ZodString>;
    service: z.ZodDefault<z.ZodString>;
    method: z.ZodDefault<z.ZodString>;
    message: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "grpc";
    method: string;
    address: string;
    protoPath: string;
    service: string;
    metadata: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
    }[];
}, {
    type: "grpc";
    message?: string | undefined;
    method?: string | undefined;
    address?: string | undefined;
    protoPath?: string | undefined;
    service?: string | undefined;
    metadata?: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
    }[] | undefined;
}>]>;
export type RequestBody = z.infer<typeof RequestBody>;
export declare const NoAuth: z.ZodObject<{
    type: z.ZodLiteral<"none">;
}, "strip", z.ZodTypeAny, {
    type: "none";
}, {
    type: "none";
}>;
export declare const BearerAuth: z.ZodObject<{
    type: z.ZodLiteral<"bearer">;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bearer";
    token: string;
}, {
    type: "bearer";
    token: string;
}>;
export declare const BasicAuth: z.ZodObject<{
    type: z.ZodLiteral<"basic">;
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    type: "basic";
    username: string;
}, {
    password: string;
    type: "basic";
    username: string;
}>;
export declare const ApiKeyAuth: z.ZodObject<{
    type: z.ZodLiteral<"apiKey">;
    key: z.ZodString;
    value: z.ZodString;
    placement: z.ZodEnum<["header", "query"]>;
}, "strip", z.ZodTypeAny, {
    value: string;
    type: "apiKey";
    key: string;
    placement: "header" | "query";
}, {
    value: string;
    type: "apiKey";
    key: string;
    placement: "header" | "query";
}>;
export declare const OAuth2Auth: z.ZodObject<{
    type: z.ZodLiteral<"oauth2">;
    grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
    tokenUrl: z.ZodDefault<z.ZodString>;
    authUrl: z.ZodOptional<z.ZodString>;
    redirectUri: z.ZodOptional<z.ZodString>;
    clientId: z.ZodDefault<z.ZodString>;
    clientSecret: z.ZodDefault<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    headerPrefix: z.ZodDefault<z.ZodString>;
    tokenCacheKey: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "oauth2";
    grant: "password" | "client_credentials" | "authorization_code";
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    headerPrefix: string;
    tokenCacheKey: string;
    password?: string | undefined;
    username?: string | undefined;
    authUrl?: string | undefined;
    redirectUri?: string | undefined;
    scope?: string | undefined;
}, {
    type: "oauth2";
    grant: "password" | "client_credentials" | "authorization_code";
    password?: string | undefined;
    username?: string | undefined;
    tokenUrl?: string | undefined;
    authUrl?: string | undefined;
    redirectUri?: string | undefined;
    clientId?: string | undefined;
    clientSecret?: string | undefined;
    scope?: string | undefined;
    headerPrefix?: string | undefined;
    tokenCacheKey?: string | undefined;
}>;
export declare const RequestAuth: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"none">;
}, "strip", z.ZodTypeAny, {
    type: "none";
}, {
    type: "none";
}>, z.ZodObject<{
    type: z.ZodLiteral<"bearer">;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bearer";
    token: string;
}, {
    type: "bearer";
    token: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"basic">;
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    type: "basic";
    username: string;
}, {
    password: string;
    type: "basic";
    username: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"apiKey">;
    key: z.ZodString;
    value: z.ZodString;
    placement: z.ZodEnum<["header", "query"]>;
}, "strip", z.ZodTypeAny, {
    value: string;
    type: "apiKey";
    key: string;
    placement: "header" | "query";
}, {
    value: string;
    type: "apiKey";
    key: string;
    placement: "header" | "query";
}>, z.ZodObject<{
    type: z.ZodLiteral<"oauth2">;
    grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
    tokenUrl: z.ZodDefault<z.ZodString>;
    authUrl: z.ZodOptional<z.ZodString>;
    redirectUri: z.ZodOptional<z.ZodString>;
    clientId: z.ZodDefault<z.ZodString>;
    clientSecret: z.ZodDefault<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    headerPrefix: z.ZodDefault<z.ZodString>;
    tokenCacheKey: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "oauth2";
    grant: "password" | "client_credentials" | "authorization_code";
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    headerPrefix: string;
    tokenCacheKey: string;
    password?: string | undefined;
    username?: string | undefined;
    authUrl?: string | undefined;
    redirectUri?: string | undefined;
    scope?: string | undefined;
}, {
    type: "oauth2";
    grant: "password" | "client_credentials" | "authorization_code";
    password?: string | undefined;
    username?: string | undefined;
    tokenUrl?: string | undefined;
    authUrl?: string | undefined;
    redirectUri?: string | undefined;
    clientId?: string | undefined;
    clientSecret?: string | undefined;
    scope?: string | undefined;
    headerPrefix?: string | undefined;
    tokenCacheKey?: string | undefined;
}>]>;
export type RequestAuth = z.infer<typeof RequestAuth>;
export declare const RequestExample: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    request: z.ZodOptional<z.ZodUnknown>;
    response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    request: z.ZodOptional<z.ZodUnknown>;
    response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    request: z.ZodOptional<z.ZodUnknown>;
    response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">>;
export type RequestExample = z.infer<typeof RequestExample>;
export declare const ApiRequest: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    collectionId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
    url: z.ZodString;
    headers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }>, "many">>;
    queryParams: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }>, "many">>;
    pathVariables: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }, {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }>, "many">>;
    body: z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type: "none";
    }, {
        type: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"raw">;
        language: z.ZodEnum<["json", "xml", "html", "text", "javascript"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "raw";
        language: "json" | "xml" | "html" | "text" | "javascript";
        content: string;
    }, {
        type: "raw";
        language: "json" | "xml" | "html" | "text" | "javascript";
        content: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"form">;
        fields: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            key: z.ZodString;
            kind: z.ZodEnum<["text", "file"]>;
            value: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
            kind: "text" | "file";
        }, {
            value: string;
            id: string;
            key: string;
            kind: "text" | "file";
            enabled?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "form";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
            kind: "text" | "file";
        }[];
    }, {
        type: "form";
        fields: {
            value: string;
            id: string;
            key: string;
            kind: "text" | "file";
            enabled?: boolean | undefined;
        }[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"urlencoded">;
        fields: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }, {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "urlencoded";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }[];
    }, {
        type: "urlencoded";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"binary">;
        filePath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "binary";
        filePath: string;
    }, {
        type: "binary";
        filePath: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"graphql">;
        query: z.ZodDefault<z.ZodString>;
        variables: z.ZodDefault<z.ZodString>;
        operationName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        type: "graphql";
        variables: string;
        operationName?: string | undefined;
    }, {
        type: "graphql";
        query?: string | undefined;
        variables?: string | undefined;
        operationName?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"grpc">;
        address: z.ZodDefault<z.ZodString>;
        protoPath: z.ZodDefault<z.ZodString>;
        service: z.ZodDefault<z.ZodString>;
        method: z.ZodDefault<z.ZodString>;
        message: z.ZodDefault<z.ZodString>;
        metadata: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }, {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "grpc";
        method: string;
        address: string;
        protoPath: string;
        service: string;
        metadata: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }[];
    }, {
        type: "grpc";
        message?: string | undefined;
        method?: string | undefined;
        address?: string | undefined;
        protoPath?: string | undefined;
        service?: string | undefined;
        metadata?: {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }[] | undefined;
    }>]>>;
    auth: z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type: "none";
    }, {
        type: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"bearer">;
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "bearer";
        token: string;
    }, {
        type: "bearer";
        token: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"basic">;
        username: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        type: "basic";
        username: string;
    }, {
        password: string;
        type: "basic";
        username: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"apiKey">;
        key: z.ZodString;
        value: z.ZodString;
        placement: z.ZodEnum<["header", "query"]>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        type: "apiKey";
        key: string;
        placement: "header" | "query";
    }, {
        value: string;
        type: "apiKey";
        key: string;
        placement: "header" | "query";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"oauth2">;
        grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
        tokenUrl: z.ZodDefault<z.ZodString>;
        authUrl: z.ZodOptional<z.ZodString>;
        redirectUri: z.ZodOptional<z.ZodString>;
        clientId: z.ZodDefault<z.ZodString>;
        clientSecret: z.ZodDefault<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        headerPrefix: z.ZodDefault<z.ZodString>;
        tokenCacheKey: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "oauth2";
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        clientSecret: string;
        headerPrefix: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        scope?: string | undefined;
    }, {
        type: "oauth2";
        grant: "password" | "client_credentials" | "authorization_code";
        password?: string | undefined;
        username?: string | undefined;
        tokenUrl?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientId?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
        headerPrefix?: string | undefined;
        tokenCacheKey?: string | undefined;
    }>]>>;
    preRequestScript: z.ZodDefault<z.ZodString>;
    postResponseScript: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    examples: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        request: z.ZodOptional<z.ZodUnknown>;
        response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        request: z.ZodOptional<z.ZodUnknown>;
        response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        request: z.ZodOptional<z.ZodUnknown>;
        response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    revision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    headers: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }[];
    body: {
        type: "raw";
        language: "json" | "xml" | "html" | "text" | "javascript";
        content: string;
    } | {
        type: "form";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
            kind: "text" | "file";
        }[];
    } | {
        type: "urlencoded";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }[];
    } | {
        type: "binary";
        filePath: string;
    } | {
        query: string;
        type: "graphql";
        variables: string;
        operationName?: string | undefined;
    } | {
        message: string;
        type: "grpc";
        method: string;
        address: string;
        protoPath: string;
        service: string;
        metadata: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
        }[];
    } | {
        type: "none";
    };
    workspaceId: string;
    description: string;
    sortOrder: number;
    collectionId: string | null;
    url: string;
    queryParams: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }[];
    pathVariables: {
        value: string;
        id: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
    }[];
    auth: {
        type: "none";
    } | {
        type: "bearer";
        token: string;
    } | {
        password: string;
        type: "basic";
        username: string;
    } | {
        value: string;
        type: "apiKey";
        key: string;
        placement: "header" | "query";
    } | {
        type: "oauth2";
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        clientSecret: string;
        headerPrefix: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        scope?: string | undefined;
    };
    preRequestScript: string;
    postResponseScript: string;
    examples: z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        request: z.ZodOptional<z.ZodUnknown>;
        response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, z.ZodTypeAny, "passthrough">[];
    revision?: string | undefined;
}, {
    name: string;
    id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    workspaceId: string;
    collectionId: string | null;
    url: string;
    headers?: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }[] | undefined;
    body?: {
        type: "raw";
        language: "json" | "xml" | "html" | "text" | "javascript";
        content: string;
    } | {
        type: "form";
        fields: {
            value: string;
            id: string;
            key: string;
            kind: "text" | "file";
            enabled?: boolean | undefined;
        }[];
    } | {
        type: "urlencoded";
        fields: {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }[];
    } | {
        type: "binary";
        filePath: string;
    } | {
        type: "graphql";
        query?: string | undefined;
        variables?: string | undefined;
        operationName?: string | undefined;
    } | {
        type: "grpc";
        message?: string | undefined;
        method?: string | undefined;
        address?: string | undefined;
        protoPath?: string | undefined;
        service?: string | undefined;
        metadata?: {
            value: string;
            id: string;
            key: string;
            enabled?: boolean | undefined;
        }[] | undefined;
    } | {
        type: "none";
    } | undefined;
    description?: string | undefined;
    sortOrder?: number | undefined;
    revision?: string | undefined;
    queryParams?: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }[] | undefined;
    pathVariables?: {
        value: string;
        id: string;
        key: string;
        enabled?: boolean | undefined;
        description?: string | undefined;
    }[] | undefined;
    auth?: {
        type: "none";
    } | {
        type: "bearer";
        token: string;
    } | {
        password: string;
        type: "basic";
        username: string;
    } | {
        value: string;
        type: "apiKey";
        key: string;
        placement: "header" | "query";
    } | {
        type: "oauth2";
        grant: "password" | "client_credentials" | "authorization_code";
        password?: string | undefined;
        username?: string | undefined;
        tokenUrl?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientId?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
        headerPrefix?: string | undefined;
        tokenCacheKey?: string | undefined;
    } | undefined;
    preRequestScript?: string | undefined;
    postResponseScript?: string | undefined;
    examples?: z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        request: z.ZodOptional<z.ZodUnknown>;
        response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, z.ZodTypeAny, "passthrough">[] | undefined;
}>;
export type ApiRequest = z.infer<typeof ApiRequest>;
export declare const ResolvedRequest: z.ZodObject<{
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
    url: z.ZodString;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    body: z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, "strip", z.ZodTypeAny, {
        type: "none";
    }, {
        type: "none";
    }>, z.ZodObject<{
        type: z.ZodLiteral<"raw">;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "raw";
        content: string;
    }, {
        type: "raw";
        content: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"form">;
        fields: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            kind: z.ZodEnum<["text", "file"]>;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            key: string;
            kind: "text" | "file";
        }, {
            value: string;
            key: string;
            kind: "text" | "file";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "form";
        fields: {
            value: string;
            key: string;
            kind: "text" | "file";
        }[];
    }, {
        type: "form";
        fields: {
            value: string;
            key: string;
            kind: "text" | "file";
        }[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"urlencoded">;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "urlencoded";
        content: string;
    }, {
        type: "urlencoded";
        content: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"binary">;
        filePath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "binary";
        filePath: string;
    }, {
        type: "binary";
        filePath: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"graphql">;
        query: z.ZodDefault<z.ZodString>;
        variables: z.ZodDefault<z.ZodString>;
        operationName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        type: "graphql";
        variables: string;
        operationName?: string | undefined;
    }, {
        type: "graphql";
        query?: string | undefined;
        variables?: string | undefined;
        operationName?: string | undefined;
    }>]>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    followRedirects: z.ZodDefault<z.ZodBoolean>;
    ignoreTlsErrors: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    headers: Record<string, string>;
    body: {
        type: "none";
    } | {
        type: "raw";
        content: string;
    } | {
        type: "form";
        fields: {
            value: string;
            key: string;
            kind: "text" | "file";
        }[];
    } | {
        type: "urlencoded";
        content: string;
    } | {
        type: "binary";
        filePath: string;
    } | {
        query: string;
        type: "graphql";
        variables: string;
        operationName?: string | undefined;
    };
    url: string;
    timeoutMs: number;
    followRedirects: boolean;
    ignoreTlsErrors: boolean;
}, {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    headers: Record<string, string>;
    body: {
        type: "none";
    } | {
        type: "raw";
        content: string;
    } | {
        type: "form";
        fields: {
            value: string;
            key: string;
            kind: "text" | "file";
        }[];
    } | {
        type: "urlencoded";
        content: string;
    } | {
        type: "binary";
        filePath: string;
    } | {
        type: "graphql";
        query?: string | undefined;
        variables?: string | undefined;
        operationName?: string | undefined;
    };
    url: string;
    timeoutMs?: number | undefined;
    followRedirects?: boolean | undefined;
    ignoreTlsErrors?: boolean | undefined;
}>;
export type ResolvedRequest = z.infer<typeof ResolvedRequest>;
export declare const SendRequestInput: z.ZodObject<{
    inFlightId: z.ZodString;
    requestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requestName: z.ZodOptional<z.ZodString>;
    request: z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
        url: z.ZodString;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"none">;
        }, "strip", z.ZodTypeAny, {
            type: "none";
        }, {
            type: "none";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"raw">;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "raw";
            content: string;
        }, {
            type: "raw";
            content: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"form">;
            fields: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                kind: z.ZodEnum<["text", "file"]>;
                value: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                value: string;
                key: string;
                kind: "text" | "file";
            }, {
                value: string;
                key: string;
                kind: "text" | "file";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        }, {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        }>, z.ZodObject<{
            type: z.ZodLiteral<"urlencoded">;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "urlencoded";
            content: string;
        }, {
            type: "urlencoded";
            content: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"binary">;
            filePath: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "binary";
            filePath: string;
        }, {
            type: "binary";
            filePath: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"graphql">;
            query: z.ZodDefault<z.ZodString>;
            variables: z.ZodDefault<z.ZodString>;
            operationName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            query: string;
            type: "graphql";
            variables: string;
            operationName?: string | undefined;
        }, {
            type: "graphql";
            query?: string | undefined;
            variables?: string | undefined;
            operationName?: string | undefined;
        }>]>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        followRedirects: z.ZodDefault<z.ZodBoolean>;
        ignoreTlsErrors: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        headers: Record<string, string>;
        body: {
            type: "none";
        } | {
            type: "raw";
            content: string;
        } | {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        } | {
            type: "urlencoded";
            content: string;
        } | {
            type: "binary";
            filePath: string;
        } | {
            query: string;
            type: "graphql";
            variables: string;
            operationName?: string | undefined;
        };
        url: string;
        timeoutMs: number;
        followRedirects: boolean;
        ignoreTlsErrors: boolean;
    }, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        headers: Record<string, string>;
        body: {
            type: "none";
        } | {
            type: "raw";
            content: string;
        } | {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        } | {
            type: "urlencoded";
            content: string;
        } | {
            type: "binary";
            filePath: string;
        } | {
            type: "graphql";
            query?: string | undefined;
            variables?: string | undefined;
            operationName?: string | undefined;
        };
        url: string;
        timeoutMs?: number | undefined;
        followRedirects?: boolean | undefined;
        ignoreTlsErrors?: boolean | undefined;
    }>;
    preRequestScript: z.ZodOptional<z.ZodString>;
    postResponseScript: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    workspaceId: z.ZodOptional<z.ZodString>;
    environmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    request: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        headers: Record<string, string>;
        body: {
            type: "none";
        } | {
            type: "raw";
            content: string;
        } | {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        } | {
            type: "urlencoded";
            content: string;
        } | {
            type: "binary";
            filePath: string;
        } | {
            query: string;
            type: "graphql";
            variables: string;
            operationName?: string | undefined;
        };
        url: string;
        timeoutMs: number;
        followRedirects: boolean;
        ignoreTlsErrors: boolean;
    };
    inFlightId: string;
    workspaceId?: string | undefined;
    variables?: Record<string, string> | undefined;
    preRequestScript?: string | undefined;
    postResponseScript?: string | undefined;
    requestId?: string | null | undefined;
    requestName?: string | undefined;
    environmentId?: string | null | undefined;
}, {
    request: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        headers: Record<string, string>;
        body: {
            type: "none";
        } | {
            type: "raw";
            content: string;
        } | {
            type: "form";
            fields: {
                value: string;
                key: string;
                kind: "text" | "file";
            }[];
        } | {
            type: "urlencoded";
            content: string;
        } | {
            type: "binary";
            filePath: string;
        } | {
            type: "graphql";
            query?: string | undefined;
            variables?: string | undefined;
            operationName?: string | undefined;
        };
        url: string;
        timeoutMs?: number | undefined;
        followRedirects?: boolean | undefined;
        ignoreTlsErrors?: boolean | undefined;
    };
    inFlightId: string;
    workspaceId?: string | undefined;
    variables?: Record<string, string> | undefined;
    preRequestScript?: string | undefined;
    postResponseScript?: string | undefined;
    requestId?: string | null | undefined;
    requestName?: string | undefined;
    environmentId?: string | null | undefined;
}>;
export type SendRequestInput = z.infer<typeof SendRequestInput>;
export declare const ResponseTiming: z.ZodObject<{
    dnsMs: z.ZodNullable<z.ZodNumber>;
    tcpMs: z.ZodNullable<z.ZodNumber>;
    tlsMs: z.ZodNullable<z.ZodNumber>;
    ttfbMs: z.ZodNullable<z.ZodNumber>;
    downloadMs: z.ZodNullable<z.ZodNumber>;
    totalMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    dnsMs: number | null;
    tcpMs: number | null;
    tlsMs: number | null;
    ttfbMs: number | null;
    downloadMs: number | null;
    totalMs: number;
}, {
    dnsMs: number | null;
    tcpMs: number | null;
    tlsMs: number | null;
    ttfbMs: number | null;
    downloadMs: number | null;
    totalMs: number;
}>;
export type ResponseTiming = z.infer<typeof ResponseTiming>;
export declare const ScriptTestResult: z.ZodObject<{
    name: z.ZodString;
    passed: z.ZodBoolean;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    skipped: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    passed: boolean;
    error?: string | null | undefined;
    skipped?: boolean | undefined;
}, {
    name: string;
    passed: boolean;
    error?: string | null | undefined;
    skipped?: boolean | undefined;
}>;
export type ScriptTestResult = z.infer<typeof ScriptTestResult>;
export declare const ScriptOutput: z.ZodObject<{
    logs: z.ZodArray<z.ZodString, "many">;
    error: z.ZodNullable<z.ZodString>;
    tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        passed: z.ZodBoolean;
        error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        skipped: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        passed: boolean;
        error?: string | null | undefined;
        skipped?: boolean | undefined;
    }, {
        name: string;
        passed: boolean;
        error?: string | null | undefined;
        skipped?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    error: string | null;
    logs: string[];
    tests?: {
        name: string;
        passed: boolean;
        error?: string | null | undefined;
        skipped?: boolean | undefined;
    }[] | undefined;
}, {
    error: string | null;
    logs: string[];
    tests?: {
        name: string;
        passed: boolean;
        error?: string | null | undefined;
        skipped?: boolean | undefined;
    }[] | undefined;
}>;
export declare const SuccessResponse: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    statusCode: z.ZodNumber;
    statusText: z.ZodString;
    headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">;
    bodyBase64: z.ZodNullable<z.ZodString>;
    bodyTempFile: z.ZodNullable<z.ZodString>;
    bodyContentType: z.ZodNullable<z.ZodString>;
    bodySizeBytes: z.ZodNumber;
    timing: z.ZodObject<{
        dnsMs: z.ZodNullable<z.ZodNumber>;
        tcpMs: z.ZodNullable<z.ZodNumber>;
        tlsMs: z.ZodNullable<z.ZodNumber>;
        ttfbMs: z.ZodNullable<z.ZodNumber>;
        downloadMs: z.ZodNullable<z.ZodNumber>;
        totalMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }>;
    preScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
    postScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    headers: [string, string][];
    ok: true;
    statusCode: number;
    statusText: string;
    bodyBase64: string | null;
    bodyTempFile: string | null;
    bodyContentType: string | null;
    bodySizeBytes: number;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    };
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}, {
    headers: [string, string][];
    ok: true;
    statusCode: number;
    statusText: string;
    bodyBase64: string | null;
    bodyTempFile: string | null;
    bodyContentType: string | null;
    bodySizeBytes: number;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    };
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}>;
export declare const ErrorResponse: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    errorCode: z.ZodString;
    errorMessage: z.ZodString;
    timing: z.ZodNullable<z.ZodObject<{
        dnsMs: z.ZodNullable<z.ZodNumber>;
        tcpMs: z.ZodNullable<z.ZodNumber>;
        tlsMs: z.ZodNullable<z.ZodNumber>;
        ttfbMs: z.ZodNullable<z.ZodNumber>;
        downloadMs: z.ZodNullable<z.ZodNumber>;
        totalMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }>>;
    preScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
    postScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    ok: false;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    } | null;
    errorCode: string;
    errorMessage: string;
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}, {
    ok: false;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    } | null;
    errorCode: string;
    errorMessage: string;
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}>;
export declare const SendRequestOutput: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
    ok: z.ZodLiteral<true>;
    statusCode: z.ZodNumber;
    statusText: z.ZodString;
    headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">;
    bodyBase64: z.ZodNullable<z.ZodString>;
    bodyTempFile: z.ZodNullable<z.ZodString>;
    bodyContentType: z.ZodNullable<z.ZodString>;
    bodySizeBytes: z.ZodNumber;
    timing: z.ZodObject<{
        dnsMs: z.ZodNullable<z.ZodNumber>;
        tcpMs: z.ZodNullable<z.ZodNumber>;
        tlsMs: z.ZodNullable<z.ZodNumber>;
        ttfbMs: z.ZodNullable<z.ZodNumber>;
        downloadMs: z.ZodNullable<z.ZodNumber>;
        totalMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }>;
    preScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
    postScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    headers: [string, string][];
    ok: true;
    statusCode: number;
    statusText: string;
    bodyBase64: string | null;
    bodyTempFile: string | null;
    bodyContentType: string | null;
    bodySizeBytes: number;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    };
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}, {
    headers: [string, string][];
    ok: true;
    statusCode: number;
    statusText: string;
    bodyBase64: string | null;
    bodyTempFile: string | null;
    bodyContentType: string | null;
    bodySizeBytes: number;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    };
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    errorCode: z.ZodString;
    errorMessage: z.ZodString;
    timing: z.ZodNullable<z.ZodObject<{
        dnsMs: z.ZodNullable<z.ZodNumber>;
        tcpMs: z.ZodNullable<z.ZodNumber>;
        tlsMs: z.ZodNullable<z.ZodNumber>;
        ttfbMs: z.ZodNullable<z.ZodNumber>;
        downloadMs: z.ZodNullable<z.ZodNumber>;
        totalMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }, {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    }>>;
    preScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
    postScript: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodString, "many">;
        error: z.ZodNullable<z.ZodString>;
        tests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            passed: z.ZodBoolean;
            error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            skipped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }, {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }, {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    ok: false;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    } | null;
    errorCode: string;
    errorMessage: string;
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}, {
    ok: false;
    timing: {
        dnsMs: number | null;
        tcpMs: number | null;
        tlsMs: number | null;
        ttfbMs: number | null;
        downloadMs: number | null;
        totalMs: number;
    } | null;
    errorCode: string;
    errorMessage: string;
    preScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    postScript?: {
        error: string | null;
        logs: string[];
        tests?: {
            name: string;
            passed: boolean;
            error?: string | null | undefined;
            skipped?: boolean | undefined;
        }[] | undefined;
    } | undefined;
}>]>;
export type SendRequestOutput = z.infer<typeof SendRequestOutput>;
export declare const HistoryEntry: z.ZodObject<{
    id: z.ZodString;
    requestId: z.ZodNullable<z.ZodString>;
    workspaceId: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
    url: z.ZodString;
    requestSnapshot: z.ZodString;
    statusCode: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    startedAt: z.ZodString;
    errorCode: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    workspaceId: string;
    url: string;
    requestId: string | null;
    statusCode: number | null;
    errorCode: string | null;
    requestSnapshot: string;
    durationMs: number;
    startedAt: string;
}, {
    id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    workspaceId: string;
    url: string;
    requestId: string | null;
    statusCode: number | null;
    errorCode: string | null;
    requestSnapshot: string;
    durationMs: number;
    startedAt: string;
}>;
export type HistoryEntry = z.infer<typeof HistoryEntry>;
