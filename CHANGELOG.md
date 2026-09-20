# Changelog

## 0.3.0 - 2026-09-20

Backwards compatible for permissions: a user with `profileId = NULL` and flat
`permissions` resolves to exactly the same permission list as in 0.2.0, and
`KcRolesGuard` / `@Permissions()` are untouched. One behavioural change needs a
decision on upgrade — see *Changed* below.

### Added

- **Profiles and permission matrix.** `KcProfileEntity` (`auth_profiles`) and
  `KcProfilePermissionEntity` (`auth_profile_permissions`): a profile groups a
  grid of resources by the four verbs a Brazilian public-sector tender asks for
  (`incluir`, `alterar`, `consultar`, `excluir`). `KcUserEntity` gains a
  nullable `profileId`.
- **Effective permissions** = profile permissions ∪ the user's own. Resolved
  once, when the access token is issued, and carried inside the JWT — the guard
  still does no I/O. `resolveEffectivePermissions()` and
  `permissionsFromMatrix()` are exported.
- **Profile administration endpoints** under `/profiles`, guarded by
  `auth.perfil:consultar` / `auth.perfil:alterar` (role `admin` bypasses both):
  list, read, create, update, logical removal, and read/write of the full
  matrix.
- **Migrations shipped by the library** (`kcAuthMigrations`). The baseline one
  creates `auth_users`, `auth_refresh_tokens` and `auth_verification_codes` and
  is a no-op where they already exist; the 0.3.0 one is strictly additive.
  Their timestamps are deliberately low so TypeORM runs them before an
  application's own migrations.
- `kcAuthEntities` — every entity the library owns, for the host's `entities`
  array.
- `KcPermissionsService` with a per-profile cache (`profileCacheTtl`, default
  300 s), invalidated on every write through the library's endpoints.
- `revokeTokensOnProfileChange` (default `false`): revokes the refresh tokens
  of the affected users when a profile or an assignment changes.
- `permissionVerbs` to override the four verbs used to flatten a matrix.
- `KC_USER_DEACTIVATED_EVENT`, and a `deletionMode` field on the payload of
  `KC_USER_DELETED_EVENT`.
- `profileId` in the JWT payload, in `req.user`, and in the `/auth/login`,
  `/auth/refresh` and `/auth/me` responses. `GET /users` and `PUT /users/:id`
  also return `effectivePermissions`.

### Changed

- **`DELETE /users/:id` now deactivates instead of deleting.** The row stays,
  `isActive` becomes false and the user's refresh tokens are revoked, which is
  what makes the documented guarantee true: user ids are stable and never
  reused, so business ledgers can reference `auth_users.id` for a decade.
  `KC_USER_DELETED_EVENT` still fires, now carrying
  `deletionMode: 'deactivate'`. **If a listener in your app deletes rows keyed
  by that `userId`, review it before upgrading.** Set
  `userDeletionMode: 'hard'` to restore the previous behaviour.
- `AuthDatabaseAdapter` gained the profile methods, all **optional**: an
  adapter written against 0.2.0 keeps compiling. Without them, permissions stay
  flat and `/profiles` answers 501.
- Distribution: published on npm as a public package instead of being copied
  into each project with `file:`.

## 0.2.0 - 2026-07-13

### Breaking changes

- Users table renamed from `users` to `auth_users`. Migration:
  `ALTER TABLE users RENAME TO auth_users;`
- All duration options (`accessTokenExpiration`, `refreshTokenExpiration`,
  `verificationCodeExpiration`) now require a unit (`s`/`m`/`h`/`d`) and are
  validated at startup. Previously `refreshTokenExpiration` was silently parsed
  as days and `verificationCodeExpiration` as minutes.
- Removed config options that never had any effect: `tokenBlacklist`,
  `redisUrl`, `routePrefix`, `usersRoutePrefix`. Removed the unused
  `TokenBlacklistService`.
- Removed the unimplemented `adapter: 'mongoose'` option. `typeorm` and
  `@nestjs/typeorm` are now regular (required) peer dependencies.
- `AuthDatabaseAdapter`: `findVerificationCode(email, code, type)` replaced by
  `findLatestActiveCode(email, type)` + `incrementCodeAttempts(id)`;
  `updateUser` now returns `KcAuthUser | null`.
- User-facing error messages translated from Portuguese to English.

### Added

- `adapter: 'custom'` + `adapterProvider` to plug in any `AuthDatabaseAdapter`
  implementation (Mongo, Prisma, external APIs...).
- `emailProvider` option to wire a `KcEmailService`; previously there was no way
  to register one, so recovery emails were never sent.
- In-memory rate limiting (`KcRateLimitGuard`, exported) on login,
  forgot-password and reset-password, driven by the `loginRateLimit` option
  (default 5 attempts / 60 s per IP + route + email).
- Recovery codes are invalidated after `verificationCodeMaxAttempts` failed
  attempts (default 5) and compared in constant time.
- `enablePasswordRecovery: false` now actually disables the recovery endpoints.
- `forRoot()` fails fast with clear errors on missing `jwtSecret`, malformed
  durations, or `adapter: 'custom'` without `adapterProvider`.
- Jest e2e test suites (39 tests) running against in-memory SQLite.

### Fixed

- Updating a user's email to one already taken returns 409 instead of a raw
  database error (500).
- `deleteUser` now removes tokens, codes and the user in a single transaction.
- Tenant-scoped `updateUser` misses surface as 404 instead of silently
  returning null.
- Entity date columns no longer hardcode `type: 'timestamp'` (Postgres/MySQL
  only); TypeORM now picks the driver-appropriate type, so SQLite works too.

## 0.1.0

- Initial release.
