/**
 * Burbujas de novedades del panel (factura nueva, contrato nuevo) con un
 * aviso sonoro corto. Funciones puras + el sonido (WebAudio, sin archivos).
 */
export interface NewsBubble {
  id: string;
  kind: 'invoice' | 'contract';
  title: string;
  detail: string;
}

/** Ids que llegaron y no estaban antes. La primera carga (previous = null) no avisa. */
export function newIds<T extends string | number>(previous: Set<T> | null, current: T[]): T[] {
  if (!previous) return [];
  return current.filter((id) => !previous.has(id));
}

/**
 * Burbujas para lo nuevo: una por novedad hasta `max`; si son más, una sola
 * que las agrupa ("5 facturas nuevas").
 */
export function bubblesFor<T>(
  kind: NewsBubble['kind'],
  items: T[],
  describe: (item: T) => { title: string; detail: string },
  max = 3,
): NewsBubble[] {
  if (!items.length) return [];
  const stamp = Date.now();
  if (items.length > max) {
    const what = kind === 'invoice' ? 'facturas nuevas' : 'contratos nuevos';
    return [{ id: `${kind}-${stamp}`, kind, title: `${items.length} ${what}`, detail: 'Llegaron desde la última actualización' }];
  }
  return items.map((item, i) => ({ id: `${kind}-${stamp}-${i}`, kind, ...describe(item) }));
}

let audio: AudioContext | null = null;

/** Dos notas suaves (contrato: más agudas). Si el navegador bloquea el audio, no pasa nada. */
export function playNewsSound(kind: NewsBubble['kind']): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    const ctx = audio!;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const notes = kind === 'contract' ? [784, 1175] : [659, 988];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {
    /* sin audio disponible */
  }
}
