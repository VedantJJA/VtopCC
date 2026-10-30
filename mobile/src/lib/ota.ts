import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

/**
 * OTA update manifest URL. Host a JSON file shaped like:
 *   { "version": "1.0.1", "url": "https://vtopcc.klouds.online/ota/bundle-1.0.1.zip" }
 * The zip must contain the contents of `dist/` (index.html at its root).
 * Override at build time with VITE_OTA_MANIFEST_URL.
 */
export const OTA_MANIFEST_URL: string =
  (import.meta.env.VITE_OTA_MANIFEST_URL as string | undefined) ||
  'https://vtopcc.klouds.online/ota/version.json';

export interface AppVersionInfo {
  currentVersion: string;
  isNative: boolean;
  serverVersion: string | null;
  downloadUrl: string | null;
  updateAvailable: boolean;
  status: 'idle' | 'checking' | 'up_to_date' | 'update_available' | 'error';
  errorMessage?: string;
}

/**
 * Runs on app boot. Confirms to CapacitorUpdater that the webview loaded successfully
 * so that the plugin does not trigger an auto-rollback.
 */
export async function initOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Confirms current bundle booted fine (vital to prevent automatic rollback)
    await CapacitorUpdater.notifyAppReady();
    console.log('[OTA] notifyAppReady sent successfully.');
  } catch (e) {
    console.warn('[OTA] init failed:', e);
  }
}

/**
 * Checks for updates: fetches current installed app version and latest server version from manifest.
 */
export async function checkAppVersion(): Promise<AppVersionInfo> {
  let currentVersion = '1.0.0';
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version) {
        currentVersion = current.bundle.version;
      }
    } catch (e) {
      console.warn('[OTA] Could not read native bundle version:', e);
    }
  }

  try {
    const res = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { 
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) {
      return {
        currentVersion,
        isNative,
        serverVersion: null,
        downloadUrl: null,
        updateAvailable: false,
        status: 'error',
        errorMessage: `Update server responded with status ${res.status}`
      };
    }

    const manifest = (await res.json()) as { version?: string; url?: string };
    const serverVersion = manifest.version || null;
    const downloadUrl = manifest.url || null;

    if (!serverVersion || !downloadUrl) {
      return {
        currentVersion,
        isNative,
        serverVersion: null,
        downloadUrl: null,
        updateAvailable: false,
        status: 'error',
        errorMessage: 'Invalid update manifest on server'
      };
    }

    const isDifferent = isVersionNewer(serverVersion, currentVersion);

    return {
      currentVersion,
      isNative,
      serverVersion,
      downloadUrl,
      updateAvailable: isDifferent,
      status: isDifferent ? 'update_available' : 'up_to_date'
    };
  } catch (err: any) {
    console.warn('[OTA] Version check failed:', err);
    return {
      currentVersion,
      isNative,
      serverVersion: null,
      downloadUrl: null,
      updateAvailable: false,
      status: 'error',
      errorMessage: err?.message || 'Could not connect to update server'
    };
  }
}

/**
 * Compares two semantic version strings (e.g. "1.0.1" > "1.0.0").
 */
export function isVersionNewer(remote: string, current: string): boolean {
  if (!remote || !current) return false;
  if (remote === current) return false;

  const rParts = remote.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const cParts = current.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Performs the OTA download and immediately applies the new bundle.
 */
export async function applyOtaUpdate(
  version: string,
  url: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    onProgress?.('Web mode: simulating update...');
    await new Promise(r => setTimeout(r, 1200));
    return {
      success: true,
      message: 'On web browsers, reload the tab to access the latest version directly.'
    };
  }

  try {
    onProgress?.('Downloading update bundle...');
    const bundle = await CapacitorUpdater.download({ url, version });

    onProgress?.('Installing and activating bundle...');
    await CapacitorUpdater.set({ id: bundle.id });

    return {
      success: true,
      message: `Update v${version} applied successfully!`
    };
  } catch (err: any) {
    console.error('[OTA] Update installation failed:', err);
    return {
      success: false,
      message: err?.message || 'Failed to install update.'
    };
  }
}
