/**
 * Domain events emitted by the library. The consuming app listens with
 * `@OnEvent(KC_USER_DELETED_EVENT)` and reacts as needed (cleaning up its own
 * tables, caches, auditing, notifying other services...).
 *
 * Emission is fire-and-forget: listeners are responsible for their own error
 * handling. For referential integrity of dependent data use `ON DELETE CASCADE`
 * on your application's FKs — the event is for side effects.
 *
 * Requires the app to register `EventEmitterModule.forRoot()` in its AppModule.
 */

/**
 * `DELETE /users/:id` succeeded. Emitted in both deletion modes, so listeners
 * written against 0.2.0 keep working; read `deletionMode` to tell them apart.
 *
 * Since 0.3.0 the default mode is `'deactivate'`: the row is NOT gone, the user
 * was deactivated. Do not delete data keyed by `userId` on this event unless
 * you run with `userDeletionMode: 'hard'`.
 */
export const KC_USER_DELETED_EVENT = 'kc-auth.user.deleted';

/** A user was deactivated (logical removal). Only in `'deactivate'` mode. */
export const KC_USER_DEACTIVATED_EVENT = 'kc-auth.user.deactivated';

export interface KcUserDeletedEvent {
  userId: number | string;
  email: string;
  name: string;
  role: string;
  tenantId?: number | null;
  /** 'deactivate' (default since 0.3.0) means the row still exists. */
  deletionMode?: 'deactivate' | 'hard';
}
