/**
 * Permissions guarding the library's own profile administration endpoints.
 * Grant them to whoever should administer profiles in your app; role 'admin'
 * bypasses every permission check, as it always has.
 */
export const KC_PROFILE_READ_PERMISSION = 'auth.perfil:consultar';
export const KC_PROFILE_WRITE_PERMISSION = 'auth.perfil:alterar';
