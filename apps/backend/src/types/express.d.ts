import 'express';

declare module 'express' {
  interface Request {
    cookies?: Record<string, string>;
    user?: any;
  }
}
