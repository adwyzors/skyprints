import { ForbiddenException } from '@nestjs/common';

interface LocationScopedUser {
  locationId?: string | null;
  permissions: string[];
}

/**
 * Resolves the locationId a query should actually be filtered by.
 * Callers with `locations:all:view` may pass an explicit filter (or none,
 * for unrestricted access); everyone else is pinned to their own assigned
 * location regardless of what they passed in.
 */
export function resolveLocationFilter(
  user: LocationScopedUser | undefined,
  requestedLocationId?: string,
): string | undefined {
  const permissions = user?.permissions ?? [];

  if (permissions.includes('locations:all:view')) {
    return requestedLocationId;
  }

  if (!user?.locationId) {
    throw new ForbiddenException('No location assigned to this account');
  }

  return user.locationId;
}
