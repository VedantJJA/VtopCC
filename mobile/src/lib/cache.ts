/**
 * Production-grade Safe Storage & Cache Engine for VtopCC Mobile.
 * 
 * Powered by a Native Hybrid Two-Tier Storage Engine:
 * 1. Tier 1 (Ultra-Fast RAM): Synchronous In-Memory Map for instant 0ms React initial renders.
 * 2. Tier 2 (Native Android Storage): @capacitor/preferences backed by native Android SharedPreferences
 *    (/data/data/com.vtopcc.app/shared_prefs/CapacitorStorage.xml).
 *    - Completely independent of Android WebView / Chromium LevelDB.
 *    - Immune to WebView 5MB quota errors, crashes, and OS storage resets.
 * 3. Automatic Startup Hydration: Pre-loads all native keys into RAM before React mounts.
 * 4. Automatic Seamless Migration: Migrates existing localStorage items to native Preferences on first launch.
 * 5. Defensive Schema Normalization: Guarantees arrays vs objects for attendance, timetables, marks, profile, etc.
 * 6. Isolated Profile Photo caching: Prevents memory & disk bloat for high-res photo strings.
 */

import { Preferences } from '@capacitor/preferences';

// In-memory high-speed cache for synchronous React reads
const memoryStorage = new Map<string, string>();
let isStorageEngineInitialized = false;

/**
 * Checks if window.localStorage is available in the current environment.
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__vtop_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (_e) {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

/**
 * Helper to identify corrupted, empty, HTML error, or undefined strings.
 */
export function isCorruptedString(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  return (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]' ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml')
  );
}

/**
 * Initializes the Native Storage Engine:
 * 1. Reads all stored keys from Native Capacitor Preferences (Android SharedPreferences).
 * 2. Populates the synchronous in-memory store so React hooks can read them synchronously.
 * 3. Migrates any existing keys from localStorage into Native Preferences.
 */
export async function initStorageEngine(): Promise<{ totalLoaded: number; migrated: number }> {
  let totalLoaded = 0;
  let migrated = 0;

  try {
    // Step 1: Read all keys from native Capacitor Preferences
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null && !isCorruptedString(value)) {
          memoryStorage.set(key, value);
          totalLoaded++;
        }
      } catch (_e) {}
    }

    // Step 2: Auto-migrate any existing data from localStorage to Native Preferences
    if (storageAvailable) {
      try {
        const localKeys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) localKeys.push(k);
        }

        for (const key of localKeys) {
          const localVal = window.localStorage.getItem(key);
          if (localVal && !isCorruptedString(localVal)) {
            if (!memoryStorage.has(key)) {
              memoryStorage.set(key, localVal);
              Preferences.set({ key, value: localVal }).catch(() => {});
              migrated++;
              totalLoaded++;
            }
          } else if (localVal && isCorruptedString(localVal) && key.startsWith('vtop_')) {
            try {
              window.localStorage.removeItem(key);
            } catch (_e) {}
          }
        }
      } catch (lsErr) {
        console.warn('[StorageEngine] Error migrating from localStorage:', lsErr);
      }
    }

    isStorageEngineInitialized = true;
    console.info(`[StorageEngine] Native storage engine initialized: ${totalLoaded} entries hydrated into RAM (${migrated} migrated).`);
  } catch (err) {
    console.warn('[StorageEngine] Error initializing native storage, using RAM/localStorage fallback:', err);
  }

  return { totalLoaded, migrated };
}

/**
 * Low-level safe raw storage getter.
 * Synchronous: checks RAM map first, then localStorage fallback.
 */
function rawGetItem(key: string): string | null {
  // Tier 1: Instant RAM lookup (0ms)
  if (memoryStorage.has(key)) {
    return memoryStorage.get(key) || null;
  }

  // Fallback: Check localStorage if not yet cached in RAM
  if (storageAvailable) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null && !isCorruptedString(val)) {
        memoryStorage.set(key, val);
        return val;
      }
    } catch (_e) {}
  }

  return null;
}

/**
 * Low-level safe raw storage setter.
 * Writes synchronously to RAM, and asynchronously persists to Native Preferences + localStorage.
 */
function rawSetItem(key: string, value: string): boolean {
  if (isCorruptedString(value)) {
    rawRemoveItem(key);
    return false;
  }

  // 1. Synchronous RAM store for instant access
  memoryStorage.set(key, value);

  // 2. Persistent Native Capacitor Preferences (Android SharedPreferences)
  Preferences.set({ key, value }).catch((err) => {
    console.warn(`[StorageEngine] Preferences.set failed for "${key}":`, err);
  });

  // 3. Mirror to localStorage (wrapped in try/catch to absorb WebView quota errors)
  if (storageAvailable) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_quotaErr) {
      // WebView quota exceeded: Native Preferences is our source of truth, so we safely ignore this.
    }
  }

  return true;
}

/**
 * Low-level safe raw storage remover.
 * Cleans from RAM, Native Preferences, and localStorage.
 */
function rawRemoveItem(key: string): void {
  memoryStorage.delete(key);

  Preferences.remove({ key }).catch((err) => {
    console.warn(`[StorageEngine] Preferences.remove failed for "${key}":`, err);
  });

  if (storageAvailable) {
    try {
      window.localStorage.removeItem(key);
    } catch (_e) {}
  }
}

/**
 * Safely reads a raw string from storage with fallback. Never throws.
 */
export function safeStorageGet(key: string, fallback = ''): string {
  try {
    const val = rawGetItem(key);
    return val !== null ? val : fallback;
  } catch (_e) {
    return fallback;
  }
}

/**
 * Safely writes a raw string to storage. Never throws.
 */
export function safeStorageSet(key: string, value: string): boolean {
  try {
    return rawSetItem(key, value);
  } catch (_e) {
    return false;
  }
}

/**
 * Safely removes a raw key from storage. Never throws.
 */
export function safeStorageRemove(key: string): void {
  try {
    rawRemoveItem(key);
  } catch (_e) {}
}

/**
 * Safe JSON parse helper that never throws.
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  if (isCorruptedString(jsonString)) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString.trim()) as T;
  } catch (err) {
    console.warn('[safeJsonParse] Malformed JSON, returning fallback:', err);
    return fallback;
  }
}

export interface SetCacheOptions {
  ttlMs?: number;    // Time to live in milliseconds
  version?: number;  // Schema version
}

export interface CacheEnvelope<T> {
  __vtop_envelope: true;
  v?: number;        // version
  t: number;         // timestamp
  exp?: number;      // expiry timestamp
  data: T;
}

export function isCacheEnvelope<T>(obj: any): obj is CacheEnvelope<T> {
  return obj && typeof obj === 'object' && obj.__vtop_envelope === true && 'data' in obj;
}

/**
 * Central Data Normalizer: Ensures that data read or written to cache strictly conforms
 * to the structural expectations of React components (guarantees arrays vs objects, default props).
 */
export function normalizeCachedData<T = any>(key: string, raw: any): T {
  if (raw === null || raw === undefined) return raw;

  // 1. Unwrap envelope if present
  let payload: any = raw;
  if (typeof payload === 'object' && payload.__vtop_envelope === true && 'data' in payload) {
    payload = payload.data;
  }
  // Double-envelope safety (if wrapped twice)
  if (typeof payload === 'object' && payload?.__vtop_envelope === true && 'data' in payload) {
    payload = payload.data;
  }

  // 2. Unwrap standard API wrappers ({ status: 'success', raw_data: ... }, semesters, directory)
  if (payload && typeof payload === 'object') {
    if ('raw_data' in payload && payload.raw_data !== undefined && payload.raw_data !== null) {
      payload = payload.raw_data;
    } else if (key.includes('semesters') && 'semesters' in payload && Array.isArray(payload.semesters)) {
      payload = payload.semesters;
    } else if (key.includes('faculty_directory') && 'directory' in payload && typeof payload.directory === 'object') {
      payload = payload.directory;
    }
  }

  // 3. Schema validation and normalization based on key type
  if (key.startsWith('vtop_cache_semesters')) {
    return (Array.isArray(payload) ? payload : []) as unknown as T;
  }
  if (key.startsWith('vtop_cache_attendance_')) {
    return (Array.isArray(payload) ? payload : []) as unknown as T;
  }
  if (key.startsWith('vtop_cache_exams_')) {
    return (Array.isArray(payload) ? payload : []) as unknown as T;
  }
  if (key.startsWith('vtop_cache_timetable_')) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return {
        ...payload,
        timetable: (payload.timetable && typeof payload.timetable === 'object') ? payload.timetable : {},
        courses: Array.isArray(payload.courses) ? payload.courses : []
      } as unknown as T;
    }
    if (Array.isArray(payload)) {
      return { timetable: {}, courses: payload } as unknown as T;
    }
    return { timetable: {}, courses: [] } as unknown as T;
  }
  if (key.startsWith('vtop_cache_marks_')) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return {
        ...payload,
        courses: Array.isArray(payload.courses) ? payload.courses : [],
        combined_scores: Array.isArray(payload.combined_scores) ? payload.combined_scores : []
      } as unknown as T;
    }
    return { courses: [], combined_scores: [] } as unknown as T;
  }
  if (key.startsWith('vtop_cache_grades_')) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return {
        ...payload,
        grades: Array.isArray(payload.grades) ? payload.grades : [],
        cgpa: payload.cgpa || ''
      } as unknown as T;
    }
    return { grades: [], cgpa: '' } as unknown as T;
  }
  if (key.startsWith('vtop_cache_profile')) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // Re-hydrate photo from dedicated photo cache if not in main payload
      if (!payload.personal?.photo_url) {
        const photo = safeStorageGet('vtop_cache_profile_photo', '');
        if (photo) {
          payload.personal = { ...(payload.personal || {}), photo_url: photo };
        }
      }
      return payload as unknown as T;
    }
    return {} as unknown as T;
  }

  return payload as T;
}

/**
 * Validates whether a data payload contains meaningful non-empty academic content.
 * Prevents empty arrays, blank timetables, and broken network objects from overwriting valid data.
 */
export function isMeaningfulData(key: string, data: any): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data === 'object' && ((data as any)?.status === 'error' || (data as any)?.status === 'unauthorized')) {
    return false;
  }

  let payload = data;
  if (typeof payload === 'object' && payload?.__vtop_envelope === true && 'data' in payload) {
    payload = payload.data;
  }
  if (payload && typeof payload === 'object' && 'raw_data' in payload && payload.raw_data !== undefined) {
    payload = payload.raw_data;
  }

  if (key.startsWith('vtop_cache_attendance_')) {
    return Array.isArray(payload) && payload.length > 0;
  }
  if (key.startsWith('vtop_cache_timetable_')) {
    if (Array.isArray(payload)) return payload.length > 0;
    if (typeof payload === 'object' && payload !== null) {
      const courses = payload.courses;
      const tt = payload.timetable;
      return (Array.isArray(courses) && courses.length > 0) || (tt && typeof tt === 'object' && Object.keys(tt).length > 0);
    }
    return false;
  }
  if (key.startsWith('vtop_cache_semesters')) {
    return Array.isArray(payload) && payload.length > 0;
  }
  if (key.startsWith('vtop_cache_marks_')) {
    if (typeof payload === 'object' && payload !== null) {
      const courses = payload.courses;
      const combined = payload.combined_scores;
      return (Array.isArray(courses) && courses.length > 0) || (Array.isArray(combined) && combined.length > 0);
    }
    return false;
  }
  if (key.startsWith('vtop_cache_grades_')) {
    if (typeof payload === 'object' && payload !== null) {
      const grades = payload.grades;
      return (Array.isArray(grades) && grades.length > 0) || !!payload.cgpa;
    }
    return false;
  }
  if (key.startsWith('vtop_cache_exams_')) {
    return Array.isArray(payload) && payload.length > 0;
  }
  if (key.startsWith('vtop_cache_profile')) {
    return typeof payload === 'object' && payload !== null && (!!payload.personal || !!payload.academic || !!payload.name || !!payload.reg_no);
  }

  return true;
}

/**
 * Safely writes data to storage.
 * - Prevents storing undefined or null (removes key instead)
 * - Anti-Wipe Guard: Prevents empty responses from overwriting existing valid caches
 * - Wraps in envelope with timestamp and schema version 2
 * - Isolates large base64 profile pictures to keep primary payloads light
 */
export function safeSetCache<T>(key: string, data: T, options?: SetCacheOptions): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  if (data === undefined || data === null) {
    rawRemoveItem(key);
    return true;
  }

  // Prevent storing error responses
  if (typeof data === 'object' && ((data as any)?.status === 'error' || (data as any)?.status === 'unauthorized')) {
    console.warn(`[safeSetCache] Skipping write of error response for key "${key}"`);
    return false;
  }

  // Anti-Wipe Protection: If incoming payload is empty, never overwrite existing populated data
  if (key.startsWith('vtop_cache_') && !isMeaningfulData(key, data)) {
    const existing = safeGetCache(key);
    if (existing !== undefined && isMeaningfulData(key, existing)) {
      console.warn(`[SafeCache] Guard: Blocked empty data overwrite for "${key}". Existing cache preserved.`);
      return true;
    }
  }

  try {
    const cleanData = normalizeCachedData<T>(key, data);

    // If profile contains a large base64 photo, isolate it to keep main payload fast
    if (key === 'vtop_cache_profile' && cleanData && typeof cleanData === 'object') {
      const pData: any = cleanData;
      if (pData.personal?.photo_url && pData.personal.photo_url.length > 50000) {
        try {
          rawSetItem('vtop_cache_profile_photo', pData.personal.photo_url);
        } catch (_photoErr) {}
      }
    }

    const envelope: CacheEnvelope<T> = {
      __vtop_envelope: true,
      v: options?.version ?? 2,
      t: Date.now(),
      exp: options?.ttlMs ? Date.now() + options.ttlMs : undefined,
      data: cleanData
    };

    const serialized = JSON.stringify(envelope);
    if (!serialized || serialized === 'undefined') {
      rawRemoveItem(key);
      return false;
    }

    return rawSetItem(key, serialized);
  } catch (err) {
    console.warn(`[safeSetCache] Serialization failed for key "${key}":`, err);
    return false;
  }
}

/**
 * Safely reads and validates data from storage.
 * - Supports enveloped (v1 & v2) and legacy raw JSON cache entries
 * - Checks TTL expiration and cleans up expired keys
 * - Normalizes data so arrays and objects are guaranteed
 * - Optional validator predicate to verify expected schema
 */
export function safeGetCache<T>(
  key: string,
  fallback?: T,
  validator?: (data: unknown) => data is T
): T | undefined {
  if (!key || typeof key !== 'string') {
    return fallback;
  }

  try {
    const item = rawGetItem(key);
    if (!item) {
      return fallback;
    }

    if (isCorruptedString(item)) {
      rawRemoveItem(key);
      return fallback;
    }

    const parsed = JSON.parse(item.trim());

    // Check expiration if TTL was set on envelope
    if (isCacheEnvelope<T>(parsed) && parsed.exp && Date.now() > parsed.exp) {
      console.log(`[SafeCache] Cache expired for key "${key}", removing.`);
      rawRemoveItem(key);
      return fallback;
    }

    const payload = normalizeCachedData<T>(key, parsed);

    if (validator && !validator(payload)) {
      console.warn(`[SafeCache] Validator check failed for key "${key}", returning fallback.`);
      return fallback;
    }

    return payload;
  } catch (err) {
    console.warn(`[SafeCache] Parse error for key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely removes a specific key from storage.
 */
export function safeRemoveCache(key: string): void {
  rawRemoveItem(key);
}

/**
 * Scans storage for the first valid key matching a prefix.
 */
export function safeFindCachePrefix<T>(
  prefix: string,
  fallback?: T,
  validator?: (data: unknown) => data is T
): T | undefined {
  if (!prefix) return fallback;

  try {
    const keys: string[] = [];
    for (const k of memoryStorage.keys()) {
      if (k.startsWith(prefix)) keys.push(k);
    }

    if (storageAvailable) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix) && !keys.includes(k)) {
          keys.push(k);
        }
      }
    }

    for (const key of keys) {
      const found = safeGetCache<T>(key, undefined, validator);
      if (found !== undefined) {
        return found;
      }
    }
  } catch (err) {
    console.warn(`[SafeCache] Error searching prefix "${prefix}":`, err);
  }
  return fallback;
}

/**
 * Safely clears all keys starting with a given prefix across RAM, Preferences, and localStorage.
 */
export function safeClearCachePrefix(prefix: string): number {
  if (!prefix) return 0;
  let clearedCount = 0;

  try {
    const keysToRemove: string[] = [];

    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    if (storageAvailable) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix) && !keysToRemove.includes(key)) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of keysToRemove) {
      rawRemoveItem(key);
      clearedCount++;
    }
  } catch (err) {
    console.warn(`[SafeCache] Error clearing prefix "${prefix}":`, err);
  }

  return clearedCount;
}

/**
 * Automated Startup Sanitizer & Health Check.
 * Runs on app initialization:
 * - Scans RAM and localStorage keys
 * - Purges corrupted, HTML, or undefined strings
 * Returns summary of checked & purged items.
 */
export function sanitizeLocalStorage(): { totalChecked: number; corruptedPurged: number } {
  let totalChecked = 0;
  let corruptedPurged = 0;

  try {
    const keysToCheck = new Set<string>();
    for (const k of memoryStorage.keys()) keysToCheck.add(k);

    if (storageAvailable) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keysToCheck.add(k);
      }
    }

    for (const key of keysToCheck) {
      totalChecked++;
      const raw = rawGetItem(key);
      if (raw === null) continue;

      if (isCorruptedString(raw)) {
        if (key.startsWith('vtop_')) {
          console.warn(`[Sanitizer] Purging corrupt raw value for key: "${key}"`);
          rawRemoveItem(key);
          corruptedPurged++;
        }
        continue;
      }

      // If it's a vtop cache or JSON key, test JSON validity
      if (key.startsWith('vtop_cache_') || (raw.startsWith('{') || raw.startsWith('['))) {
        try {
          JSON.parse(raw);
        } catch (_parseErr) {
          console.warn(`[Sanitizer] Purging unparseable JSON for key: "${key}"`);
          rawRemoveItem(key);
          corruptedPurged++;
        }
      }
    }

    if (corruptedPurged > 0) {
      console.info(`[Sanitizer] Sanitized storage: ${corruptedPurged} corrupted entries purged out of ${totalChecked} checked.`);
    }
  } catch (err) {
    console.warn('[Sanitizer] Error during startup sanitization:', err);
  }

  return { totalChecked, corruptedPurged };
}

/**
 * Returns current estimated storage usage metrics.
 */
export function getStorageUsage(): { usedBytes: number; usedFormatted: string; entryCount: number } {
  let usedBytes = 0;
  const entryCount = memoryStorage.size;

  for (const [key, val] of memoryStorage.entries()) {
    usedBytes += (key.length + val.length) * 2; // Approx UTF-16 character byte size
  }

  const usedFormatted = 
    usedBytes > 1024 * 1024 
      ? `${(usedBytes / (1024 * 1024)).toFixed(2)} MB` 
      : `${(usedBytes / 1024).toFixed(1)} KB`;

  return { usedBytes, usedFormatted, entryCount };
}

/**
 * Accurately finds the cached calendar for a specific month and year without prefix collisions.
 */
export function safeGetCalendarCacheForMonth(month: number, year: number, semesterId?: string): any {
  if (semesterId) {
    const specific = safeGetCache<any>(`vtop_cache_calendar_${semesterId}_${month}_${year}`);
    if (specific && specific.days && Array.isArray(specific.days)) return specific;
  }
  const latest = safeGetCache<any>(`vtop_cache_calendar_latest_${month}_${year}`);
  if (latest && latest.days && Array.isArray(latest.days)) return latest;

  const targetSuffix = `_${month}_${year}`;
  const keys: string[] = [];

  for (const k of memoryStorage.keys()) {
    if (k.startsWith('vtop_cache_calendar_') && k.endsWith(targetSuffix)) {
      keys.push(k);
    }
  }

  if (storageAvailable) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('vtop_cache_calendar_') && k.endsWith(targetSuffix) && !keys.includes(k)) {
        keys.push(k);
      }
    }
  }

  for (const k of keys) {
    const found = safeGetCache<any>(k);
    if (found && found.days && Array.isArray(found.days)) return found;
  }

  return undefined;
}
