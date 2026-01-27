/* =================================================
   API HELPER (Auth-aware)
   ================================================= */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Calls backend refresh endpoint using cookies
 */
async function refreshSession(): Promise<void> {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;

    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
    })
        .then(res => {
            if (!res.ok) {
                throw new Error('Refresh failed');
            }
        })
        .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
        });

    return refreshPromise;
}

/**
 * Propagates logout to backend and clears session
 */
export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } finally {
        // frontend state reset (router, store, etc.)
        if (typeof window !== 'undefined') {
            window.location.href = '/';
        }
    }
}

/**
 * Main API request helper
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
): Promise<T> {
    const start = Date.now();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    const duration = Date.now() - start;
    console.log(`[Frontend] ${options.method || 'GET'} ${endpoint} took ${duration}ms`);

    // 🔁 AUTO REFRESH ON 401
    if (response.status === 401 && retry) {
        try {
            await refreshSession();
            return apiRequest<T>(endpoint, options, false);
        } catch {
            await logout();
            throw new Error('Session expired');
        }
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
}

/**
 * API request helper that also returns response headers
 * Used for extracting pagination metadata from x-* headers
 */
export async function apiRequestWithHeaders<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
): Promise<{ data: T; headers: Headers }> {
    const start = Date.now();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    const duration = Date.now() - start;
    console.log(`[Frontend] ${options.method || 'GET'} ${endpoint} took ${duration}ms`);

    // 🔁 AUTO REFRESH ON 401
    if (response.status === 401 && retry) {
        try {
            await refreshSession();
            return apiRequestWithHeaders<T>(endpoint, options, false);
        } catch {
            await logout();
            throw new Error('Session expired');
        }
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error ${response.status}: ${text}`);
    }

    const data = await response.json() as T;
    return { data, headers: response.headers };
}
