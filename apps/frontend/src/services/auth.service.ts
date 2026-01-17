// services/auth.service.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } finally {
        // Always redirect, even if backend fails
        window.location.href = '/';
    }
}
