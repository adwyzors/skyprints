interface LocationScopedUser {
  locationId?: string | null;
  permissions: string[];
}

/**
 * Resolves the locationId a query should actually be filtered by.
 * Callers with `locations:all:view`, or with no location assigned at all,
 * may pass an explicit filter (or none, for unrestricted access); everyone
 * with an assigned location is pinned to it regardless of what they passed in.
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
    return requestedLocationId;
  }

  return user.locationId;
}
