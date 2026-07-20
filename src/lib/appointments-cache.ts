type CacheEntry = { value: unknown; expiresAt: number | null };

const values = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();
const versions = new Map<string, number>();
let generation = 0;

export function appointmentCacheKey(...parts: Array<string | number>) {
  return parts.join(":");
}

export function getAppointmentCache<T>(key: string): T | undefined {
  const entry = values.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    deleteAppointmentCache(key);
    return undefined;
  }
  return entry.value as T;
}

export function setAppointmentCache<T>(key: string, value: T, ttlMs?: number) {
  versions.set(key, (versions.get(key) ?? 0) + 1);
  pending.delete(key);
  values.set(key, {
    value,
    expiresAt: ttlMs ? Date.now() + ttlMs : null,
  });
}

export function deleteAppointmentCache(key: string) {
  values.delete(key);
  pending.delete(key);
  versions.set(key, (versions.get(key) ?? 0) + 1);
}

export function invalidateAppointmentCache(prefix: string) {
  for (const key of new Set([...values.keys(), ...pending.keys()])) {
    if (key.startsWith(prefix)) deleteAppointmentCache(key);
  }
}

export async function loadAppointmentCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const cached = getAppointmentCache<T>(key);
  if (cached !== undefined) return cached;

  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const requestGeneration = generation;
  const requestVersion = versions.get(key) ?? 0;
  const request = loader()
    .then(result => {
      if (
        generation === requestGeneration &&
        (versions.get(key) ?? 0) === requestVersion
      ) {
        values.set(key, {
          value: result,
          expiresAt: ttlMs ? Date.now() + ttlMs : null,
        });
        return result;
      }
      return getAppointmentCache<T>(key) ?? result;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });

  pending.set(key, request);
  return request;
}

export function clearAppointmentsCache() {
  generation += 1;
  values.clear();
  pending.clear();
  versions.clear();
}
