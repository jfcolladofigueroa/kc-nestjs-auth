export interface AuthUser {
  id: number | string;
  email: string;
  name: string;
  role: string;
}

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
  loginRoute?: string;      // default '/login'
  dashboardRoute?: string;  // default '/dashboard'
}

export const KC_AUTH_ANGULAR_CONFIG = 'KC_AUTH_ANGULAR_CONFIG';

export const DEFAULT_CONFIG: Required<KcAuthAngularConfig> = {
  apiUrl: '/api',
  loginPath: '/auth/login',
  refreshPath: '/auth/refresh',
  logoutPath: '/auth/logout',
  mePath: '/auth/me',
  usersPath: '/users',
  loginRoute: '/login',
  dashboardRoute: '/dashboard',
};
