import { AuthUser } from "./auth.types";

const API = process.env.NEXT_PUBLIC_API_URL;

function log(msg: string, extra?: any) {
    if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH] ${msg}`, extra ?? "");
    }
}

export async function fetchMe(): Promise<AuthUser | null> {
    const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
    });

    if (res.status === 401) {
        return null;
    }

    if (!res.ok) {
        return null;
    }

    return res.json();
}


async function refreshToken(): Promise<boolean> {
    try {
        const res = await fetch(`${API}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });

        log("Refresh response", res.status);
        return res.ok;
    } catch (err) {
        log("Refresh failed", err);
        return false;
    }
}

export function redirectToLogin(redirectTo: string) {
    log("Redirecting to login", redirectTo);

    window.location.href =
        `${API}/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export async function logout() {
    log("Logging out");

    await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });

    window.location.href = "/";
}
