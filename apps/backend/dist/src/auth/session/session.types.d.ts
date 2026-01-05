import { SessionUser } from "./session-user";
export interface SessionData {
    user: SessionUser;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}
