import { PrismaClient } from '@prisma/client';

// Single PrismaClient for all integration tests.
// DATABASE_URL must point to the test DB (set via dotenv -e .env.test).
let _client: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({ log: ['error'] });
  }
  return _client;
}

export async function disconnectTestPrisma(): Promise<void> {
  await _client?.$disconnect();
  _client = undefined;
}
