/**
 * Parses the permissions of a user record into a string array.
 * The TypeORM adapter stores permissions as a JSON string column; custom
 * adapters may return a plain array.
 */
export function parsePermissions(user: { permissions?: unknown }): string[] {
  const perms = user?.permissions;
  if (Array.isArray(perms)) return perms;
  if (typeof perms === 'string') {
    try {
      const parsed = JSON.parse(perms);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
