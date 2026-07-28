import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../shared/services/loading.service';
import { environment } from '../../environments/environment';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Only show spinner for requests to FactoNet backend
  if (req.url.startsWith(environment.BASE_URL_FACTONET)) {
    loadingService.show();
    return next(req).pipe(
      finalize(() => loadingService.hide())
    );
  }

  return next(req);
};
