// Common utilities shared across the renderer.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware className merger. Resolves conflicts so the last
 * conflicting class wins: cn("p-4", "p-2") === "p-2".
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a HTTP status code with class for color: 2xx green, 3xx blue,
 * 4xx orange, 5xx red.
 */
export function statusColorClass(status: number | null | undefined): string {
  if (status == null) return 'text-text-muted';
  if (status >= 200 && status < 300) return 'text-success';
  if (status >= 300 && status < 400) return 'text-sky-400';
  if (status >= 400 && status < 500) return 'text-warning';
  if (status >= 500) return 'text-error';
  return 'text-text-muted';
}

/**
 * Color a HTTP method with method-appropriate class.
 */
export function methodColorClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-sky-400';
    case 'POST':
      return 'text-success';
    case 'PUT':
      return 'text-warning';
    case 'PATCH':
      return 'text-purple-400';
    case 'DELETE':
      return 'text-error';
    case 'HEAD':
    case 'OPTIONS':
      return 'text-text-muted';
    default:
      return 'text-text';
  }
}

/**
 * Format bytes as a human-readable string (1.2 MB, 845 KB).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Format a duration in ms as a human string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format a timestamp as "HH:MM:SS" for today, "MMM DD HH:MM" otherwise.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate a stable client-side ID for ephemeral row entries before sync.
 * Backend will produce its own UUID; we just need uniqueness in-session.
 */
export function rowId(prefix = 'row'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Debounce — used heavily in the URL bar / search inputs.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Decode a base64 string to a string for display. For binary content,
 * we'll show a placeholder instead.
 */
export function tryDecodeBase64(
  base64: string | null,
  contentType: string | null,
): { text: string | null; isBinary: boolean } {
  if (!base64) return { text: null, isBinary: false };
  if (contentType && !isTextContentType(contentType)) {
    return { text: null, isBinary: true };
  }
  try {
    // atob is available in Electron renderer
    const bin = atob(base64);
    return { text: bin, isBinary: false };
  } catch {
    return { text: null, isBinary: true };
  }
}

function isTextContentType(ct: string): boolean {
  const lower = ct.toLowerCase();
  return (
    lower.startsWith('text/') ||
    lower.includes('json') ||
    lower.includes('xml') ||
    lower.includes('javascript') ||
    lower.includes('html') ||
    lower.includes('css') ||
    lower.includes('yaml')
  );
}
