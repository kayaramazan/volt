"use strict";
// Locates the `volt.db` file that the desktop app maintains. Mirrors the
// platform conventions Electron's app.getPath('userData') uses — so this
// CLI reads from the same file the Volt desktop app writes to.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userDataDir = userDataDir;
exports.dbPath = dbPath;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const APP_DIR_NAME = 'Volt';
/** Equivalent of Electron's `app.getPath('userData')`. */
function userDataDir() {
    if (process.env.VOLT_USER_DATA)
        return process.env.VOLT_USER_DATA;
    const home = node_os_1.default.homedir();
    switch (process.platform) {
        case 'darwin':
            return node_path_1.default.join(home, 'Library', 'Application Support', APP_DIR_NAME);
        case 'win32': {
            const appData = process.env.APPDATA;
            if (appData)
                return node_path_1.default.join(appData, APP_DIR_NAME);
            return node_path_1.default.join(home, 'AppData', 'Roaming', APP_DIR_NAME);
        }
        default: {
            // Linux + everything else — XDG_CONFIG_HOME or ~/.config
            const xdg = process.env.XDG_CONFIG_HOME;
            return node_path_1.default.join(xdg && xdg.length > 0 ? xdg : node_path_1.default.join(home, '.config'), APP_DIR_NAME);
        }
    }
}
function dbPath() {
    if (process.env.VOLT_DB)
        return process.env.VOLT_DB;
    return node_path_1.default.join(userDataDir(), 'volt.db');
}
