import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/main.serverless';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const app = await createApp();
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
}
