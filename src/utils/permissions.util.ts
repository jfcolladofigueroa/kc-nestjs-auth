import {
  KC_DEFAULT_PERMISSION_VERBS,
  KcPermissionVerbs,
  KcProfilePermission,
} from '../config/auth.config';

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

/**
 * Flattens a profile's permission matrix into the `resource:verb` strings that
 * `@Permissions()` and `KcRolesGuard` already consume. A row with every flag
 * false contributes nothing.
 */
export function permissionsFromMatrix(
  matrix: Pick<KcProfilePermission, 'resource' | 'canCreate' | 'canUpdate' | 'canRead' | 'canDelete'>[],
  verbs: KcPermissionVerbs = KC_DEFAULT_PERMISSION_VERBS,
): string[] {
  const out: string[] = [];
  for (const row of matrix ?? []) {
    const resource = row?.resource?.trim();
    if (!resource) continue;
    if (row.canCreate) out.push(`${resource}:${verbs.create}`);
    if (row.canUpdate) out.push(`${resource}:${verbs.update}`);
    if (row.canRead) out.push(`${resource}:${verbs.read}`);
    if (row.canDelete) out.push(`${resource}:${verbs.delete}`);
  }
  return out;
}

/**
 * Effective permissions = profile permissions ∪ the user's own permissions.
 *
 * Union, not replacement: the profile is the baseline and a user may carry
 * extras. With no profile permissions the result is exactly `parsePermissions`,
 * which is why the change is backwards compatible.
 */
export function resolveEffectivePermissions(
  user: { permissions?: unknown },
  profilePermissions: string[] = [],
  verbs?: KcPermissionVerbs,
): string[] {
  void verbs; // profilePermissions arrive already flattened
  const own = parsePermissions(user);
  const seen = new Set<string>();
  const out: string[] = [];
  // Profile first, own extras after: stable, diff-friendly ordering.
  for (const p of [...profilePermissions, ...own]) {
    if (typeof p !== 'string') continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}
