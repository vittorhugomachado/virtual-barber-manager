export type SettingsCacheResource =
  | "alerts"
  | "security-email"
  | "address"
  | "opening-hours"
  | "gallery"
  | "members";

const cachedValues = new Map<string, unknown>();
const pendingRequests = new Map<string, Promise<unknown>>();
const keyVersions = new Map<string, number>();
let cacheGeneration = 0;

export function settingsCacheKey(
  barbershopId: string,
  resource: SettingsCacheResource,
) {
  return `${barbershopId}:${resource}`;
}

export function hasSettingsCache(key: string) {
  return cachedValues.has(key);
}

export function getSettingsCache<T>(key: string): T | undefined {
  return cachedValues.get(key) as T | undefined;
}

export function setSettingsCache<T>(key: string, value: T) {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
  pendingRequests.delete(key);
  cachedValues.set(key, value);
}

export function deleteSettingsCache(key: string) {
  cachedValues.delete(key);
  pendingRequests.delete(key);
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
}

export async function loadSettingsCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  if (cachedValues.has(key)) {
    return cachedValues.get(key) as T;
  }

  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;

  const requestGeneration = cacheGeneration;
  const requestKeyVersion = keyVersions.get(key) ?? 0;
  const request = loader()
    .then(value => {
      if (
        cacheGeneration === requestGeneration &&
        (keyVersions.get(key) ?? 0) === requestKeyVersion
      ) {
        cachedValues.set(key, value);
        return value;
      }

      return cachedValues.has(key) ? (cachedValues.get(key) as T) : value;
    })
    .finally(() => {
      if (pendingRequests.get(key) === request) {
        pendingRequests.delete(key);
      }
    });

  pendingRequests.set(key, request);
  return request;
}

export function clearSettingsCache() {
  cacheGeneration += 1;
  cachedValues.clear();
  pendingRequests.clear();
  keyVersions.clear();
}
