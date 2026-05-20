// OS keychain access via keytar.
//
// Used for:
//   - Backend session tokens (one per logged-in account)
//   - Secret variable values (referenced from local DB by secretRef)
//
// Fallback: on Linux without a Secret Service running (headless servers,
// CI), keytar throws. We catch that and use an encrypted file fallback.

import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const SERVICE = 'Volt';

// Dynamic require so the app doesn't crash if keytar fails to load.
let keytar: typeof import('keytar') | null = null;
let keytarAvailable: boolean | null = null;

async function getKeytar(): Promise<typeof import('keytar') | null> {
  if (keytarAvailable === false) return null;
  if (keytar) return keytar;
  try {
    // CJS module: dynamic import yields a namespace wrapper, so unwrap `.default`
    // (Node's named-export detection on CJS is inconsistent — see deletePassword).
    const mod = await import('keytar');
    keytar = ((mod as any).default ?? mod) as typeof import('keytar');
    // Probe — some Linux setups load keytar but Secret Service is unavailable.
    await keytar.getPassword(SERVICE, '__probe__');
    keytarAvailable = true;
    return keytar;
  } catch {
    keytarAvailable = false;
    return null;
  }
}

export async function setSecret(account: string, value: string): Promise<void> {
  const k = await getKeytar();
  if (k) {
    await k.setPassword(SERVICE, account, value);
    return;
  }
  // Fallback: encrypted file in userData
  writeEncryptedFallback(account, value);
}

export async function getSecret(account: string): Promise<string | null> {
  const k = await getKeytar();
  if (k) {
    return k.getPassword(SERVICE, account);
  }
  return readEncryptedFallback(account);
}

export async function deleteSecret(account: string): Promise<void> {
  const k = await getKeytar();
  if (k) {
    await k.deletePassword(SERVICE, account);
    return;
  }
  deleteEncryptedFallback(account);
}

// ─────────────────────────────────────────────────────────
// File fallback (encrypted with Electron safeStorage)
// ─────────────────────────────────────────────────────────

function fallbackDir(): string {
  const dir = path.join(app.getPath('userData'), 'secrets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function fallbackFile(account: string): string {
  const safe = account.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(fallbackDir(), `${safe}.bin`);
}

function writeEncryptedFallback(account: string, value: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    // Last resort: plaintext with 0600 perms. Log warning.
    console.warn(
      '⚠ safeStorage not available. Storing secret in plaintext (0600). Consider running with a desktop session that supports Secret Service.',
    );
    fs.writeFileSync(fallbackFile(account), value, { mode: 0o600 });
    return;
  }
  const encrypted = safeStorage.encryptString(value);
  fs.writeFileSync(fallbackFile(account), encrypted, { mode: 0o600 });
}

function readEncryptedFallback(account: string): string | null {
  const file = fallbackFile(account);
  if (!fs.existsSync(file)) return null;
  const data = fs.readFileSync(file);
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(data);
    } catch {
      return null;
    }
  }
  return data.toString('utf-8');
}

function deleteEncryptedFallback(account: string) {
  const file = fallbackFile(account);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
