// Locates the `volt.db` file that the desktop app maintains. Mirrors the
// platform conventions Electron's app.getPath('userData') uses — so this
// CLI reads from the same file the Volt desktop app writes to.

import os from 'node:os';
import path from 'node:path';

const APP_DIR_NAME = 'Volt';

/** Equivalent of Electron's `app.getPath('userData')`. */
export function userDataDir(): string {
  if (process.env.VOLT_USER_DATA) return process.env.VOLT_USER_DATA;
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', APP_DIR_NAME);
    case 'win32': {
      const appData = process.env.APPDATA;
      if (appData) return path.join(appData, APP_DIR_NAME);
      return path.join(home, 'AppData', 'Roaming', APP_DIR_NAME);
    }
    default: {
      // Linux + everything else — XDG_CONFIG_HOME or ~/.config
      const xdg = process.env.XDG_CONFIG_HOME;
      return path.join(xdg && xdg.length > 0 ? xdg : path.join(home, '.config'), APP_DIR_NAME);
    }
  }
}

export function dbPath(): string {
  if (process.env.VOLT_DB) return process.env.VOLT_DB;
  return path.join(userDataDir(), 'volt.db');
}
