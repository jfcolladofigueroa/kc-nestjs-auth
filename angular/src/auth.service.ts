import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthUser, LoginResponse, RefreshResponse, KcAuthAngularConfig, DEFAULT_CONFIG } from './auth.models';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'kc_access_token',
  REFRESH_TOKEN: 'kc_refresh_token',
  USER: 'kc_user',
};

@Injectable({ providedIn: 'root' })
export class KcAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private config: Required<KcAuthAngularConfig> = DEFAULT_CONFIG;

  private readonly _user = signal<AuthUser | null>(this.loadUser());
  private readonly _accessToken = signal<string | null>(this.loadToken());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());

  configure(config: KcAuthAngularConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const url = `${this.config.apiUrl}${this.config.loginPath}`;
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password })
    );

    this.setSession(response);
    this.router.navigate([this.config.dashboardRoute]);
    return response.user;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
      const url = `${this.config.apiUrl}${this.config.logoutPath}`;
      try {
        await firstValueFrom(this.http.post(url, { refreshToken }));
      } catch {
        // Ignore errors on logout
      }
    }
    this.clearSession();
    this.router.navigate([this.config.loginRoute]);
  }

  async refresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return false;

    try {
      const url = `${this.config.apiUrl}${this.config.refreshPath}`;
      const response = await firstValueFrom(
        this.http.post<RefreshResponse>(url, { refreshToken })
      );
      this.setSession(response);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const url = `${this.config.apiUrl}${this.config.loginPath.replace('/login', '/change-password')}`;
    await firstValueFrom(this.http.post(url, { currentPassword, newPassword }));
  }

  async forgotPassword(email: string): Promise<void> {
    const url = `${this.config.apiUrl}${this.config.loginPath.replace('/login', '/forgot-password')}`;
    await firstValueFrom(this.http.post(url, { email }));
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const url = `${this.config.apiUrl}${this.config.loginPath.replace('/login', '/reset-password')}`;
    await firstValueFrom(this.http.post(url, { email, code, newPassword }));
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  hasRole(role: string): boolean {
    return this._user()?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Whether the session holds a permission. 'admin' passes everything, mirroring
   * KcRolesGuard on the backend. This is for hiding UI, never for authorization:
   * the guard is the one that decides.
   */
  hasPermission(permission: string): boolean {
    const user = this._user();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions ?? []).includes(permission);
  }

  /** `hasPermission('material:consultar')` spelled as a resource plus a verb. */
  can(resource: string, verb: string): boolean {
    return this.hasPermission(`${resource}:${verb}`);
  }

  private setSession(response: LoginResponse | RefreshResponse) {
    this._accessToken.set(response.accessToken);
    this._user.set(response.user);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
  }

  private clearSession() {
    this._accessToken.set(null);
    this._user.set(null);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  private loadToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  }
}
