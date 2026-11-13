import { z } from 'zod';
export declare const RegisterInput: z.ZodObject<{
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
export type RegisterInput = z.infer<typeof RegisterInput>;
export declare const LoginInput: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    device: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        platform: z.ZodEnum<["macos", "windows", "linux"]>;
        appVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
    }, {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    device?: {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
    } | undefined;
}, {
    email: string;
    password: string;
    device?: {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
    } | undefined;
}>;
export type LoginInput = z.infer<typeof LoginInput>;
export declare const ChangePasswordInput: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;
export declare const LoginOutput: z.ZodObject<{
    sessionId: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        id: string;
    }, {
        email: string;
        name: string;
        id: string;
    }>;
    device: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        id: string;
    }, {
        label: string;
        id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    user: {
        email: string;
        name: string;
        id: string;
    };
    device?: {
        label: string;
        id: string;
    } | undefined;
}, {
    sessionId: string;
    user: {
        email: string;
        name: string;
        id: string;
    };
    device?: {
        label: string;
        id: string;
    } | undefined;
}>;
export type LoginOutput = z.infer<typeof LoginOutput>;
export declare const TeamSummary: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["OWNER", "EDITOR", "VIEWER"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
}, {
    name: string;
    id: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
}>;
export declare const DeviceSummary: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    platform: z.ZodEnum<["macos", "windows", "linux"]>;
    appVersion: z.ZodString;
    lastSeenAt: z.ZodString;
    current: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    label: string;
    platform: "macos" | "windows" | "linux";
    appVersion: string;
    id: string;
    lastSeenAt: string;
    current: boolean;
}, {
    label: string;
    platform: "macos" | "windows" | "linux";
    appVersion: string;
    id: string;
    lastSeenAt: string;
    current: boolean;
}>;
export declare const MeOutput: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    teams: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        role: z.ZodEnum<["OWNER", "EDITOR", "VIEWER"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        role: "OWNER" | "EDITOR" | "VIEWER";
    }, {
        name: string;
        id: string;
        role: "OWNER" | "EDITOR" | "VIEWER";
    }>, "many">;
    devices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        platform: z.ZodEnum<["macos", "windows", "linux"]>;
        appVersion: z.ZodString;
        lastSeenAt: z.ZodString;
        current: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
        id: string;
        lastSeenAt: string;
        current: boolean;
    }, {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
        id: string;
        lastSeenAt: string;
        current: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    id: string;
    teams: {
        name: string;
        id: string;
        role: "OWNER" | "EDITOR" | "VIEWER";
    }[];
    devices: {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
        id: string;
        lastSeenAt: string;
        current: boolean;
    }[];
}, {
    email: string;
    name: string;
    id: string;
    teams: {
        name: string;
        id: string;
        role: "OWNER" | "EDITOR" | "VIEWER";
    }[];
    devices: {
        label: string;
        platform: "macos" | "windows" | "linux";
        appVersion: string;
        id: string;
        lastSeenAt: string;
        current: boolean;
    }[];
}>;
export type MeOutput = z.infer<typeof MeOutput>;
