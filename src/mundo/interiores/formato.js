// Conversões do formato de mapa, sem dependências (o editor também usa).

// Uma parede pode vir como [x1, y1, x2, y2], como { p, esp, ... } ou como { faixa: [x0, y0, x1, y1] }, o retângulo que ela ocupa.
// A faixa vira linha do meio + espessura, com as pontas recuadas meia espessura (a peça passa essa medida além de cada ponta).
export function paredeNormal(w, escala) {
  if (Array.isArray(w)) return { p: w };
  if (!Array.isArray(w.faixa) || w.p) return w;
  const { faixa: f, ...resto } = w;
  const x0 = Math.min(f[0], f[2]), x1 = Math.max(f[0], f[2]), y0 = Math.min(f[1], f[3]), y1 = Math.max(f[1], f[3]);
  const lw = x1 - x0, lh = y1 - y0, r = (v) => Math.round(v * 10) / 10;
  if (lw >= lh) { const m = Math.min(lh / 2, lw / 2 - 1), yc = (y0 + y1) / 2; return { ...resto, p: [r(x0 + m), r(yc), r(x1 - m), r(yc)], esp: Math.round(lh * escala * 1000) / 1000 }; }
  const m = Math.min(lw / 2, lh / 2 - 1), xc = (x0 + x1) / 2;
  return { ...resto, p: [r(xc), r(y0 + m), r(xc), r(y1 - m)], esp: Math.round(lw * escala * 1000) / 1000 };
}

// Todas as paredes do mapa na forma { p, esp, ... }. Além das três formas acima, aceita
// { pontos: [[x, y], ...] }: uma linha quebrada (um casco, um muro curvo), que vira um segmento por trecho.
export function paredesDe(d) {
  const lista = [];
  for (const w of d.paredes ?? []) {
    if (!Array.isArray(w) && Array.isArray(w.pontos)) {
      const { pontos, fechada, ...resto } = w;
      const n = pontos.length, fim = fechada ? n : n - 1;
      for (let i = 0; i < fim; i++) { const a = pontos[i], b = pontos[(i + 1) % n]; lista.push({ ...resto, p: [a[0], a[1], b[0], b[1]] }); }
    } else lista.push(paredeNormal(w, d.escala));
  }
  return lista;
}

// Contorno de uma plataforma (piso elevado): "pontos" [[x, y], ...] ou "area" [x0, y0, x1, y1].
export function contornoDe(pl) {
  if (Array.isArray(pl.pontos) && pl.pontos.length >= 3) return pl.pontos;
  if (Array.isArray(pl.area) && pl.area.length === 4) { const [x0, y0, x1, y1] = pl.area; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  return null;
}
export function dentroDe(pts, x, y) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
// Altura do piso (em metros) no ponto da planta: a da plataforma mais alta que o contém, ou 0.
export function alturaDoPiso(d, x, y) {
  let h = 0;
  for (const pl of d.plataformas ?? []) { const c = contornoDe(pl); if (c && (pl.altura ?? 0) > h && dentroDe(c, x, y)) h = pl.altura; }
  return h;
}
