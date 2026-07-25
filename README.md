# @kc-software/nestjs-auth

Reusable NestJS authentication module: JWT access tokens, rotating refresh tokens, RBAC (roles + permissions), password recovery with one-time codes, optional multi-tenancy, and built-in rate limiting. Backed by TypeORM (PostgreSQL/MySQL/SQLite), with an escape hatch to plug in your own database adapter.

## Requirements

- NestJS 10 or 11.
- TypeORM 0.3.x and `@nestjs/typeorm` (required peer dependencies, even if you use a custom adapter).
- `@nestjs/event-emitter` (peer dependency; only needs `EventEmitterModule.forRoot()` if you want the `user.deleted` event).

## Installation

```bash
npm install @kc-software/nestjs-auth \
  @nestjs/jwt @nestjs/passport @nestjs/typeorm @nestjs/event-emitter \
  passport passport-jwt bcrypt class-validator class-transformer typeorm
```

## Quick start

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  KcAuthModule,
  KcUserEntity,
  KcRefreshTokenEntity,
  KcVerificationCodeEntity,
} from '@kc-software/nestjs-auth';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      // Register the library entities (plus your own):
      entities: [KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity],
      // Use migrations in production; synchronize only for local development.
    }),
    KcAuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET!, // forRoot throws if missing
      enableRegistration: false,          // admins create users by default
    }),
  ],
})
export class AppModule {}
```

Enable DTO validation in `main.ts` (the library ships class-validator DTOs):

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

## Configuration

All durations are strings with an explicit unit: `s`, `m`, `h` or `d` (e.g. `'15m'`, `'7d'`). Bare numbers like `'60'` are rejected at startup.

| Option | Default | Description |
| --- | --- | --- |
| `jwtSecret` | — (required) | Secret for signing access tokens. |
| `adapter` | `'typeorm'` | `'typeorm'` or `'custom'`. |
| `adapterProvider` | — | Custom `AuthDatabaseAdapter` (class or provider). Required with `adapter: 'custom'`. |
| `emailProvider` | — | `KcEmailService` implementation used to send recovery codes. Without it, codes are stored but not emailed. |
| `accessTokenExpiration` | `'15m'` | Access token lifetime. |
| `refreshTokenExpiration` | `'7d'` | Refresh token lifetime. |
| `bcryptRounds` | `10` | bcrypt cost factor. |
| `passwordMinLength` | `6` | Minimum password length (service-level check). |
| `enableRegistration` | `false` | Enables public `POST /auth/register`. |
| `enablePasswordRecovery` | `true` | Enables forgot/reset password endpoints (404 when disabled). |
| `verificationCodeExpiration` | `'1h'` | Recovery code lifetime. |
| `verificationCodeLength` | `6` | Recovery code digits. |
| `verificationCodeMaxAttempts` | `5` | Failed attempts before a code is invalidated. |
| `defaultRole` | `'user'` | Role assigned on registration. |
| `loginRateLimit` | `{ ttl: 60, limit: 5 }` | Sliding window (seconds, attempts) applied to login, forgot-password and reset-password, keyed by IP + route + email. |

## Endpoints

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public, rate limited | Returns `accessToken`, `refreshToken` and the user. |
| POST | `/auth/register` | public | 404-like rejection unless `enableRegistration`. |
| POST | `/auth/refresh` | public | Rotates the refresh token (the old one is revoked). |
| POST | `/auth/logout` | bearer | Revokes the given refresh token. |
| GET | `/auth/me` | bearer | Current user with role, tenant and permissions. |
| POST | `/auth/change-password` | bearer | Changes password and revokes all refresh tokens. |
| POST | `/auth/forgot-password` | public, rate limited | Issues a recovery code (never reveals whether the email exists). |
| POST | `/auth/reset-password` | public, rate limited | Resets the password with a valid one-time code. |
| GET | `/users` | admin | Lists users (tenant-scoped when a tenant scope is provided). |
| POST | `/users` | admin | Creates a user with role/permissions/tenant. |
| PUT | `/users/:id` | admin | Updates email, name, role, isActive, password, permissions. |
| DELETE | `/users/:id` | admin | Deletes a user (never yourself) and emits `kc-auth.user.deleted`. |

Routes are fixed at `/auth` and `/users`. To remount them, use Nest's standard mechanisms: `app.setGlobalPrefix('api')` or `RouterModule.register([{ path: 'v1', module: YourModule }])`.

## Guards and decorators

`KcJwtAuthGuard` and `KcRolesGuard` are exported for your own controllers:

```ts
import { KcJwtAuthGuard, KcRolesGuard, Roles, Permissions, Public } from '@kc-software/nestjs-auth';

@Controller('reports')
@UseGuards(KcJwtAuthGuard, KcRolesGuard)
export class ReportsController {
  @Get()           // any authenticated user
  list() {}

  @Roles('manager')            // 'admin' always passes any check
  @Get('managers')
  managers() {}

  @Permissions('reports:export')
  @Get('export')
  export() {}

  @Public()        // opt out of auth for a single route
  @Get('status')
  status() {}
}
```

`req.user` contains `{ id, email, role, tenantId, permissions }`.

## Sending recovery emails

Provide a `KcEmailService` implementation:

```ts
import { KC_EMAIL_SERVICE, KcEmailService } from '@kc-software/nestjs-auth';

@Injectable()
class MailerEmailService implements KcEmailService {
  async sendPasswordRecoveryEmail(email: string, code: string, userName?: string) {
    // send with your mailer of choice
  }
}

KcAuthModule.forRoot({
  jwtSecret: process.env.JWT_SECRET!,
  emailProvider: MailerEmailService, // or { provide: KC_EMAIL_SERVICE, useExisting: ... }
});
```

## Custom database adapter

Implement `AuthDatabaseAdapter` to use any storage (Mongo, Prisma, an external API...):

```ts
import { AuthDatabaseAdapter, KC_AUTH_ADAPTER } from '@kc-software/nestjs-auth';

class MyAdapter implements AuthDatabaseAdapter { /* ... */ }

KcAuthModule.forRoot({
  adapter: 'custom',
  adapterProvider: MyAdapter, // or { provide: KC_AUTH_ADAPTER, useFactory: ... }
  jwtSecret: process.env.JWT_SECRET!,
});
```

## Multi-tenancy (optional)

Provide the `KC_TENANT_SCOPE` token with a `KcTenantScope` implementation (e.g. reading the tenant from the request context). When present, `GET /users`, user creation and updates are scoped to the current tenant; superadmins bypass scoping. Login is intentionally not tenant-scoped, so emails must be unique across tenants.

## user.deleted event

If your app registers `EventEmitterModule.forRoot()`, deleting a user emits `kc-auth.user.deleted` (`KC_USER_DELETED_EVENT`) with `{ userId, email, name, role, tenantId }`. Use it for side effects; rely on `ON DELETE CASCADE` for referential integrity of your own tables.

## Migrating from 0.1.0

0.2.0 contains breaking changes:

1. **Table rename** — the users table is now `auth_users` (prefixed like the other library tables) to avoid colliding with your app's own `users` table:
   ```sql
   ALTER TABLE users RENAME TO auth_users;
   ALTER TABLE auth_verification_codes ADD COLUMN attempts INT NOT NULL DEFAULT 0;
   ```
   Run this before deploying; with `synchronize: true` TypeORM would otherwise create an empty `auth_users` instead of renaming.
2. **Durations require a unit** — `refreshTokenExpiration` was previously parsed as bare days and `verificationCodeExpiration` as bare minutes. Both now use the same `'7d'` / `'1h'` format and reject bare numbers at startup.
3. **Removed config options** — `tokenBlacklist`, `redisUrl`, `routePrefix` and `usersRoutePrefix` never had any effect and are gone.
4. **`adapter: 'mongoose'` removed** — it was never implemented. Use `adapter: 'custom'` with your own adapter instead.
5. **Custom adapters** — `findVerificationCode(email, code, type)` was replaced by `findLatestActiveCode(email, type)` plus `incrementCodeAttempts(id)`; `updateUser` may now return `null` when no row matches.
6. **Error messages are now in English** (they were Portuguese).

## Security notes

- Refresh tokens (random 40-byte values) and recovery codes are stored in plaintext in the database. If your threat model includes database leaks, hash them at rest.
- `POST /auth/register` returns 409 for duplicate emails, which reveals account existence when public registration is enabled. Forgot-password does not leak existence.
- The rate limiter is per process. Behind a load balancer with several instances, each instance enforces its own window; add an edge limiter (or `@nestjs/throttler` with a shared store) if you need a global guarantee.
- Access tokens stay valid until they expire (default 15 minutes) even after logout; that is inherent to stateless JWTs. Keep `accessTokenExpiration` short.

## Development

```bash
npm install
npm test        # e2e suites against an in-memory SQLite database
npm run build
```

## License

MIT
