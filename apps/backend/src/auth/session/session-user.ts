// src/auth/session/session-user.ts
export interface SessionUser {
  id: string;
  email: string;
  permissions: string[];
}
