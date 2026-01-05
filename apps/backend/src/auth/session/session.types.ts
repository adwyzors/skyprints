import { SessionUser } from "./session-user";

// auth/session/session.types.ts
export interface SessionData {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
