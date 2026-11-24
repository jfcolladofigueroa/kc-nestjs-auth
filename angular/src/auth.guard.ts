import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KcAuthService } from './auth.service';

export const kcAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(KcAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // A pending forced change only lets the user reach the change-password screen.
  const changeRoute = auth.changePasswordRoute;
  if (auth.mustChangePassword() && !state.url.startsWith(changeRoute)) {
    return router.parseUrl(changeRoute);
  }
  return true;
};

export const kcAdminGuard: CanActivateFn = () => {
  const auth = inject(KcAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated() && auth.isAdmin()) return true;

  router.navigate(['/dashboard']);
  return false;
};
