import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KcAuthService } from './auth.service';

export const kcAuthGuard: CanActivateFn = () => {
  const auth = inject(KcAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  router.navigate(['/login']);
  return false;
};

export const kcAdminGuard: CanActivateFn = () => {
  const auth = inject(KcAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isAdmin()) return true;

  router.navigate(['/dashboard']);
  return false;
};
