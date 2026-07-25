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
export const KC_USER_DELETED_EVENT = 'kc-auth.user.deleted';

export interface KcUserDeletedEvent {
  userId: number | string;
  email: string;
  name: string;
  role: string;
  tenantId?: number | null;
}
