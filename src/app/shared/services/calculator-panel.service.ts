import { Injectable, signal } from '@angular/core';

/**
 * Estado del panel lateral de la calculadora. Cuando está abierto, marca el
 * <body> con `calc-open` para que los elementos fijos (footer, botón flotante
 * de ajustes en móvil) se corran junto con el cuerpo de la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorPanelService {
  readonly open = signal(false);

  toggle(): void {
    this.set(!this.open());
  }

  close(): void {
    this.set(false);
  }

  private set(value: boolean): void {
    this.open.set(value);
    if (typeof document !== 'undefined') document.body.classList.toggle('calc-open', value);
  }
}
