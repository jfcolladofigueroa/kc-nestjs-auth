# Changelog

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
