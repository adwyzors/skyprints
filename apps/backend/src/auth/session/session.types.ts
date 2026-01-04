// auth/session/session.types.ts
export interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
