// userStorage.ts — Strict user-scoped storage isolation for BudgetMitra
// Prevents demo data leakage, cross-user cache contamination, and unauthorized session bleed.

export function getUserScope(userEmailOrId: string | null | undefined, isGuest = false): string {
  if (isGuest) return "guest";
  if (!userEmailOrId || !userEmailOrId.trim()) return "anonymous";
  return userEmailOrId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_@.-]/g, "_");
}

export function getScopedKey(scope: string, key: string): string {
  return `bm:${scope}:${key}`;
}

export function loadUserSlice<T>(scope: string, key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(getScopedKey(scope, key));
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[UserStorage] Failed to parse key ${key} for scope ${scope}:`, err);
    return fallback;
  }
}

export function saveUserSlice<T>(scope: string, key: string, value: T): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(getScopedKey(scope, key), JSON.stringify(value));
  } catch (err) {
    console.error(`[UserStorage] Failed to save key ${key} for scope ${scope}:`, err);
  }
}

export function removeUserSlice(scope: string, key: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(getScopedKey(scope, key));
  } catch {
    /* ignore */
  }
}

export function clearUserScope(scope: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const prefix = `bm:${scope}:`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error(`[UserStorage] Failed to clear scope ${scope}:`, err);
  }
}

export function clearLegacyDemoStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const legacyKeys = [
    "bm_profile",
    "bm_budgets",
    "bm_transactions",
    "bm_goals",
    "bm_loans",
    "bm_xp",
    "bm_level",
    "bm_streak",
    "bm_badges",
    "bm_logging_history",
  ];
  legacyKeys.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}
