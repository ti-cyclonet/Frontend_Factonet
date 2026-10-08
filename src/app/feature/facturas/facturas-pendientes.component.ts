import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EsLabelPipe } from '../../shared/pipes/es-label.pipe';
import {
  FacturaResumible, ResumenCliente, diasParaVencer, hoyLocal, pagosPorVerificar, resumenCliente, textoVencimiento,
} from './facturas-resumen';

type FacturaVista = FacturaResumible & { numero: string; cliente: string; fechaPago?: string | null; periodoInicio?: string; periodoFin?: string };

/**
 * Lo primero que ve cada rol en Facturas, antes de la tabla:
 * - Cliente: cuánto debe, qué vence primero y un botón de pago por factura.
 * - Administrador: la bandeja de pagos reportados que esperan su verificación.
 */
@Component({
  selector: 'app-facturas-pendientes',
  standalone: true,
  imports: [CommonModule, EsLabelPipe],
  templateUrl: './facturas-pendientes.component.html',
  styleUrls: ['./facturas-pendientes.component.css'],
})
export class FacturasPendientesComponent implements OnChanges {
  @Input() facturas: FacturaVista[] = [];
  @Input() rol: string | null = null;
  /** TOTAL de cada factura, el mismo de la tabla y del PDF. */
  @Input() total: (f: any) => number = f => Number(f?.total) || 0;
  /** Texto del botón de pago del cliente ("Reportar pago" o "Pagar en línea"). */
  @Input() textoPagar = 'Reportar pago';

  @Output() pagar = new EventEmitter<any>();
  @Output() revisar = new EventEmitter<any>();
  /** El cliente pide su estado de cuenta en PDF. */
  @Output() estadoCuenta = new EventEmitter<void>();

  resumen: ResumenCliente<FacturaVista> | null = null;
  porVerificar: FacturaVista[] = [];
  hoy = hoyLocal();

  get esCliente(): boolean { return this.rol === 'adminInvoices'; }
  get esAdmin(): boolean { return this.rol === 'adminFactonet'; }

  ngOnChanges(): void {
    this.hoy = hoyLocal();
    this.resumen = this.esCliente ? resumenCliente(this.facturas || [], this.total, this.hoy) : null;
    this.porVerificar = this.esAdmin ? pagosPorVerificar(this.facturas || []) : [];
  }

  dias(f: FacturaVista): number | null { return diasParaVencer(f.fechaVencimiento, this.hoy); }
  vencimiento(f: FacturaVista): string { return textoVencimiento(this.dias(f)); }
  /** 'vencida' | 'pronto' (3 días o menos) | 'normal', para el color de la tarjeta. */
  urgencia(f: FacturaVista): 'vencida' | 'pronto' | 'normal' {
    const d = this.dias(f);
    if (d !== null && d < 0) return 'vencida';
    if (d !== null && d <= 3) return 'pronto';
    return 'normal';
  }

  fecha(iso?: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  dinero(valor: number): string {
    return '$' + Math.round(Number(valor) || 0).toLocaleString('es-CO');
  }

  trackById(_: number, f: FacturaVista): number { return f.id; }
}
