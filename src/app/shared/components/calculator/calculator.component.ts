import { Component, HostListener, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorPanelService } from '../../services/calculator-panel.service';

type Tab = 'basica' | 'iva' | 'credito' | 'tasas' | 'interes';
type RateType = 'EA' | 'EM' | 'NMV';

interface AmortRow { n: number; cuota: number; interes: number; abono: number; saldo: number }

/**
 * Calculadora financiera en panel lateral: aritmética básica (sin eval) más
 * IVA, cuota de crédito (sistema francés), conversión de tasas e interés
 * compuesto. Todo se calcula en el navegador; no toca el backend.
 */
@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css'],
})
export class CalculatorComponent {
  private panel = inject(CalculatorPanelService);
  readonly open = computed(() => this.panel.open());

  tab: Tab = 'basica';
  readonly tabs: [Tab, string][] = [
    ['basica', 'Básica'], ['iva', 'IVA'], ['credito', 'Crédito'], ['tasas', 'Tasas'], ['interes', 'Interés'],
  ];
  copied = '';

  close(): void {
    this.panel.close();
  }

  // ═══ Básica ═══════════════════════════════════════════════════════════
  expr = '';
  result: number | null = null;
  error = '';
  history: { expr: string; value: number }[] = [];
  readonly keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '(', '0', ')', '.', '00', '='];

  press(k: string): void {
    this.error = '';
    if (k === 'C') { this.expr = ''; this.result = null; return; }
    if (k === '⌫') { this.expr = this.expr.slice(0, -1); return; }
    if (k === '=') { this.evaluate(); return; }
    // Si hay un resultado y se escribe un operador, se continúa desde él.
    if (this.result !== null && this.expr === '' && /[+−×÷%]/.test(k)) this.expr = this.plain(this.result);
    this.result = this.expr === '' && /[0-9.(]/.test(k) ? null : this.result;
    this.expr += k;
  }

  evaluate(): void {
    if (!this.expr.trim()) return;
    try {
      const v = evaluateExpression(this.expr);
      this.history = [{ expr: this.expr, value: v }, ...this.history].slice(0, 12);
      this.result = v;
      this.expr = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Expresión inválida';
    }
  }

  reuse(v: number): void {
    this.expr += this.plain(v);
    this.tab = 'basica';
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (!this.open()) return;
    if (ev.key === 'Escape') { this.close(); return; }
    if (this.tab !== 'basica' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target as HTMLElement | null;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const map: Record<string, string> = {
      '+': '+', '-': '−', '*': '×', '/': '÷', '%': '%', '(': '(', ')': ')', '.': '.', ',': '.',
      Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C',
    };
    const k = /^[0-9]$/.test(ev.key) ? ev.key : map[ev.key];
    if (!k) return;
    ev.preventDefault();
    this.press(k);
  }

  // ═══ IVA ══════════════════════════════════════════════════════════════
  ivaValor: number | null = null;
  ivaTarifa = 19;
  ivaIncluido = false;

  get iva(): { base: number; iva: number; total: number } | null {
    const v = this.ivaValor, r = (this.ivaTarifa || 0) / 100;
    if (v === null || !isFinite(v)) return null;
    const base = this.ivaIncluido ? v / (1 + r) : v;
    return { base, iva: base * r, total: base * (1 + r) };
  }

  // ═══ Crédito (cuota fija) ═════════════════════════════════════════════
  crMonto: number | null = null;
  crTasa: number | null = null;
  crTipo: RateType = 'EA';
  crMeses: number | null = 12;
  crTabla = false;

  get credito(): { cuota: number; total: number; intereses: number; im: number; rows: AmortRow[] } | null {
    const P = this.crMonto, n = Math.round(this.crMeses || 0);
    if (!P || P <= 0 || n <= 0 || n > 600 || this.crTasa === null) return null;
    const im = toMonthly(this.crTasa / 100, this.crTipo);
    const cuota = im === 0 ? P / n : (P * im) / (1 - Math.pow(1 + im, -n));
    const rows: AmortRow[] = [];
    let saldo = P;
    for (let k = 1; k <= n; k++) {
      const interes = saldo * im;
      const abono = cuota - interes;
      saldo = k === n ? 0 : saldo - abono;
      rows.push({ n: k, cuota, interes, abono, saldo });
    }
    return { cuota, total: cuota * n, intereses: cuota * n - P, im, rows };
  }

  // ═══ Conversión de tasas ══════════════════════════════════════════════
  tsValor: number | null = null;
  tsTipo: RateType | 'ET' | 'ES' = 'EA';

  get tasas(): { ea: number; em: number; nmv: number; et: number; es: number; ed: number } | null {
    if (this.tsValor === null || !isFinite(this.tsValor)) return null;
    const r = this.tsValor / 100;
    let ea: number;
    switch (this.tsTipo) {
      case 'EA': ea = r; break;
      case 'EM': ea = Math.pow(1 + r, 12) - 1; break;
      case 'NMV': ea = Math.pow(1 + r / 12, 12) - 1; break;
      case 'ET': ea = Math.pow(1 + r, 4) - 1; break;
      case 'ES': ea = Math.pow(1 + r, 2) - 1; break;
    }
    if (ea <= -1) return null;
    const em = Math.pow(1 + ea, 1 / 12) - 1;
    return {
      ea, em, nmv: em * 12,
      et: Math.pow(1 + ea, 1 / 4) - 1,
      es: Math.pow(1 + ea, 1 / 2) - 1,
      ed: Math.pow(1 + ea, 1 / 365) - 1,
    };
  }

  // ═══ Interés compuesto (VF / VP) ══════════════════════════════════════
  inModo: 'VF' | 'VP' = 'VF';
  inValor: number | null = null;
  inTasa: number | null = null;
  inTipo: RateType = 'EA';
  inMeses: number | null = 12;

  get interes(): { resultado: number; diferencia: number; simple: number } | null {
    const v = this.inValor, n = this.inMeses;
    if (!v || n === null || n < 0 || this.inTasa === null) return null;
    const im = toMonthly(this.inTasa / 100, this.inTipo);
    const factor = Math.pow(1 + im, n);
    if (this.inModo === 'VF') {
      const vf = v * factor;
      return { resultado: vf, diferencia: vf - v, simple: v * (1 + im * n) };
    }
    const vp = v / factor;
    return { resultado: vp, diferencia: v - vp, simple: v / (1 + im * n) };
  }

  // ═══ Utilidades de presentación ═══════════════════════════════════════
  private readonly money = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  private readonly num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 10 });

  fmt(v: number): string {
    return this.money.format(v);
  }

  fmtNum(v: number): string {
    return this.num.format(v);
  }

  pct(v: number, digits = 4): string {
    return (v * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: digits }) + ' %';
  }

  /** Número sin separadores, para pegar en otro campo o en la expresión. */
  plain(v: number): string {
    return String(Math.round(v * 1e10) / 1e10);
  }

  copy(v: number, key: string): void {
    const text = (Math.round(v * 100) / 100).toFixed(2);
    navigator.clipboard?.writeText(text).then(() => {
      this.copied = key;
      setTimeout(() => (this.copied === key ? (this.copied = '') : null), 1500);
    });
  }
}

/** Tasa efectiva mensual a partir de una EA, efectiva mensual o nominal mes vencido. */
function toMonthly(r: number, tipo: RateType): number {
  if (tipo === 'EM') return r;
  if (tipo === 'NMV') return r / 12;
  return Math.pow(1 + r, 1 / 12) - 1;
}

/**
 * Evalúa + − × ÷ ( ) y % con un parser descendente (nunca `eval`).
 * `a + b%` y `a − b%` suman/restan el b % de a, como una calculadora de
 * escritorio; en cualquier otro lugar, `b%` vale b/100.
 */
export function evaluateExpression(src: string): number {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  let i = 0;

  const peek = () => s[i];
  const fail = (): never => { throw new Error('Expresión inválida'); };

  function expr(): number {
    let left = term().value;
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = term();
      const right = r.pct ? left * r.value : r.value;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function term(): { value: number; pct: boolean } {
    let f = factor();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = factor().value;
      if (op === '/' && r === 0) throw new Error('No se puede dividir entre cero');
      f = { value: op === '*' ? f.value * r : f.value / r, pct: false };
    }
    return f;
  }

  function factor(): { value: number; pct: boolean } {
    let v: number;
    if (peek() === '-') { i++; v = -factor().value; }
    else if (peek() === '+') { i++; v = factor().value; }
    else if (peek() === '(') {
      i++;
      v = expr();
      if (peek() !== ')') fail();
      i++;
    } else {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
      if (!m) fail();
      i += m![0].length;
      v = parseFloat(m![0]);
    }
    let pct = false;
    while (peek() === '%') { i++; v /= 100; pct = true; }
    return { value: v, pct };
  }

  if (!s) fail();
  const out = expr();
  if (i !== s.length || !isFinite(out)) fail();
  return out;
}
