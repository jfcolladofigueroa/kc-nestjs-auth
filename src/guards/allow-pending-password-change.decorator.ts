import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'kcAllowPendingPasswordChange';

/**
 * Lets a user whose password change is still pending reach this route (or
 * every route of this controller). Without it, `KcJwtAuthGuard` answers
 * `403 PASSWORD_CHANGE_REQUIRED` while `mustChangePassword` is set. The
 * library applies it to `/auth/me`, `/auth/logout` and `/auth/change-password`.
 */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
