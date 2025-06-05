export const ENV = (k, def = '') => (typeof import.meta !== 'undefined' && import.meta.env?.[k] !== undefined
    ? import.meta.env[k]
    : (typeof process !== 'undefined' ? process.env[k] : def)) ?? def;
// If you don't have makeApiRequest, this is what it might look like.
// Otherwise, import your existing makeApiRequest.
async function makeApiRequest(url, opts = {}) {
    const response = await fetch(url, opts);
    if (!response.ok) {
        let errorBody = null;
        try {
            errorBody = await response.json();
        }
        catch (e) { /* ignore parsing error */ }
        const errorMessage = errorBody?.message || errorBody?.error || `HTTP error ${response.status}`;
        throw new Error(errorMessage); // Let safeJsonFetch handle this
    }
    return response.json();
}
export async function safeJsonFetch(url, opts = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            // console.log(`[safeJsonFetch] Attempt ${i+1} for ${url}`); // Optional: for debugging
            return await makeApiRequest(url, opts); // Or directly use fetch(url, opts).then(res => res.json()) if no makeApiRequest
        }
        catch (e) {
            // console.error(`[safeJsonFetch] Error on attempt ${i+1} for ${url}:`, e.message); // Optional
            if (i === retries || (e.message && /4\d\d/.test(e.message))) { // Check if error message contains 4xx status
                // console.error(`[safeJsonFetch] Final attempt failed or client error for ${url}. Rethrowing.`); // Optional
                throw e; // Rethrow client errors (4xx) or if retries exhausted
            }
            const delay = 250 * (2 ** i); // 250ms, 500ms, 1000ms
            // console.log(`[safeJsonFetch] Retrying in ${delay}ms...`); // Optional
            await new Promise(r => setTimeout(r, delay));
        }
    }
    // Should not be reached if makeApiRequest throws appropriately
    throw new Error('safeJsonFetch failed after all retries without throwing a more specific error.');
}
