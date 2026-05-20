// Electron main process bootstrap.
//
// Lifecycle:
//   1. App ready → open DB
//   2. Restore session from keychain (validates with backend if reachable)
//   3. Create main window with strict security settings
//   4. Register IPC handlers
//   5. Start sync engine (2s after window appears, so UI is unblocked)
//   6. Wire up quit handlers

import { app, BrowserWindow, Menu, session } from 'electron';
import path from 'node:path';

import { closeDb, getDb } from './core/db/connection';
import { restoreSession } from './core/auth/manager';
import { registerIpcHandlers } from './ipc/handlers';
import { startSync, stopSync } from './core/sync/engine';

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Performance: enable V8 cache for renderer code (faster cold start).
app.commandLine.appendSwitch('disk-cache-size', '52428800'); // 50 MB

// Single-instance lock — second launch focuses existing window instead of duplicating.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: re-create window when clicking dock icon if no windows open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// On non-macOS, quit when all windows closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopSync();
  closeDb();
});

// ─────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Set strict CSP via session
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: http://localhost:*"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self'",
        ],
      },
    });
  });

  // Initialize DB lazily — getDb() opens on first access
  getDb();

  // Register IPC handlers BEFORE creating window so renderer can call them immediately
  registerIpcHandlers();

  // Restore previous session (best-effort, doesn't block window creation)
  void restoreSession();

  createMainWindow();

  // Sync starts 2s after window so UI is responsive first.
  setTimeout(() => {
    startSync();
  }, 2000);
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Volt',
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // wait for ready-to-show to avoid flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // CRITICAL SECURITY SETTINGS — never disable these
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Allow CodeMirror to use eval-free editor (no unsafe-eval needed in prod CSP)
    },
  });

  // Set up minimal menu in non-dev (or replace with full custom menu later)
  if (!isDev && process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  // Load app
  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in OS browser, not new Electron windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Forbid navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL);
    const isFileUrl = url.startsWith('file://');
    if (!allowed && !isFileUrl) {
      event.preventDefault();
    }
  });
}
