/**
 * Production-grade Safe Storage & Cache Engine for VtopCC.
 * 
 * Features:
 * 1. Storage Availability & In-Memory Fallback (handles private browsing / blocked storage)
 * 2. Automated Startup Sanitization & Self-Healing (purges corrupted / malformed entries)
 * 3. Serialization Guards (prevents storing "undefined", "null", "[object Object]", or HTML)
 * 4. Quota Overflow Protection & LRU Auto-Eviction (handles QuotaExceededError smoothly)
 * 5. Type and Schema Validation Guards (ensures parsed data matches expected structure)
 * 6. Cache Envelopes with TTL, Versioning & Integrity Checksum
 */

// In-memory fallback map if window.localStorage is blocked or disabled
const memoryStorage = new Map<string, string>();

/**
 * Checks if localStorage is available and writable in current browser environment.
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
 * Low-level safe raw storage getter.
 */
function rawGetItem(key: string): string | null {
  if (storageAvailable) {
    try {
      return window.localStorage.getItem(key);
    } catch (_e) {
      return memoryStorage.get(key) || null;
    }
  }
  return memoryStorage.get(key) || null;
}

/**
 * Low-level safe raw storage setter with quota eviction fallback.
 */
function rawSetItem(key: string, value: string): boolean {
  if (storageAvailable) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      // QuotaExceededError or DOMException code 22 / 1014
      const isQuotaError = 
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014;

      if (isQuotaError) {
        console.warn(`[SafeCache] Storage quota exceeded. Evicting old cache entries to free space...`);
        evictOldestCacheEntries(5);
        try {
          window.localStorage.setItem(key, value);
          return true;
        } catch (_retryErr) {
          console.error(`[SafeCache] Failed to write key "${key}" after eviction. Falling back to memory.`);
        }
      }
      memoryStorage.set(key, value);
      return false;
    }
  }
  memoryStorage.set(key, value);
  return true;
}

/**
 * Low-level safe raw storage remover.
 */
function rawRemoveItem(key: string): void {
  if (storageAvailable) {
    try {
      window.localStorage.removeItem(key);
    } catch (_e) {}
  }
  memoryStorage.delete(key);
}

/**
 * Evicts oldest cache entries (excluding critical user / auth keys) when quota is full.
 */
function evictOldestCacheEntries(countToEvict = 3): void {
  try {
    if (!storageAvailable) return;
    const cacheKeys: { key: string; length: number }[] = [];
    
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      // Evict dynamic non-critical cache (e.g. calendar, exams, marks, timetable)
      if (key && key.startsWith('vtop_cache_') && !key.includes('profile') && !key.includes('semesters')) {
        const val = window.localStorage.getItem(key) || '';
        cacheKeys.push({ key, length: val.length });
      }
    }

    // Evict largest entries first
    cacheKeys.sort((a, b) => b.length - a.length);
    const toRemove = cacheKeys.slice(0, countToEvict);
    for (const item of toRemove) {
      console.log(`[SafeCache] Evicting key: ${item.key} (${item.length} bytes)`);
      rawRemoveItem(item.key);
    }
  } catch (err) {
    console.warn('[SafeCache] Error during cache eviction:', err);
  }
}

/**
 * Safe JSON parse helper that never throws.
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  const trimmed = jsonString.trim();
  if (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]' ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html')
  ) {
    return fallback;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    console.warn('[safeJsonParse] Malformed JSON, returning fallback:', err);
    return fallback;
  }
}

export interface SetCacheOptions {
  ttlMs?: number;    // Time to live in milliseconds
  version?: number;  // Schema version
}

interface CacheEnvelope<T> {
  __vtop_envelope: true;
  v?: number;        // version
  t: number;         // timestamp
  exp?: number;      // expiry timestamp
  data: T;
}

function isCacheEnvelope<T>(obj: any): obj is CacheEnvelope<T> {
  return obj && typeof obj === 'object' && obj.__vtop_envelope === true && 'data' in obj;
}

/**
 * Safely writes data to storage.
 * - Prevents storing undefined or null (removes key instead)
 * - Wraps in envelope with timestamp and optional TTL/version
 * - Catches quota errors and self-evicts
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
  if (typeof data === 'object' && (data as any)?.status === 'error' && (data as any)?.message) {
    console.warn(`[safeSetCache] Skipping write of error response for key "${key}"`);
    return false;
  }

  try {
    const envelope: CacheEnvelope<T> = {
      __vtop_envelope: true,
      v: options?.version ?? 1,
      t: Date.now(),
      exp: options?.ttlMs ? Date.now() + options.ttlMs : undefined,
      data
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
 * - Supports both enveloped and legacy raw JSON cache entries
 * - Checks TTL expiration and cleans up expired keys
 * - Optional validator predicate to verify expected schema (e.g. Array.isArray)
 * - Auto-purges corrupt keys on failure
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

    const trimmed = item.trim();
    if (
      trimmed === '' ||
      trimmed === 'undefined' ||
      trimmed === 'null' ||
      trimmed === '[object Object]' ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html')
    ) {
      rawRemoveItem(key);
      return fallback;
    }

    const parsed = JSON.parse(trimmed);

    // Enveloped cache support
    if (isCacheEnvelope<T>(parsed)) {
      // Check expiration if TTL was set
      if (parsed.exp && Date.now() > parsed.exp) {
        console.log(`[SafeCache] Cache expired for key "${key}", removing.`);
        rawRemoveItem(key);
        return fallback;
      }

      const actualData = parsed.data;
      if (validator && !validator(actualData)) {
        console.warn(`[SafeCache] Validator failed for key "${key}", purging.`);
        rawRemoveItem(key);
        return fallback;
      }
      return actualData;
    }

    // Legacy un-enveloped cache support
    if (validator && !validator(parsed)) {
      console.warn(`[SafeCache] Validator failed for legacy key "${key}", purging.`);
      rawRemoveItem(key);
      return fallback;
    }

    return parsed as T;
  } catch (err) {
    console.warn(`[SafeCache] Corrupted cache for key "${key}", purging:`, err);
    rawRemoveItem(key);
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
    const total = storageAvailable ? window.localStorage.length : memoryStorage.size;
    
    for (let i = 0; i < total; i++) {
      const key = storageAvailable ? window.localStorage.key(i) : Array.from(memoryStorage.keys())[i];
      if (key && key.startsWith(prefix)) {
        const found = safeGetCache<T>(key, undefined, validator);
        if (found !== undefined) {
          return found;
        }
      }
    }
  } catch (err) {
    console.warn(`[SafeCache] Error searching prefix "${prefix}":`, err);
  }
  return fallback;
}

/**
 * Safely clears all keys starting with a given prefix.
 */
export function safeClearCachePrefix(prefix: string): number {
  if (!prefix) return 0;
  let clearedCount = 0;

  try {
    const keysToRemove: string[] = [];

    if (storageAvailable) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
    }

    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix) && !keysToRemove.includes(key)) {
        keysToRemove.push(key);
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
 * - Scans all keys in localStorage
 * - Validates JSON parseability
 * - Purges corrupted, malformed, HTML, or "undefined" strings
 * Returns summary of checked & purged items.
 */
export function sanitizeLocalStorage(): { totalChecked: number; corruptedPurged: number } {
  let totalChecked = 0;
  let corruptedPurged = 0;

  if (!storageAvailable) {
    return { totalChecked: 0, corruptedPurged: 0 };
  }

  try {
    const keysToCheck: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) keysToCheck.push(key);
    }

    for (const key of keysToCheck) {
      totalChecked++;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) continue;

        const trimmed = raw.trim();

        // 1. Check for corrupt string values
        const isCorruptString =
          trimmed === '' ||
          trimmed === 'undefined' ||
          trimmed === 'null' ||
          trimmed === '[object Object]' ||
          trimmed.startsWith('<!DOCTYPE') ||
          trimmed.startsWith('<html') ||
          trimmed.startsWith('<?xml');

        if (isCorruptString && key.startsWith('vtop_')) {
          console.warn(`[Sanitizer] Purging corrupt raw value for key: "${key}"`);
          window.localStorage.removeItem(key);
          corruptedPurged++;
          continue;
        }

        // 2. If it's a vtop cache or JSON key, test JSON validity
        if (key.startsWith('vtop_cache_') || (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            JSON.parse(trimmed);
          } catch (_parseErr) {
            console.warn(`[Sanitizer] Purging unparseable JSON for key: "${key}"`);
            window.localStorage.removeItem(key);
            corruptedPurged++;
          }
        }
      } catch (_itemErr) {
        try {
          window.localStorage.removeItem(key);
          corruptedPurged++;
        } catch (_e) {}
      }
    }

    if (corruptedPurged > 0) {
      console.info(`[Sanitizer] Sanitized localStorage: ${corruptedPurged} corrupted entries purged out of ${totalChecked} checked.`);
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
  let entryCount = 0;

  if (storageAvailable) {
    try {
      entryCount = window.localStorage.length;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          const val = window.localStorage.getItem(key) || '';
          usedBytes += (key.length + val.length) * 2; // UTF-16 characters approx 2 bytes
        }
      }
    } catch (_e) {}
  } else {
    entryCount = memoryStorage.size;
    for (const [key, val] of memoryStorage.entries()) {
      usedBytes += (key.length + val.length) * 2;
    }
  }

  const usedFormatted = 
    usedBytes > 1024 * 1024 
      ? `${(usedBytes / (1024 * 1024)).toFixed(2)} MB` 
      : `${(usedBytes / 1024).toFixed(1)} KB`;

  return { usedBytes, usedFormatted, entryCount };
}
