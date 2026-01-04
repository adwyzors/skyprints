// src/auth/token.ts
import {jwtDecode} from "jwt-decode";

export interface AuthToken {
  sub: string;
  email: string;
  permissions: string[];
  exp: number;
}

export function decodeToken(token: string): AuthToken | null {
  try {
    return jwtDecode<AuthToken>(token);
  } catch {
    return null;
  }
}

export function isTokenExpired(exp: number) {
  return Date.now() >= exp * 1000;
}
