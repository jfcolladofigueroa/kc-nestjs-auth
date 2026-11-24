export interface AuthUser {
  id: number | string;
  email: string;
  name: string;
  role: string;
  /** Optional multi-tenancy. */
  tenantId?: number | null;
  /** Profile the permissions below were inherited from (null = flat permissions). */
  profileId?: number | string | null;
  /** Effective permissions: profile ∪ own, as `resource:verb` strings. */
  permissions?: string[];
  /** A forced password change is pending (backend `forcePasswordChangeOnFirstLogin`). */
  mustChangePassword?: boolean;
}

/** Verbs of the permission matrix, matching the backend defaults. */
export const PERMISSION_VERBS = {
  create: 'incluir',
  update: 'alterar',
  read: 'consultar',
  delete: 'excluir',
} as const;

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface KcAuthAngularConfig {
  apiUrl: string;
  loginPath?: string;       // default '/auth/login'
  refreshPath?: string;     // default '/auth/refresh'
  logoutPath?: string;      // default '/auth/logout'
  mePath?: string;          // default '/auth/me'
  usersPath?: string;       // default '/users'
  profilesPath?: string;    // default '/profiles'
  loginRoute?: string;      // default '/login'
  dashboardRoute?: string;  // default '/dashboard'
  /** Route of the screen where a user with a pending forced change sets its password. */
  changePasswordRoute?: string; // default '/change-password'
}

/** `code` of the backend 403 while a forced password change is pending. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

export const KC_AUTH_ANGULAR_CONFIG = 'KC_AUTH_ANGULAR_CONFIG';

export const DEFAULT_CONFIG: Required<KcAuthAngularConfig> = {
  apiUrl: '/api',
  loginPath: '/auth/login',
  refreshPath: '/auth/refresh',
  logoutPath: '/auth/logout',
  mePath: '/auth/me',
  usersPath: '/users',
  profilesPath: '/profiles',
  loginRoute: '/login',
  dashboardRoute: '/dashboard',
  changePasswordRoute: '/change-password',
};
