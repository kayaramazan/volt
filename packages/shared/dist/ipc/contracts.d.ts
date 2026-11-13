import { z } from 'zod';
export declare const RequestSendContract: {
    readonly input: z.ZodObject<{
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
    readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
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
};
export declare const RequestCancelContract: {
    readonly input: z.ZodObject<{
        inFlightId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        inFlightId: string;
    }, {
        inFlightId: string;
    }>;
    readonly output: z.ZodObject<{
        cancelled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        cancelled: boolean;
    }, {
        cancelled: boolean;
    }>;
};
export declare const ResponseSaveBodyContract: {
    readonly input: z.ZodEffects<z.ZodObject<{
        defaultName: z.ZodString;
        contentBase64: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tempPath: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        defaultName: string;
        contentBase64?: string | null | undefined;
        tempPath?: string | null | undefined;
    }, {
        defaultName: string;
        contentBase64?: string | null | undefined;
        tempPath?: string | null | undefined;
    }>, {
        defaultName: string;
        contentBase64?: string | null | undefined;
        tempPath?: string | null | undefined;
    }, {
        defaultName: string;
        contentBase64?: string | null | undefined;
        tempPath?: string | null | undefined;
    }>;
    readonly output: z.ZodObject<{
        success: z.ZodBoolean;
        cancelled: z.ZodOptional<z.ZodBoolean>;
        path: z.ZodOptional<z.ZodString>;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        path?: string | undefined;
        errorMessage?: string | undefined;
        cancelled?: boolean | undefined;
    }, {
        success: boolean;
        path?: string | undefined;
        errorMessage?: string | undefined;
        cancelled?: boolean | undefined;
    }>;
};
export declare const GrpcLoadProtoContract: {
    readonly input: z.ZodObject<{
        protoPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        protoPath: string;
    }, {
        protoPath: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        services: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            methods: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                requestStream: z.ZodBoolean;
                responseStream: z.ZodBoolean;
                requestType: z.ZodString;
                responseType: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }, {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            methods: {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }[];
        }, {
            name: string;
            methods: {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }[];
        }>, "many">>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        services: {
            name: string;
            methods: {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }[];
        }[];
        error?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
        services?: {
            name: string;
            methods: {
                name: string;
                requestStream: boolean;
                responseStream: boolean;
                requestType: string;
                responseType: string;
            }[];
        }[] | undefined;
    }>;
};
export declare const GrpcInvokeContract: {
    readonly input: z.ZodObject<{
        address: z.ZodString;
        protoPath: z.ZodString;
        service: z.ZodString;
        method: z.ZodString;
        message: z.ZodDefault<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        method: string;
        address: string;
        protoPath: string;
        service: string;
        metadata?: Record<string, string> | undefined;
        timeoutMs?: number | undefined;
    }, {
        method: string;
        address: string;
        protoPath: string;
        service: string;
        message?: string | undefined;
        metadata?: Record<string, string> | undefined;
        timeoutMs?: number | undefined;
    }>;
    readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
        ok: z.ZodLiteral<true>;
        response: z.ZodUnknown;
        durationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ok: true;
        durationMs: number;
        response?: unknown;
    }, {
        ok: true;
        durationMs: number;
        response?: unknown;
    }>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        errorCode: z.ZodString;
        errorMessage: z.ZodString;
        durationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ok: false;
        errorCode: string;
        errorMessage: string;
        durationMs: number;
    }, {
        ok: false;
        errorCode: string;
        errorMessage: string;
        durationMs: number;
    }>]>;
};
export declare const GrpcOpenStreamContract: {
    readonly input: z.ZodObject<{
        address: z.ZodString;
        protoPath: z.ZodString;
        service: z.ZodString;
        method: z.ZodString;
        message: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        method: string;
        address: string;
        protoPath: string;
        service: string;
        message?: string | undefined;
        metadata?: Record<string, string> | undefined;
    }, {
        method: string;
        address: string;
        protoPath: string;
        service: string;
        message?: string | undefined;
        metadata?: Record<string, string> | undefined;
    }>;
    readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
        ok: z.ZodLiteral<true>;
        connectionId: z.ZodString;
        mode: z.ZodEnum<["server", "client", "bidi"]>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
        connectionId: string;
        mode: "server" | "client" | "bidi";
    }, {
        ok: true;
        connectionId: string;
        mode: "server" | "client" | "bidi";
    }>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        errorCode: z.ZodString;
        errorMessage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ok: false;
        errorCode: string;
        errorMessage: string;
    }, {
        ok: false;
        errorCode: string;
        errorMessage: string;
    }>]>;
};
export declare const GrpcStreamSendContract: {
    readonly input: z.ZodObject<{
        connectionId: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        connectionId: string;
    }, {
        message: string;
        connectionId: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
    }>;
};
export declare const GrpcStreamHalfCloseContract: {
    readonly input: z.ZodObject<{
        connectionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        connectionId: string;
    }, {
        connectionId: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
    }>;
};
export declare const GrpcStreamCloseContract: {
    readonly input: z.ZodObject<{
        connectionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        connectionId: string;
    }, {
        connectionId: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
    }, {
        ok: boolean;
    }>;
};
export declare const PluginsListContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        plugins: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
            filePath: z.ZodString;
            error: z.ZodNullable<z.ZodString>;
            transformers: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                pluginId: z.ZodString;
                localId: z.ZodString;
                name: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                matchContentType: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }, {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }, {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }>, "many">;
        dir: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        plugins: {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }[];
        dir: string;
    }, {
        plugins: {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }[];
        dir: string;
    }>;
};
export declare const PluginsReloadContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        loaded: z.ZodNumber;
        errored: z.ZodNumber;
        dir: z.ZodString;
        plugins: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
            filePath: z.ZodString;
            error: z.ZodNullable<z.ZodString>;
            transformers: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                pluginId: z.ZodString;
                localId: z.ZodString;
                name: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                matchContentType: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }, {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }, {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        plugins: {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }[];
        dir: string;
        loaded: number;
        errored: number;
    }, {
        plugins: {
            name: string;
            id: string;
            filePath: string;
            error: string | null;
            transformers: {
                name: string;
                id: string;
                pluginId: string;
                localId: string;
                description?: string | undefined;
                matchContentType?: string | undefined;
            }[];
            version?: string | undefined;
        }[];
        dir: string;
        loaded: number;
        errored: number;
    }>;
};
export declare const PluginsOpenFolderContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        dir: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        dir: string;
    }, {
        ok: boolean;
        dir: string;
    }>;
};
export declare const PluginsApplyTransformerContract: {
    readonly input: z.ZodObject<{
        transformerId: z.ZodString;
        body: z.ZodString;
        contentType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        body: string;
        transformerId: string;
        headers?: Record<string, string> | undefined;
        contentType?: string | null | undefined;
    }, {
        body: string;
        transformerId: string;
        headers?: Record<string, string> | undefined;
        contentType?: string | null | undefined;
    }>;
    readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
        ok: z.ZodLiteral<true>;
        body: z.ZodString;
        contentType: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        contentType: string | null;
        body: string;
        ok: true;
    }, {
        contentType: string | null;
        body: string;
        ok: true;
    }>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        error: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        error: string;
        ok: false;
    }, {
        error: string;
        ok: false;
    }>]>;
};
export declare const MockStatusContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        running: z.ZodBoolean;
        port: z.ZodNumber;
        activeMockCount: z.ZodNumber;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        running: boolean;
        port: number;
        activeMockCount: number;
        error?: string | undefined;
    }, {
        running: boolean;
        port: number;
        activeMockCount: number;
        error?: string | undefined;
    }>;
};
export declare const MockStartContract: {
    readonly input: z.ZodObject<{
        port: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        port?: number | undefined;
    }, {
        port?: number | undefined;
    }>;
    readonly output: z.ZodObject<{
        running: z.ZodBoolean;
        port: z.ZodNumber;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        running: boolean;
        port: number;
        error?: string | undefined;
    }, {
        running: boolean;
        port: number;
        error?: string | undefined;
    }>;
};
export declare const MockStopContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        running: z.ZodLiteral<false>;
    }, "strip", z.ZodTypeAny, {
        running: false;
    }, {
        running: false;
    }>;
};
export declare const WsOpenContract: {
    readonly input: z.ZodObject<{
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        protocols: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        headers?: Record<string, string> | undefined;
        protocols?: string[] | undefined;
    }, {
        url: string;
        headers?: Record<string, string> | undefined;
        protocols?: string[] | undefined;
    }>;
    readonly output: z.ZodObject<{
        connectionId: z.ZodString;
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        connectionId: string;
        error?: string | undefined;
    }, {
        ok: boolean;
        connectionId: string;
        error?: string | undefined;
    }>;
};
export declare const WsSendContract: {
    readonly input: z.ZodObject<{
        connectionId: z.ZodString;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
        connectionId: string;
    }, {
        text: string;
        connectionId: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
    }>;
};
export declare const WsCloseContract: {
    readonly input: z.ZodObject<{
        connectionId: z.ZodString;
        code: z.ZodOptional<z.ZodNumber>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        connectionId: string;
        code?: number | undefined;
        reason?: string | undefined;
    }, {
        connectionId: string;
        code?: number | undefined;
        reason?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
    }, {
        ok: boolean;
    }>;
};
export declare const WorkspaceListContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        personal: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        team: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        personal: {
            name: string;
            id: string;
            ownerUserId: string | null;
            ownerTeamId: string | null;
            currentRevision: string;
            createdAt: string;
        }[];
        team: {
            name: string;
            id: string;
            ownerUserId: string | null;
            ownerTeamId: string | null;
            currentRevision: string;
            createdAt: string;
        }[];
    }, {
        personal: {
            name: string;
            id: string;
            ownerUserId: string | null;
            ownerTeamId: string | null;
            currentRevision: string | number | bigint;
            createdAt: string;
        }[];
        team: {
            name: string;
            id: string;
            ownerUserId: string | null;
            ownerTeamId: string | null;
            currentRevision: string | number | bigint;
            createdAt: string;
        }[];
    }>;
};
export declare const WorkspaceCreateContract: {
    readonly input: z.ZodObject<{
        name: z.ZodString;
        teamId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        teamId?: string | undefined;
    }, {
        name: string;
        teamId?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
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
};
export declare const WidgetFavoritesContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        requestIds: z.ZodArray<z.ZodString, "many">;
        supported: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        requestIds: string[];
        supported: boolean;
    }, {
        requestIds: string[];
        supported: boolean;
    }>;
};
export declare const WidgetSetFavoriteContract: {
    readonly input: z.ZodObject<{
        requestId: z.ZodString;
        favorite: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        favorite: boolean;
    }, {
        requestId: string;
        favorite: boolean;
    }>;
    readonly output: z.ZodObject<{
        requestIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        requestIds: string[];
    }, {
        requestIds: string[];
    }>;
};
export declare const WidgetReadyContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
    }, {
        ok: boolean;
    }>;
};
export declare const WidgetRunResultContract: {
    readonly input: z.ZodObject<{
        runId: z.ZodString;
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        runId: string;
        error?: string | undefined;
    }, {
        ok: boolean;
        runId: string;
        error?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
    }, {
        ok: boolean;
    }>;
};
export declare const WorkspaceRenameContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>;
    readonly output: z.ZodObject<{
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
};
export declare const WorkspaceDeleteContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        deleted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        deleted: boolean;
    }, {
        deleted: boolean;
    }>;
};
export declare const CollectionListContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
    }, {
        workspaceId: string;
    }>;
    readonly output: z.ZodArray<z.ZodObject<{
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
            method: z.ZodDefault<z.ZodString>;
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
    }>, "many">;
};
export declare const CollectionCreateContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        parentId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        workspaceId: string;
        parentId: string | null;
    }, {
        name: string;
        workspaceId: string;
        parentId: string | null;
    }>;
    readonly output: z.ZodObject<{
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
            method: z.ZodDefault<z.ZodString>;
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
};
export declare const CollectionUpdateContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        mocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodDefault<z.ZodString>;
            method: z.ZodDefault<z.ZodString>;
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
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        parentId?: string | null | undefined;
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
        }[] | undefined;
    }, {
        id: string;
        name?: string | undefined;
        parentId?: string | null | undefined;
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
    }>;
    readonly output: z.ZodObject<{
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
            method: z.ZodDefault<z.ZodString>;
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
};
export declare const CollectionDeleteContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        deleted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        deleted: boolean;
    }, {
        deleted: boolean;
    }>;
};
/** Deep-copy a collection (sub-folders + requests) next to the original. */
export declare const CollectionDuplicateContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodNullable<z.ZodObject<{
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
            method: z.ZodDefault<z.ZodString>;
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
    }>>;
};
export declare const CollectionExportContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        collectionId: z.ZodOptional<z.ZodString>;
        format: z.ZodEnum<["postman", "insomnia", "openapi", "markdown"]>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        format: "postman" | "insomnia" | "openapi" | "markdown";
        collectionId?: string | undefined;
    }, {
        workspaceId: string;
        format: "postman" | "insomnia" | "openapi" | "markdown";
        collectionId?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        success: z.ZodBoolean;
        /** Absolute path of the written file on disk. */
        path: z.ZodOptional<z.ZodString>;
        /** "User cancelled" when the save dialog was dismissed. */
        cancelled: z.ZodOptional<z.ZodBoolean>;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        path?: string | undefined;
        errorMessage?: string | undefined;
        cancelled?: boolean | undefined;
    }, {
        success: boolean;
        path?: string | undefined;
        errorMessage?: string | undefined;
        cancelled?: boolean | undefined;
    }>;
};
export declare const RequestListContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        collectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        collectionId?: string | null | undefined;
    }, {
        workspaceId: string;
        collectionId?: string | null | undefined;
    }>;
    readonly output: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
};
export declare const RequestGetContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
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
};
export declare const RequestCreateContract: {
    readonly input: z.ZodObject<{
        name: z.ZodString;
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
        headers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
        body: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
        }>]>>>;
        workspaceId: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        collectionId: z.ZodNullable<z.ZodString>;
        url: z.ZodString;
        queryParams: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
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
        auth: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
        }>]>>>;
        preRequestScript: z.ZodDefault<z.ZodString>;
        postResponseScript: z.ZodDefault<z.ZodString>;
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
    }, "strip", z.ZodTypeAny, {
        name: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
        workspaceId: string;
        description: string;
        collectionId: string | null;
        url: string;
        pathVariables: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
        }[];
        preRequestScript: string;
        postResponseScript: string;
        examples: z.objectOutputType<{
            id: z.ZodString;
            name: z.ZodString;
            createdAt: z.ZodNumber;
            request: z.ZodOptional<z.ZodUnknown>;
            response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
        }, z.ZodTypeAny, "passthrough">[];
        headers?: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
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
        } | undefined;
        sortOrder?: number | undefined;
        queryParams?: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
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
        } | undefined;
    }, {
        name: string;
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
    readonly output: z.ZodObject<{
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
};
export declare const RequestUpdateContract: {
    readonly input: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        method: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>>;
        headers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
        body: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
        }>]>>>;
        workspaceId: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        revision: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        collectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        url: z.ZodOptional<z.ZodString>;
        queryParams: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
        pathVariables: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
        auth: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
        }>]>>>;
        preRequestScript: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        postResponseScript: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        examples: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }, z.ZodTypeAny, "passthrough">>, "many">>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | undefined;
        headers?: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
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
        } | undefined;
        workspaceId?: string | undefined;
        description?: string | undefined;
        sortOrder?: number | undefined;
        revision?: string | undefined;
        collectionId?: string | null | undefined;
        url?: string | undefined;
        queryParams?: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
        }[] | undefined;
        pathVariables?: {
            value: string;
            id: string;
            key: string;
            enabled: boolean;
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
        } | undefined;
        preRequestScript?: string | undefined;
        postResponseScript?: string | undefined;
        examples?: z.objectOutputType<{
            id: z.ZodString;
            name: z.ZodString;
            createdAt: z.ZodNumber;
            request: z.ZodOptional<z.ZodUnknown>;
            response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
        }, z.ZodTypeAny, "passthrough">[] | undefined;
    }, {
        id: string;
        name?: string | undefined;
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | undefined;
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
        workspaceId?: string | undefined;
        description?: string | undefined;
        sortOrder?: number | undefined;
        revision?: string | undefined;
        collectionId?: string | null | undefined;
        url?: string | undefined;
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
    readonly output: z.ZodObject<{
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
};
export declare const RequestDeleteContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        deleted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        deleted: boolean;
    }, {
        deleted: boolean;
    }>;
};
export declare const EnvListContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
    }, {
        workspaceId: string;
    }>;
    readonly output: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
};
export declare const EnvCreateContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        workspaceId: string;
    }, {
        name: string;
        workspaceId: string;
    }>;
    readonly output: z.ZodObject<{
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
};
export declare const EnvUpdateContract: {
    readonly input: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        workspaceId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        variables: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
        }>, "many">>>;
        revision: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        workspaceId?: string | undefined;
        sortOrder?: number | undefined;
        variables?: {
            value: string;
            key: string;
            secretRef?: string | null | undefined;
            enabled?: boolean | undefined;
            secret?: boolean | undefined;
        }[] | undefined;
        revision?: string | undefined;
    }, {
        id: string;
        name?: string | undefined;
        workspaceId?: string | undefined;
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
    readonly output: z.ZodObject<{
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
};
export declare const EnvDeleteContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        deleted: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        deleted: boolean;
    }, {
        deleted: boolean;
    }>;
};
export declare const EnvSetActiveContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        environmentId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        environmentId: string | null;
    }, {
        workspaceId: string;
        environmentId: string | null;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const EnvGetActiveContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
    }, {
        workspaceId: string;
    }>;
    readonly output: z.ZodObject<{
        environmentId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        environmentId: string | null;
    }, {
        environmentId: string | null;
    }>;
};
export declare const HistoryListContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        limit: z.ZodDefault<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        limit: number;
        cursor?: string | undefined;
        search?: string | undefined;
    }, {
        workspaceId: string;
        limit?: number | undefined;
        cursor?: string | undefined;
        search?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
        nextCursor: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        entries: {
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
        }[];
        nextCursor: string | null;
    }, {
        entries: {
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
        }[];
        nextCursor: string | null;
    }>;
};
export declare const HistoryGetContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
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
    } & {
        responseHeaders: z.ZodNullable<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">>;
        responseBodyBase64: z.ZodNullable<z.ZodString>;
        responseBodyTempFile: z.ZodNullable<z.ZodString>;
        responseContentType: z.ZodNullable<z.ZodString>;
        responseSizeBytes: z.ZodNullable<z.ZodNumber>;
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
        responseHeaders: [string, string][] | null;
        responseBodyBase64: string | null;
        responseBodyTempFile: string | null;
        responseContentType: string | null;
        responseSizeBytes: number | null;
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
        responseHeaders: [string, string][] | null;
        responseBodyBase64: string | null;
        responseBodyTempFile: string | null;
        responseContentType: string | null;
        responseSizeBytes: number | null;
    }>;
};
export declare const HistoryClearContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
    }, {
        workspaceId: string;
    }>;
    readonly output: z.ZodObject<{
        cleared: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        cleared: number;
    }, {
        cleared: number;
    }>;
};
export declare const AuthStatusContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        loggedIn: z.ZodBoolean;
        email: z.ZodNullable<z.ZodString>;
        name: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string | null;
        name: string | null;
        loggedIn: boolean;
    }, {
        email: string | null;
        name: string | null;
        loggedIn: boolean;
    }>;
};
export declare const AuthLoginContract: {
    readonly input: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
    }, {
        email: string;
        password: string;
    }>;
    readonly output: z.ZodObject<{
        success: z.ZodBoolean;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        errorMessage?: string | undefined;
    }, {
        success: boolean;
        errorMessage?: string | undefined;
    }>;
};
export declare const AuthRegisterContract: {
    readonly input: z.ZodObject<{
        email: z.ZodString;
        name: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        password: string;
    }, {
        email: string;
        name: string;
        password: string;
    }>;
    readonly output: z.ZodObject<{
        success: z.ZodBoolean;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        errorMessage?: string | undefined;
    }, {
        success: boolean;
        errorMessage?: string | undefined;
    }>;
};
export declare const AuthLogoutContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const SyncStatusContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        state: z.ZodEnum<["offline", "syncing", "synced", "conflict", "error"]>;
        lastSyncedAt: z.ZodNullable<z.ZodString>;
        pendingChanges: z.ZodNumber;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        state: "error" | "offline" | "syncing" | "synced" | "conflict";
        lastSyncedAt: string | null;
        pendingChanges: number;
        errorMessage?: string | undefined;
    }, {
        state: "error" | "offline" | "syncing" | "synced" | "conflict";
        lastSyncedAt: string | null;
        pendingChanges: number;
        errorMessage?: string | undefined;
    }>;
};
export declare const SyncForceContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        workspaceId?: string | undefined;
    }, {
        workspaceId?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        started: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        started: boolean;
    }, {
        started: boolean;
    }>;
};
export declare const ConflictListContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
    }, {
        workspaceId: string;
    }>;
    readonly output: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        table: z.ZodEnum<["collection", "request", "environment"]>;
        rowId: z.ZodString;
        previousState: z.ZodUnknown;
        overwrittenByName: z.ZodString;
        overwrittenByUserId: z.ZodString;
        overwrittenAt: z.ZodNumber;
        dismissedAt: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment";
        rowId: string;
        overwrittenAt: number;
        overwrittenByName: string;
        overwrittenByUserId: string;
        dismissedAt: number | null;
        previousState?: unknown;
    }, {
        id: string;
        workspaceId: string;
        table: "request" | "collection" | "environment";
        rowId: string;
        overwrittenAt: number;
        overwrittenByName: string;
        overwrittenByUserId: string;
        dismissedAt: number | null;
        previousState?: unknown;
    }>, "many">;
};
export declare const ConflictDismissContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const ConflictRestoreContract: {
    readonly input: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
    }>;
};
export declare const ImportSourceContract: {
    readonly input: z.ZodObject<{
        workspaceId: z.ZodString;
        source: z.ZodEnum<["postman", "insomnia", "openapi", "curl", "har"]>;
        filePath: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        source: "postman" | "insomnia" | "openapi" | "curl" | "har";
        content?: string | undefined;
        filePath?: string | undefined;
    }, {
        workspaceId: string;
        source: "postman" | "insomnia" | "openapi" | "curl" | "har";
        content?: string | undefined;
        filePath?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        success: z.ZodBoolean;
        collectionId: z.ZodOptional<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
        summary: z.ZodObject<{
            collections: z.ZodNumber;
            requests: z.ZodNumber;
            environments: z.ZodNumber;
            warnings: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            collections: number;
            requests: number;
            environments: number;
            warnings: string[];
        }, {
            collections: number;
            requests: number;
            environments: number;
            warnings: string[];
        }>;
        errorMessage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        summary: {
            collections: number;
            requests: number;
            environments: number;
            warnings: string[];
        };
        collectionId?: string | undefined;
        requestId?: string | undefined;
        errorMessage?: string | undefined;
    }, {
        success: boolean;
        summary: {
            collections: number;
            requests: number;
            environments: number;
            warnings: string[];
        };
        collectionId?: string | undefined;
        requestId?: string | undefined;
        errorMessage?: string | undefined;
    }>;
};
export declare const AppInfoContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodObject<{
        version: z.ZodString;
        platform: z.ZodEnum<["macos", "windows", "linux"]>;
        dbPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        platform: "macos" | "windows" | "linux";
        version: string;
        dbPath: string;
    }, {
        platform: "macos" | "windows" | "linux";
        version: string;
        dbPath: string;
    }>;
};
export declare const OpenExternalContract: {
    readonly input: z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const ShowFilePickerContract: {
    readonly input: z.ZodObject<{
        filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            extensions: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            extensions: string[];
        }, {
            name: string;
            extensions: string[];
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        filters?: {
            name: string;
            extensions: string[];
        }[] | undefined;
    }, {
        filters?: {
            name: string;
            extensions: string[];
        }[] | undefined;
    }>;
    readonly output: z.ZodObject<{
        cancelled: z.ZodBoolean;
        filePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cancelled: boolean;
        filePath?: string | undefined;
    }, {
        cancelled: boolean;
        filePath?: string | undefined;
    }>;
};
export declare const ReadFileTextContract: {
    readonly input: z.ZodObject<{
        filePath: z.ZodString;
        /** Read at most this many bytes (default 4 MiB). Used by import preview. */
        maxBytes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        filePath: string;
        maxBytes?: number | undefined;
    }, {
        filePath: string;
        maxBytes?: number | undefined;
    }>;
    readonly output: z.ZodObject<{
        content: z.ZodString;
        truncated: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        truncated: boolean;
        error?: string | undefined;
    }, {
        content: string;
        truncated: boolean;
        error?: string | undefined;
    }>;
};
export declare const TeamListContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodArray<z.ZodAny, "many">;
};
export declare const TeamCreateContract: {
    readonly input: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamInviteContract: {
    readonly input: z.ZodObject<{
        teamId: z.ZodString;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        teamId: string;
    }, {
        email: string;
        teamId: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamAcceptInviteContract: {
    readonly input: z.ZodObject<{
        code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
    }, {
        code: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamBillingContract: {
    readonly input: z.ZodObject<{
        teamId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        teamId: string;
    }, {
        teamId: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamBillingCheckoutContract: {
    readonly input: z.ZodObject<{
        teamId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        teamId: string;
    }, {
        teamId: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamBillingPortalContract: {
    readonly input: z.ZodObject<{
        teamId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        teamId: string;
    }, {
        teamId: string;
    }>;
    readonly output: z.ZodAny;
};
export declare const TeamAuditLogContract: {
    readonly input: z.ZodObject<{
        teamId: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        teamId: string;
        limit?: number | undefined;
    }, {
        teamId: string;
        limit?: number | undefined;
    }>;
    readonly output: z.ZodAny;
};
export declare const GlobalsListContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodRecord<z.ZodString, z.ZodUnknown>;
};
export declare const GlobalsSetContract: {
    readonly input: z.ZodObject<{
        key: z.ZodString;
        value: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        key: string;
        value?: unknown;
    }, {
        key: string;
        value?: unknown;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const GlobalsDeleteContract: {
    readonly input: z.ZodObject<{
        key: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
    }, {
        key: string;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const OAuthEnsureTokenContract: {
    readonly input: z.ZodObject<{
        grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
        tokenUrl: z.ZodString;
        authUrl: z.ZodOptional<z.ZodString>;
        redirectUri: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        clientSecret: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        tokenCacheKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }, {
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        accessToken: z.ZodOptional<z.ZodString>;
        tokenType: z.ZodOptional<z.ZodString>;
        expiresAt: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
        accessToken?: string | undefined;
        tokenType?: string | undefined;
        expiresAt?: number | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
        accessToken?: string | undefined;
        tokenType?: string | undefined;
        expiresAt?: number | undefined;
    }>;
};
export declare const OAuthGetAuthUrlContract: {
    readonly input: z.ZodObject<{
        grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
        tokenUrl: z.ZodString;
        authUrl: z.ZodOptional<z.ZodString>;
        redirectUri: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        clientSecret: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        tokenCacheKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }, {
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        url: z.ZodString;
        verifier: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        verifier: string;
    }, {
        url: string;
        verifier: string;
    }>;
};
export declare const OAuthExchangeCodeContract: {
    readonly input: z.ZodObject<{
        grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
        tokenUrl: z.ZodString;
        authUrl: z.ZodOptional<z.ZodString>;
        redirectUri: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        clientSecret: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        tokenCacheKey: z.ZodString;
    } & {
        code: z.ZodString;
        verifier: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        verifier: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }, {
        code: string;
        grant: "password" | "client_credentials" | "authorization_code";
        tokenUrl: string;
        clientId: string;
        tokenCacheKey: string;
        verifier: string;
        password?: string | undefined;
        username?: string | undefined;
        authUrl?: string | undefined;
        redirectUri?: string | undefined;
        clientSecret?: string | undefined;
        scope?: string | undefined;
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodBoolean;
        accessToken: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        error?: string | undefined;
        accessToken?: string | undefined;
    }, {
        ok: boolean;
        error?: string | undefined;
        accessToken?: string | undefined;
    }>;
};
export declare const AutoHeadersGetContract: {
    readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    readonly output: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        enabled: z.ZodBoolean;
        builtin: z.ZodOptional<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
        builtin?: boolean | undefined;
    }, {
        value: string;
        key: string;
        enabled: boolean;
        description?: string | undefined;
        builtin?: boolean | undefined;
    }>, "many">;
};
export declare const AutoHeadersSetContract: {
    readonly input: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodBoolean;
            builtin: z.ZodOptional<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }, {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        items: {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }[];
    }, {
        items: {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }[];
    }>;
    readonly output: z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        ok: true;
    }, {
        ok: true;
    }>;
};
export declare const IPC: {
    readonly 'request:send': {
        readonly input: z.ZodObject<{
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
        readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
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
    };
    readonly 'request:cancel': {
        readonly input: z.ZodObject<{
            inFlightId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            inFlightId: string;
        }, {
            inFlightId: string;
        }>;
        readonly output: z.ZodObject<{
            cancelled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            cancelled: boolean;
        }, {
            cancelled: boolean;
        }>;
    };
    readonly 'response:saveBody': {
        readonly input: z.ZodEffects<z.ZodObject<{
            defaultName: z.ZodString;
            contentBase64: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tempPath: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            defaultName: string;
            contentBase64?: string | null | undefined;
            tempPath?: string | null | undefined;
        }, {
            defaultName: string;
            contentBase64?: string | null | undefined;
            tempPath?: string | null | undefined;
        }>, {
            defaultName: string;
            contentBase64?: string | null | undefined;
            tempPath?: string | null | undefined;
        }, {
            defaultName: string;
            contentBase64?: string | null | undefined;
            tempPath?: string | null | undefined;
        }>;
        readonly output: z.ZodObject<{
            success: z.ZodBoolean;
            cancelled: z.ZodOptional<z.ZodBoolean>;
            path: z.ZodOptional<z.ZodString>;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
            path?: string | undefined;
            errorMessage?: string | undefined;
            cancelled?: boolean | undefined;
        }, {
            success: boolean;
            path?: string | undefined;
            errorMessage?: string | undefined;
            cancelled?: boolean | undefined;
        }>;
    };
    readonly 'ws:open': {
        readonly input: z.ZodObject<{
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            protocols: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            headers?: Record<string, string> | undefined;
            protocols?: string[] | undefined;
        }, {
            url: string;
            headers?: Record<string, string> | undefined;
            protocols?: string[] | undefined;
        }>;
        readonly output: z.ZodObject<{
            connectionId: z.ZodString;
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            connectionId: string;
            error?: string | undefined;
        }, {
            ok: boolean;
            connectionId: string;
            error?: string | undefined;
        }>;
    };
    readonly 'ws:send': {
        readonly input: z.ZodObject<{
            connectionId: z.ZodString;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            connectionId: string;
        }, {
            text: string;
            connectionId: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
        }>;
    };
    readonly 'ws:close': {
        readonly input: z.ZodObject<{
            connectionId: z.ZodString;
            code: z.ZodOptional<z.ZodNumber>;
            reason: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            connectionId: string;
            code?: number | undefined;
            reason?: string | undefined;
        }, {
            connectionId: string;
            code?: number | undefined;
            reason?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
        }, {
            ok: boolean;
        }>;
    };
    readonly 'grpc:loadProto': {
        readonly input: z.ZodObject<{
            protoPath: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            protoPath: string;
        }, {
            protoPath: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            services: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                methods: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    requestStream: z.ZodBoolean;
                    responseStream: z.ZodBoolean;
                    requestType: z.ZodString;
                    responseType: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }, {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                name: string;
                methods: {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }[];
            }, {
                name: string;
                methods: {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }[];
            }>, "many">>;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            services: {
                name: string;
                methods: {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }[];
            }[];
            error?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
            services?: {
                name: string;
                methods: {
                    name: string;
                    requestStream: boolean;
                    responseStream: boolean;
                    requestType: string;
                    responseType: string;
                }[];
            }[] | undefined;
        }>;
    };
    readonly 'grpc:invoke': {
        readonly input: z.ZodObject<{
            address: z.ZodString;
            protoPath: z.ZodString;
            service: z.ZodString;
            method: z.ZodString;
            message: z.ZodDefault<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            timeoutMs: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            method: string;
            address: string;
            protoPath: string;
            service: string;
            metadata?: Record<string, string> | undefined;
            timeoutMs?: number | undefined;
        }, {
            method: string;
            address: string;
            protoPath: string;
            service: string;
            message?: string | undefined;
            metadata?: Record<string, string> | undefined;
            timeoutMs?: number | undefined;
        }>;
        readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
            ok: z.ZodLiteral<true>;
            response: z.ZodUnknown;
            durationMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            ok: true;
            durationMs: number;
            response?: unknown;
        }, {
            ok: true;
            durationMs: number;
            response?: unknown;
        }>, z.ZodObject<{
            ok: z.ZodLiteral<false>;
            errorCode: z.ZodString;
            errorMessage: z.ZodString;
            durationMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            ok: false;
            errorCode: string;
            errorMessage: string;
            durationMs: number;
        }, {
            ok: false;
            errorCode: string;
            errorMessage: string;
            durationMs: number;
        }>]>;
    };
    readonly 'grpc:openStream': {
        readonly input: z.ZodObject<{
            address: z.ZodString;
            protoPath: z.ZodString;
            service: z.ZodString;
            method: z.ZodString;
            message: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            method: string;
            address: string;
            protoPath: string;
            service: string;
            message?: string | undefined;
            metadata?: Record<string, string> | undefined;
        }, {
            method: string;
            address: string;
            protoPath: string;
            service: string;
            message?: string | undefined;
            metadata?: Record<string, string> | undefined;
        }>;
        readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
            ok: z.ZodLiteral<true>;
            connectionId: z.ZodString;
            mode: z.ZodEnum<["server", "client", "bidi"]>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
            connectionId: string;
            mode: "server" | "client" | "bidi";
        }, {
            ok: true;
            connectionId: string;
            mode: "server" | "client" | "bidi";
        }>, z.ZodObject<{
            ok: z.ZodLiteral<false>;
            errorCode: z.ZodString;
            errorMessage: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ok: false;
            errorCode: string;
            errorMessage: string;
        }, {
            ok: false;
            errorCode: string;
            errorMessage: string;
        }>]>;
    };
    readonly 'grpc:streamSend': {
        readonly input: z.ZodObject<{
            connectionId: z.ZodString;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            connectionId: string;
        }, {
            message: string;
            connectionId: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
        }>;
    };
    readonly 'grpc:streamHalfClose': {
        readonly input: z.ZodObject<{
            connectionId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            connectionId: string;
        }, {
            connectionId: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
        }>;
    };
    readonly 'grpc:streamClose': {
        readonly input: z.ZodObject<{
            connectionId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            connectionId: string;
        }, {
            connectionId: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
        }, {
            ok: boolean;
        }>;
    };
    readonly 'mock:status': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            running: z.ZodBoolean;
            port: z.ZodNumber;
            activeMockCount: z.ZodNumber;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            running: boolean;
            port: number;
            activeMockCount: number;
            error?: string | undefined;
        }, {
            running: boolean;
            port: number;
            activeMockCount: number;
            error?: string | undefined;
        }>;
    };
    readonly 'mock:start': {
        readonly input: z.ZodObject<{
            port: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            port?: number | undefined;
        }, {
            port?: number | undefined;
        }>;
        readonly output: z.ZodObject<{
            running: z.ZodBoolean;
            port: z.ZodNumber;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            running: boolean;
            port: number;
            error?: string | undefined;
        }, {
            running: boolean;
            port: number;
            error?: string | undefined;
        }>;
    };
    readonly 'mock:stop': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            running: z.ZodLiteral<false>;
        }, "strip", z.ZodTypeAny, {
            running: false;
        }, {
            running: false;
        }>;
    };
    readonly 'plugins:list': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            plugins: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
                filePath: z.ZodString;
                error: z.ZodNullable<z.ZodString>;
                transformers: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    pluginId: z.ZodString;
                    localId: z.ZodString;
                    name: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                    matchContentType: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }, {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }, {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }>, "many">;
            dir: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            plugins: {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }[];
            dir: string;
        }, {
            plugins: {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }[];
            dir: string;
        }>;
    };
    readonly 'plugins:reload': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            loaded: z.ZodNumber;
            errored: z.ZodNumber;
            dir: z.ZodString;
            plugins: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
                filePath: z.ZodString;
                error: z.ZodNullable<z.ZodString>;
                transformers: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    pluginId: z.ZodString;
                    localId: z.ZodString;
                    name: z.ZodString;
                    description: z.ZodOptional<z.ZodString>;
                    matchContentType: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }, {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }, {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            plugins: {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }[];
            dir: string;
            loaded: number;
            errored: number;
        }, {
            plugins: {
                name: string;
                id: string;
                filePath: string;
                error: string | null;
                transformers: {
                    name: string;
                    id: string;
                    pluginId: string;
                    localId: string;
                    description?: string | undefined;
                    matchContentType?: string | undefined;
                }[];
                version?: string | undefined;
            }[];
            dir: string;
            loaded: number;
            errored: number;
        }>;
    };
    readonly 'plugins:openFolder': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            dir: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            dir: string;
        }, {
            ok: boolean;
            dir: string;
        }>;
    };
    readonly 'plugins:applyTransformer': {
        readonly input: z.ZodObject<{
            transformerId: z.ZodString;
            body: z.ZodString;
            contentType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            body: string;
            transformerId: string;
            headers?: Record<string, string> | undefined;
            contentType?: string | null | undefined;
        }, {
            body: string;
            transformerId: string;
            headers?: Record<string, string> | undefined;
            contentType?: string | null | undefined;
        }>;
        readonly output: z.ZodDiscriminatedUnion<"ok", [z.ZodObject<{
            ok: z.ZodLiteral<true>;
            body: z.ZodString;
            contentType: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            contentType: string | null;
            body: string;
            ok: true;
        }, {
            contentType: string | null;
            body: string;
            ok: true;
        }>, z.ZodObject<{
            ok: z.ZodLiteral<false>;
            error: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            error: string;
            ok: false;
        }, {
            error: string;
            ok: false;
        }>]>;
    };
    readonly 'workspace:list': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            personal: z.ZodArray<z.ZodObject<{
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
            }>, "many">;
            team: z.ZodArray<z.ZodObject<{
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
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            personal: {
                name: string;
                id: string;
                ownerUserId: string | null;
                ownerTeamId: string | null;
                currentRevision: string;
                createdAt: string;
            }[];
            team: {
                name: string;
                id: string;
                ownerUserId: string | null;
                ownerTeamId: string | null;
                currentRevision: string;
                createdAt: string;
            }[];
        }, {
            personal: {
                name: string;
                id: string;
                ownerUserId: string | null;
                ownerTeamId: string | null;
                currentRevision: string | number | bigint;
                createdAt: string;
            }[];
            team: {
                name: string;
                id: string;
                ownerUserId: string | null;
                ownerTeamId: string | null;
                currentRevision: string | number | bigint;
                createdAt: string;
            }[];
        }>;
    };
    readonly 'workspace:create': {
        readonly input: z.ZodObject<{
            name: z.ZodString;
            teamId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            teamId?: string | undefined;
        }, {
            name: string;
            teamId?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
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
    };
    readonly 'workspace:rename': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>;
        readonly output: z.ZodObject<{
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
    };
    readonly 'workspace:delete': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            deleted: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            deleted: boolean;
        }, {
            deleted: boolean;
        }>;
    };
    readonly 'collection:list': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
        }, {
            workspaceId: string;
        }>;
        readonly output: z.ZodArray<z.ZodObject<{
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
                method: z.ZodDefault<z.ZodString>;
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
        }>, "many">;
    };
    readonly 'collection:create': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            parentId: z.ZodNullable<z.ZodString>;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            workspaceId: string;
            parentId: string | null;
        }, {
            name: string;
            workspaceId: string;
            parentId: string | null;
        }>;
        readonly output: z.ZodObject<{
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
                method: z.ZodDefault<z.ZodString>;
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
    };
    readonly 'collection:update': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            description: z.ZodOptional<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodNumber>;
            variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
            mocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodDefault<z.ZodString>;
                method: z.ZodDefault<z.ZodString>;
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
        }, "strip", z.ZodTypeAny, {
            id: string;
            name?: string | undefined;
            parentId?: string | null | undefined;
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
            }[] | undefined;
        }, {
            id: string;
            name?: string | undefined;
            parentId?: string | null | undefined;
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
        }>;
        readonly output: z.ZodObject<{
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
                method: z.ZodDefault<z.ZodString>;
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
    };
    readonly 'collection:delete': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            deleted: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            deleted: boolean;
        }, {
            deleted: boolean;
        }>;
    };
    readonly 'collection:duplicate': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodNullable<z.ZodObject<{
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
                method: z.ZodDefault<z.ZodString>;
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
        }>>;
    };
    readonly 'collection:export': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            collectionId: z.ZodOptional<z.ZodString>;
            format: z.ZodEnum<["postman", "insomnia", "openapi", "markdown"]>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            format: "postman" | "insomnia" | "openapi" | "markdown";
            collectionId?: string | undefined;
        }, {
            workspaceId: string;
            format: "postman" | "insomnia" | "openapi" | "markdown";
            collectionId?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            success: z.ZodBoolean;
            /** Absolute path of the written file on disk. */
            path: z.ZodOptional<z.ZodString>;
            /** "User cancelled" when the save dialog was dismissed. */
            cancelled: z.ZodOptional<z.ZodBoolean>;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
            path?: string | undefined;
            errorMessage?: string | undefined;
            cancelled?: boolean | undefined;
        }, {
            success: boolean;
            path?: string | undefined;
            errorMessage?: string | undefined;
            cancelled?: boolean | undefined;
        }>;
    };
    readonly 'apiRequest:list': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            collectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            collectionId?: string | null | undefined;
        }, {
            workspaceId: string;
            collectionId?: string | null | undefined;
        }>;
        readonly output: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
    };
    readonly 'apiRequest:get': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
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
    };
    readonly 'apiRequest:create': {
        readonly input: z.ZodObject<{
            name: z.ZodString;
            method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>;
            headers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
            body: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
            }>]>>>;
            workspaceId: z.ZodString;
            description: z.ZodDefault<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            collectionId: z.ZodNullable<z.ZodString>;
            url: z.ZodString;
            queryParams: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
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
            auth: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
            }>]>>>;
            preRequestScript: z.ZodDefault<z.ZodString>;
            postResponseScript: z.ZodDefault<z.ZodString>;
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
        }, "strip", z.ZodTypeAny, {
            name: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
            workspaceId: string;
            description: string;
            collectionId: string | null;
            url: string;
            pathVariables: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
            }[];
            preRequestScript: string;
            postResponseScript: string;
            examples: z.objectOutputType<{
                id: z.ZodString;
                name: z.ZodString;
                createdAt: z.ZodNumber;
                request: z.ZodOptional<z.ZodUnknown>;
                response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
            }, z.ZodTypeAny, "passthrough">[];
            headers?: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
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
            } | undefined;
            sortOrder?: number | undefined;
            queryParams?: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
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
            } | undefined;
        }, {
            name: string;
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
        readonly output: z.ZodObject<{
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
    };
    readonly 'apiRequest:update': {
        readonly input: z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            id: z.ZodString;
            method: z.ZodOptional<z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]>>;
            headers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
            body: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
            }>]>>>;
            workspaceId: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            revision: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            collectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            url: z.ZodOptional<z.ZodString>;
            queryParams: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
            pathVariables: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
            auth: z.ZodOptional<z.ZodDefault<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
            }>]>>>;
            preRequestScript: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            postResponseScript: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            examples: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }, z.ZodTypeAny, "passthrough">>, "many">>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name?: string | undefined;
            method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | undefined;
            headers?: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
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
            } | undefined;
            workspaceId?: string | undefined;
            description?: string | undefined;
            sortOrder?: number | undefined;
            revision?: string | undefined;
            collectionId?: string | null | undefined;
            url?: string | undefined;
            queryParams?: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
            }[] | undefined;
            pathVariables?: {
                value: string;
                id: string;
                key: string;
                enabled: boolean;
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
            } | undefined;
            preRequestScript?: string | undefined;
            postResponseScript?: string | undefined;
            examples?: z.objectOutputType<{
                id: z.ZodString;
                name: z.ZodString;
                createdAt: z.ZodNumber;
                request: z.ZodOptional<z.ZodUnknown>;
                response: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
            }, z.ZodTypeAny, "passthrough">[] | undefined;
        }, {
            id: string;
            name?: string | undefined;
            method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | undefined;
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
            workspaceId?: string | undefined;
            description?: string | undefined;
            sortOrder?: number | undefined;
            revision?: string | undefined;
            collectionId?: string | null | undefined;
            url?: string | undefined;
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
        readonly output: z.ZodObject<{
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
    };
    readonly 'apiRequest:delete': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            deleted: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            deleted: boolean;
        }, {
            deleted: boolean;
        }>;
    };
    readonly 'env:list': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
        }, {
            workspaceId: string;
        }>;
        readonly output: z.ZodArray<z.ZodObject<{
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
        }>, "many">;
    };
    readonly 'env:create': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            workspaceId: string;
        }, {
            name: string;
            workspaceId: string;
        }>;
        readonly output: z.ZodObject<{
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
    };
    readonly 'env:update': {
        readonly input: z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            id: z.ZodString;
            workspaceId: z.ZodOptional<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            variables: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
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
            }>, "many">>>;
            revision: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name?: string | undefined;
            workspaceId?: string | undefined;
            sortOrder?: number | undefined;
            variables?: {
                value: string;
                key: string;
                secretRef?: string | null | undefined;
                enabled?: boolean | undefined;
                secret?: boolean | undefined;
            }[] | undefined;
            revision?: string | undefined;
        }, {
            id: string;
            name?: string | undefined;
            workspaceId?: string | undefined;
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
        readonly output: z.ZodObject<{
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
    };
    readonly 'env:delete': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            deleted: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            deleted: boolean;
        }, {
            deleted: boolean;
        }>;
    };
    readonly 'env:setActive': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            environmentId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            environmentId: string | null;
        }, {
            workspaceId: string;
            environmentId: string | null;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'env:getActive': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
        }, {
            workspaceId: string;
        }>;
        readonly output: z.ZodObject<{
            environmentId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            environmentId: string | null;
        }, {
            environmentId: string | null;
        }>;
    };
    readonly 'history:list': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            limit: z.ZodDefault<z.ZodNumber>;
            cursor: z.ZodOptional<z.ZodString>;
            search: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            limit: number;
            cursor?: string | undefined;
            search?: string | undefined;
        }, {
            workspaceId: string;
            limit?: number | undefined;
            cursor?: string | undefined;
            search?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            entries: z.ZodArray<z.ZodObject<{
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
            }>, "many">;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            entries: {
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
            }[];
            nextCursor: string | null;
        }, {
            entries: {
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
            }[];
            nextCursor: string | null;
        }>;
    };
    readonly 'history:get': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
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
        } & {
            responseHeaders: z.ZodNullable<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>, "many">>;
            responseBodyBase64: z.ZodNullable<z.ZodString>;
            responseBodyTempFile: z.ZodNullable<z.ZodString>;
            responseContentType: z.ZodNullable<z.ZodString>;
            responseSizeBytes: z.ZodNullable<z.ZodNumber>;
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
            responseHeaders: [string, string][] | null;
            responseBodyBase64: string | null;
            responseBodyTempFile: string | null;
            responseContentType: string | null;
            responseSizeBytes: number | null;
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
            responseHeaders: [string, string][] | null;
            responseBodyBase64: string | null;
            responseBodyTempFile: string | null;
            responseContentType: string | null;
            responseSizeBytes: number | null;
        }>;
    };
    readonly 'history:clear': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
        }, {
            workspaceId: string;
        }>;
        readonly output: z.ZodObject<{
            cleared: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            cleared: number;
        }, {
            cleared: number;
        }>;
    };
    readonly 'auth:status': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            loggedIn: z.ZodBoolean;
            email: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            email: string | null;
            name: string | null;
            loggedIn: boolean;
        }, {
            email: string | null;
            name: string | null;
            loggedIn: boolean;
        }>;
    };
    readonly 'auth:login': {
        readonly input: z.ZodObject<{
            email: z.ZodString;
            password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            password: string;
        }, {
            email: string;
            password: string;
        }>;
        readonly output: z.ZodObject<{
            success: z.ZodBoolean;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
            errorMessage?: string | undefined;
        }, {
            success: boolean;
            errorMessage?: string | undefined;
        }>;
    };
    readonly 'auth:register': {
        readonly input: z.ZodObject<{
            email: z.ZodString;
            name: z.ZodString;
            password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            name: string;
            password: string;
        }, {
            email: string;
            name: string;
            password: string;
        }>;
        readonly output: z.ZodObject<{
            success: z.ZodBoolean;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
            errorMessage?: string | undefined;
        }, {
            success: boolean;
            errorMessage?: string | undefined;
        }>;
    };
    readonly 'auth:logout': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'team:list': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodArray<z.ZodAny, "many">;
    };
    readonly 'team:create': {
        readonly input: z.ZodObject<{
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
        }, {
            name: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:invite': {
        readonly input: z.ZodObject<{
            teamId: z.ZodString;
            email: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            teamId: string;
        }, {
            email: string;
            teamId: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:acceptInvite': {
        readonly input: z.ZodObject<{
            code: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            code: string;
        }, {
            code: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:billing': {
        readonly input: z.ZodObject<{
            teamId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            teamId: string;
        }, {
            teamId: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:billingCheckout': {
        readonly input: z.ZodObject<{
            teamId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            teamId: string;
        }, {
            teamId: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:billingPortal': {
        readonly input: z.ZodObject<{
            teamId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            teamId: string;
        }, {
            teamId: string;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'team:auditLog': {
        readonly input: z.ZodObject<{
            teamId: z.ZodString;
            limit: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            teamId: string;
            limit?: number | undefined;
        }, {
            teamId: string;
            limit?: number | undefined;
        }>;
        readonly output: z.ZodAny;
    };
    readonly 'widget:favorites': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            requestIds: z.ZodArray<z.ZodString, "many">;
            supported: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            requestIds: string[];
            supported: boolean;
        }, {
            requestIds: string[];
            supported: boolean;
        }>;
    };
    readonly 'widget:setFavorite': {
        readonly input: z.ZodObject<{
            requestId: z.ZodString;
            favorite: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            requestId: string;
            favorite: boolean;
        }, {
            requestId: string;
            favorite: boolean;
        }>;
        readonly output: z.ZodObject<{
            requestIds: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            requestIds: string[];
        }, {
            requestIds: string[];
        }>;
    };
    readonly 'widget:ready': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
        }, {
            ok: boolean;
        }>;
    };
    readonly 'widget:runResult': {
        readonly input: z.ZodObject<{
            runId: z.ZodString;
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            runId: string;
            error?: string | undefined;
        }, {
            ok: boolean;
            runId: string;
            error?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
        }, {
            ok: boolean;
        }>;
    };
    readonly 'globals:list': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    };
    readonly 'globals:set': {
        readonly input: z.ZodObject<{
            key: z.ZodString;
            value: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            key: string;
            value?: unknown;
        }, {
            key: string;
            value?: unknown;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'globals:delete': {
        readonly input: z.ZodObject<{
            key: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            key: string;
        }, {
            key: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'oauth:ensureToken': {
        readonly input: z.ZodObject<{
            grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
            tokenUrl: z.ZodString;
            authUrl: z.ZodOptional<z.ZodString>;
            redirectUri: z.ZodOptional<z.ZodString>;
            clientId: z.ZodString;
            clientSecret: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
            tokenCacheKey: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }, {
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            accessToken: z.ZodOptional<z.ZodString>;
            tokenType: z.ZodOptional<z.ZodString>;
            expiresAt: z.ZodOptional<z.ZodNumber>;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
            accessToken?: string | undefined;
            tokenType?: string | undefined;
            expiresAt?: number | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
            accessToken?: string | undefined;
            tokenType?: string | undefined;
            expiresAt?: number | undefined;
        }>;
    };
    readonly 'oauth:getAuthUrl': {
        readonly input: z.ZodObject<{
            grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
            tokenUrl: z.ZodString;
            authUrl: z.ZodOptional<z.ZodString>;
            redirectUri: z.ZodOptional<z.ZodString>;
            clientId: z.ZodString;
            clientSecret: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
            tokenCacheKey: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }, {
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            url: z.ZodString;
            verifier: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verifier: string;
        }, {
            url: string;
            verifier: string;
        }>;
    };
    readonly 'oauth:exchangeCode': {
        readonly input: z.ZodObject<{
            grant: z.ZodEnum<["client_credentials", "password", "authorization_code"]>;
            tokenUrl: z.ZodString;
            authUrl: z.ZodOptional<z.ZodString>;
            redirectUri: z.ZodOptional<z.ZodString>;
            clientId: z.ZodString;
            clientSecret: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
            tokenCacheKey: z.ZodString;
        } & {
            code: z.ZodString;
            verifier: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            code: string;
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            verifier: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }, {
            code: string;
            grant: "password" | "client_credentials" | "authorization_code";
            tokenUrl: string;
            clientId: string;
            tokenCacheKey: string;
            verifier: string;
            password?: string | undefined;
            username?: string | undefined;
            authUrl?: string | undefined;
            redirectUri?: string | undefined;
            clientSecret?: string | undefined;
            scope?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            accessToken: z.ZodOptional<z.ZodString>;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
            accessToken?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
            accessToken?: string | undefined;
        }>;
    };
    readonly 'autoHeaders:get': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodBoolean;
            builtin: z.ZodOptional<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }, {
            value: string;
            key: string;
            enabled: boolean;
            description?: string | undefined;
            builtin?: boolean | undefined;
        }>, "many">;
    };
    readonly 'autoHeaders:set': {
        readonly input: z.ZodObject<{
            items: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
                enabled: z.ZodBoolean;
                builtin: z.ZodOptional<z.ZodBoolean>;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
                builtin?: boolean | undefined;
            }, {
                value: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
                builtin?: boolean | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            items: {
                value: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
                builtin?: boolean | undefined;
            }[];
        }, {
            items: {
                value: string;
                key: string;
                enabled: boolean;
                description?: string | undefined;
                builtin?: boolean | undefined;
            }[];
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'sync:status': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            state: z.ZodEnum<["offline", "syncing", "synced", "conflict", "error"]>;
            lastSyncedAt: z.ZodNullable<z.ZodString>;
            pendingChanges: z.ZodNumber;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            state: "error" | "offline" | "syncing" | "synced" | "conflict";
            lastSyncedAt: string | null;
            pendingChanges: number;
            errorMessage?: string | undefined;
        }, {
            state: "error" | "offline" | "syncing" | "synced" | "conflict";
            lastSyncedAt: string | null;
            pendingChanges: number;
            errorMessage?: string | undefined;
        }>;
    };
    readonly 'sync:force': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId?: string | undefined;
        }, {
            workspaceId?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            started: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            started: boolean;
        }, {
            started: boolean;
        }>;
    };
    readonly 'conflict:list': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
        }, {
            workspaceId: string;
        }>;
        readonly output: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            workspaceId: z.ZodString;
            table: z.ZodEnum<["collection", "request", "environment"]>;
            rowId: z.ZodString;
            previousState: z.ZodUnknown;
            overwrittenByName: z.ZodString;
            overwrittenByUserId: z.ZodString;
            overwrittenAt: z.ZodNumber;
            dismissedAt: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            workspaceId: string;
            table: "request" | "collection" | "environment";
            rowId: string;
            overwrittenAt: number;
            overwrittenByName: string;
            overwrittenByUserId: string;
            dismissedAt: number | null;
            previousState?: unknown;
        }, {
            id: string;
            workspaceId: string;
            table: "request" | "collection" | "environment";
            rowId: string;
            overwrittenAt: number;
            overwrittenByName: string;
            overwrittenByUserId: string;
            dismissedAt: number | null;
            previousState?: unknown;
        }>, "many">;
    };
    readonly 'conflict:dismiss': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'conflict:restore': {
        readonly input: z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            ok: boolean;
            error?: string | undefined;
        }, {
            ok: boolean;
            error?: string | undefined;
        }>;
    };
    readonly 'import:source': {
        readonly input: z.ZodObject<{
            workspaceId: z.ZodString;
            source: z.ZodEnum<["postman", "insomnia", "openapi", "curl", "har"]>;
            filePath: z.ZodOptional<z.ZodString>;
            content: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            workspaceId: string;
            source: "postman" | "insomnia" | "openapi" | "curl" | "har";
            content?: string | undefined;
            filePath?: string | undefined;
        }, {
            workspaceId: string;
            source: "postman" | "insomnia" | "openapi" | "curl" | "har";
            content?: string | undefined;
            filePath?: string | undefined;
        }>;
        readonly output: z.ZodObject<{
            success: z.ZodBoolean;
            collectionId: z.ZodOptional<z.ZodString>;
            requestId: z.ZodOptional<z.ZodString>;
            summary: z.ZodObject<{
                collections: z.ZodNumber;
                requests: z.ZodNumber;
                environments: z.ZodNumber;
                warnings: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                collections: number;
                requests: number;
                environments: number;
                warnings: string[];
            }, {
                collections: number;
                requests: number;
                environments: number;
                warnings: string[];
            }>;
            errorMessage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
            summary: {
                collections: number;
                requests: number;
                environments: number;
                warnings: string[];
            };
            collectionId?: string | undefined;
            requestId?: string | undefined;
            errorMessage?: string | undefined;
        }, {
            success: boolean;
            summary: {
                collections: number;
                requests: number;
                environments: number;
                warnings: string[];
            };
            collectionId?: string | undefined;
            requestId?: string | undefined;
            errorMessage?: string | undefined;
        }>;
    };
    readonly 'app:info': {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly output: z.ZodObject<{
            version: z.ZodString;
            platform: z.ZodEnum<["macos", "windows", "linux"]>;
            dbPath: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            platform: "macos" | "windows" | "linux";
            version: string;
            dbPath: string;
        }, {
            platform: "macos" | "windows" | "linux";
            version: string;
            dbPath: string;
        }>;
    };
    readonly 'app:openExternal': {
        readonly input: z.ZodObject<{
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
        }, {
            url: string;
        }>;
        readonly output: z.ZodObject<{
            ok: z.ZodLiteral<true>;
        }, "strip", z.ZodTypeAny, {
            ok: true;
        }, {
            ok: true;
        }>;
    };
    readonly 'app:showFilePicker': {
        readonly input: z.ZodObject<{
            filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                extensions: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                name: string;
                extensions: string[];
            }, {
                name: string;
                extensions: string[];
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            filters?: {
                name: string;
                extensions: string[];
            }[] | undefined;
        }, {
            filters?: {
                name: string;
                extensions: string[];
            }[] | undefined;
        }>;
        readonly output: z.ZodObject<{
            cancelled: z.ZodBoolean;
            filePath: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            cancelled: boolean;
            filePath?: string | undefined;
        }, {
            cancelled: boolean;
            filePath?: string | undefined;
        }>;
    };
    readonly 'app:readFileText': {
        readonly input: z.ZodObject<{
            filePath: z.ZodString;
            /** Read at most this many bytes (default 4 MiB). Used by import preview. */
            maxBytes: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            filePath: string;
            maxBytes?: number | undefined;
        }, {
            filePath: string;
            maxBytes?: number | undefined;
        }>;
        readonly output: z.ZodObject<{
            content: z.ZodString;
            truncated: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            content: string;
            truncated: boolean;
            error?: string | undefined;
        }, {
            content: string;
            truncated: boolean;
            error?: string | undefined;
        }>;
    };
};
export type IpcChannel = keyof typeof IPC;
export type IpcInput<C extends IpcChannel> = z.infer<(typeof IPC)[C]['input']>;
export type IpcOutput<C extends IpcChannel> = z.infer<(typeof IPC)[C]['output']>;
export declare const SyncStateChangedEvent: z.ZodObject<{
    type: z.ZodLiteral<"sync:stateChanged">;
    state: z.ZodEnum<["offline", "syncing", "synced", "conflict", "error"]>;
    pendingChanges: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "sync:stateChanged";
    state: "error" | "offline" | "syncing" | "synced" | "conflict";
    pendingChanges: number;
}, {
    type: "sync:stateChanged";
    state: "error" | "offline" | "syncing" | "synced" | "conflict";
    pendingChanges: number;
}>;
export declare const ConflictDetectedEvent: z.ZodObject<{
    type: z.ZodLiteral<"sync:conflictDetected">;
    workspaceId: z.ZodString;
    rowId: z.ZodString;
    table: z.ZodEnum<["collection", "request", "environment"]>;
    overwrittenByName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "sync:conflictDetected";
    workspaceId: string;
    table: "request" | "collection" | "environment";
    rowId: string;
    overwrittenByName: string;
}, {
    type: "sync:conflictDetected";
    workspaceId: string;
    table: "request" | "collection" | "environment";
    rowId: string;
    overwrittenByName: string;
}>;
export declare const DataChangedEvent: z.ZodObject<{
    type: z.ZodLiteral<"data:changed">;
    table: z.ZodEnum<["collection", "request", "environment", "workspace"]>;
    workspaceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "data:changed";
    table: "request" | "collection" | "environment" | "workspace";
    workspaceId?: string | undefined;
}, {
    type: "data:changed";
    table: "request" | "collection" | "environment" | "workspace";
    workspaceId?: string | undefined;
}>;
export declare const MainEvent: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"sync:stateChanged">;
    state: z.ZodEnum<["offline", "syncing", "synced", "conflict", "error"]>;
    pendingChanges: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "sync:stateChanged";
    state: "error" | "offline" | "syncing" | "synced" | "conflict";
    pendingChanges: number;
}, {
    type: "sync:stateChanged";
    state: "error" | "offline" | "syncing" | "synced" | "conflict";
    pendingChanges: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"sync:conflictDetected">;
    workspaceId: z.ZodString;
    rowId: z.ZodString;
    table: z.ZodEnum<["collection", "request", "environment"]>;
    overwrittenByName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "sync:conflictDetected";
    workspaceId: string;
    table: "request" | "collection" | "environment";
    rowId: string;
    overwrittenByName: string;
}, {
    type: "sync:conflictDetected";
    workspaceId: string;
    table: "request" | "collection" | "environment";
    rowId: string;
    overwrittenByName: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"data:changed">;
    table: z.ZodEnum<["collection", "request", "environment", "workspace"]>;
    workspaceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "data:changed";
    table: "request" | "collection" | "environment" | "workspace";
    workspaceId?: string | undefined;
}, {
    type: "data:changed";
    table: "request" | "collection" | "environment" | "workspace";
    workspaceId?: string | undefined;
}>]>;
export type MainEvent = z.infer<typeof MainEvent>;
