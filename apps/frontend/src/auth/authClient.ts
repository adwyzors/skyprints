import { AuthUser } from "./auth.types";

const API = process.env.NEXT_PUBLIC_API_URL;

function log(msg: string, extra?: any) {
    if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH] ${msg}`, extra ?? "");
    }
}

export type FetchMeResult =
    | { status: "ok"; user: AuthUser }
    | { status: "unauthenticated" }
    | { status: "forbidden" }
    | { status: "error" };

export async function fetchMe(): Promise<FetchMeResult> {
    try {
        const res = await fetch(`${API}/auth/me`, {
            credentials: "include",
        });

        if (res.status === 401) {
            return { status: "unauthenticated" };
        }

        if (res.status === 403) {
            return { status: "forbidden" };
        }

        if (!res.ok) {
            return { status: "error" };
        }

        const user = await res.json();
        return { status: "ok", user };
    } catch {
        return { status: "error" };
    }
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
