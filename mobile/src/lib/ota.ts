import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

/**
 * OTA update manifest URL. Host a JSON file shaped like:
 *   { "version": "1.0.1", "url": "https://your.host/bundles/1.0.1.zip" }
 * The zip must contain the contents of `dist/` (index.html at its root).
 * Override at build time with VITE_OTA_MANIFEST_URL.
 */
export const OTA_MANIFEST_URL: string =
  (import.meta.env.VITE_OTA_MANIFEST_URL as string | undefined) ||
  'https://vtopcc.klouds.online/ota/version.json';

export async function initOta(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Confirms the current bundle booted fine (otherwise plugin rolls back).
    await CapacitorUpdater.notifyAppReady();
    await checkForUpdate();
  } catch (e) {
    console.warn('[OTA] init failed', e);
  }
}

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version, url } = (await res.json()) as { version: string; url: string };
    if (!version || !url) return;

    const current = await CapacitorUpdater.current();
    const currentVersion = current.bundle.version;
    if (currentVersion === version) return;

    const list = await CapacitorUpdater.list();
    if (list.bundles.some((b) => b.version === version && b.status === 'error')) return;

    // Download in the background, then apply on next app launch (no interruption).
    const bundle = await CapacitorUpdater.download({ url, version });
    await CapacitorUpdater.next({ id: bundle.id });
    console.log('[OTA] Update', version, 'downloaded; applies on next launch');
  } catch (e) {
    console.warn('[OTA] update check failed', e);
  }
}
