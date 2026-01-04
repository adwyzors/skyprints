// src/auth/authClient.ts
export interface AuthUser {
  id: string;
  email: string;
  permissions: string[];
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
      {
        credentials: "include", // 🔥 required for cookies
      }
    );

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function redirectToLogin(redirectTo: string) {
  const loginUrl =
    `${process.env.NEXT_PUBLIC_API_URL}/auth/login` +
    `?redirectTo=${encodeURIComponent(redirectTo)}`;

  window.location.href = loginUrl;
}

export async function logout() {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  window.location.href = "/login";
}
