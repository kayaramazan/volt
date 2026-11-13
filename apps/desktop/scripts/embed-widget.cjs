// electron-builder afterSign hook: embeds the native widget extension and its
// reload helper into Volt.app, signs them, then re-seals the outer app.
//
// Why afterSign: electron-builder deliberately skips Contents/PlugIns when it
// signs, and the extension needs its own sandbox entitlements. Inserting it
// after signing and re-sealing the outer bundle keeps both signatures valid.
// Build the pieces first with scripts/build-widget.sh (done by build:mac).
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TEAM_ID = '2WPVK976M4'; // must match the App Group prefix in the entitlements
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'native/VoltWidget/build/out');

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

exports.default = async function embedWidget(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const appex = path.join(OUT, 'VoltWidget.appex');
  const helper = path.join(OUT, 'volt-widget-reload');
  if (!fs.existsSync(appex) || !fs.existsSync(helper)) {
    console.warn('  • widget: native/VoltWidget/build/out missing — run scripts/build-widget.sh; skipping widget');
    return;
  }

  // Reuse whatever identity electron-builder signed the app with
  // (codesign -d prints its details on stderr).
  const r = spawnSync('codesign', ['-dvv', appPath], { encoding: 'utf8' });
  const info = `${r.stdout}${r.stderr}`;
  const identity = /Authority=(.+)/.exec(info)?.[1]?.trim();
  const team = /TeamIdentifier=(.+)/.exec(info)?.[1]?.trim();
  if (!identity || team !== TEAM_ID) {
    console.warn(`  • widget: app is not signed by team ${TEAM_ID} (got ${team ?? 'unsigned'}); skipping widget`);
    return;
  }
  const timestamp = identity.startsWith('Developer ID') ? ['--timestamp'] : ['--timestamp=none'];
  const version = context.packager.appInfo.version;

  const plugins = path.join(appPath, 'Contents/PlugIns');
  const dstAppex = path.join(plugins, 'VoltWidget.appex');
  fs.mkdirSync(plugins, { recursive: true });
  fs.rmSync(dstAppex, { recursive: true, force: true });
  sh('ditto', [appex, dstAppex]);
  const plist = path.join(dstAppex, 'Contents/Info.plist');
  sh('plutil', ['-replace', 'CFBundleShortVersionString', '-string', version, plist]);
  sh('plutil', ['-replace', 'CFBundleVersion', '-string', version, plist]);
  sh('codesign', ['--force', '--sign', identity, '--options', 'runtime', ...timestamp,
    '--entitlements', path.join(ROOT, 'native/VoltWidget/VoltWidget.entitlements'), dstAppex]);

  const dstHelper = path.join(appPath, 'Contents/MacOS/volt-widget-reload');
  fs.copyFileSync(helper, dstHelper);
  fs.chmodSync(dstHelper, 0o755);
  sh('codesign', ['--force', '--sign', identity, '--options', 'runtime', ...timestamp, dstHelper]);

  // Re-seal the outer bundle so its signature covers the new files.
  sh('codesign', ['--force', '--sign', identity, '--options', 'runtime', ...timestamp,
    '--entitlements', path.join(ROOT, 'build/entitlements.mac.plist'), appPath]);
  sh('codesign', ['--verify', '--deep', '--strict', appPath]);
  console.log(`  • widget: embedded VoltWidget.appex (signed by ${identity})`);
};
