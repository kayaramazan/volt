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
import { bootMockServer } from './core/mock/server';
import { loadAllPlugins } from './core/plugins/runtime';
import { startSync, stopSync } from './core/sync/engine';
import { handleVoltUrl, initWidgetBridge } from './core/widget/bridge';

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Performance: enable V8 cache for renderer code (faster cold start).
app.commandLine.appendSwitch('disk-cache-size', '52428800'); // 50 MB

// Optional data-folder override (e.g. run a dev build next to the installed
// app without fighting over the single-instance lock or the same SQLite DB).
// Must run before the lock and before anything reads app.getPath('userData').
if (process.env.VOLT_USER_DATA_DIR) {
  app.setPath('userData', process.env.VOLT_USER_DATA_DIR);
}

// Single-instance lock — second launch focuses existing window instead of duplicating.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

// volt:// deep links (desktop widget). macOS delivers them via open-url, which
// can fire before the app is ready (when the link launched Volt), so queue
// them until the widget bridge is up.
let widgetBridgeReady = false;
const pendingUrls: string[] = [];
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (widgetBridgeReady) handleVoltUrl(url);
  else pendingUrls.push(url);
});
if (app.isPackaged && !app.isDefaultProtocolClient('volt')) {
  app.setAsDefaultProtocolClient('volt');
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Dev builds run the stock Electron binary, so the dock/taskbar shows the
// Electron logo. Use the Volt icon there too; packaged builds get it from the
// bundle (build/icon.icns / icon.png via electron-builder).
const DEV_ICON_PATH = path.join(__dirname, '../build/icon.png');
if (!app.isPackaged && process.platform === 'darwin') {
  app.whenReady().then(() => {
    try {
      app.dock?.setIcon(DEV_ICON_PATH);
    } catch {
      /* icon missing in a partial checkout — keep the default */
    }
  });
}

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

  void initWidgetBridge({
    getWindow: () => mainWindow ?? createMainWindow(),
  }).then(() => {
    widgetBridgeReady = true;
    for (const url of pendingUrls.splice(0)) handleVoltUrl(url);
  });

  // Sync starts 2s after window so UI is responsive first.
  setTimeout(() => {
    startSync();
  }, 2000);

  // Mock server boots on the same timer iff the user previously left it on.
  setTimeout(() => {
    void bootMockServer();
  }, 2500);

  // Plugins are cheap to load (just synchronous vm evals), so we do them
  // eagerly so the renderer has the list available the moment a user opens
  // the Plugins panel or the Transform dropdown.
  try {
    loadAllPlugins();
  } catch {
    // Failure is non-fatal — the plugin folder might not exist yet on a
    // fresh install. The Plugins modal will show "0 loaded" and the user
    // can hit Reload after dropping files in.
  }
});

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Volt',
    // Window/taskbar icon on Windows/Linux in dev (packaged builds embed it).
    ...(!app.isPackaged && process.platform !== 'darwin' ? { icon: DEV_ICON_PATH } : {}),
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
  mainWindow = win;

  // Install a custom menu so we can override Cmd/Ctrl+W to close the active
  // tab instead of the window. We also wire Cmd/Ctrl+Shift+W to "Close window"
  // for parity with browser conventions.
  installAppMenu(mainWindow);

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

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
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

  return win;
}

/**
 * Custom application menu. Replaces the default macOS Cmd+W "Close Window"
 * with a Cmd+W "Close Tab" that dispatches a `volt:event` to the renderer.
 * Cmd+Shift+W keeps the window-close path available.
 */
function installAppMenu(win: BrowserWindow) {
  const isMac = process.platform === 'darwin';
  const sendCloseTab = () => {
    win.webContents.send('volt:event', { kind: 'menu:close-current-tab' });
  };

  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Close Tab',
      accelerator: 'CommandOrControl+W',
      click: sendCloseTab,
    },
    {
      label: 'Close Window',
      accelerator: 'CommandOrControl+Shift+W',
      role: 'close',
    },
  ];

  const template: Electron.MenuItemConstructorOptions[] = [];
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({ label: 'File', submenu: fileSubmenu });
  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  });
  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });
  template.push({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ role: 'close' as const }]),
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
