// /scripts/api/adapters/cache.ts
const TTL = parseInt(ENV('VITE_CACHE_TTL', '30000'), 10); // 30 seconds default, configurable via env
const store = new Map();
export async function cached(key, fetcher) {
    const now = Date.now();
    const entry = store.get(key);
    if (entry && entry.expires > now) {
        // console.log(`[Cache] HIT for key: ${key}`);
        return entry.data;
    }
    // console.log(`[Cache] MISS for key: ${key}. Fetching...`);
    const data = await fetcher();
    store.set(key, { expires: now + TTL, data });
    // Optional: Clean up expired entries periodically or on size limit
    if (store.size > 1000) { // Example: Prune if cache grows too large
        for (const [k, v] of store.entries()) {
            if (v.expires <= now) {
                store.delete(k);
            }
        }
    }
    return data;
}
// Helper to access ENV variables, can also be imported from utils/http.ts if preferred
// Ensure ENV is defined in this scope or imported
const ENV = (k, def = '') => (typeof import.meta !== 'undefined' && import.meta.env?.[k] !== undefined
    ? import.meta.env[k]
    : (typeof process !== 'undefined' ? process.env[k] : def)) ?? def;
