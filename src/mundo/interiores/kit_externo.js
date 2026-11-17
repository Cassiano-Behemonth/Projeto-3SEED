// Kit para lugares a céu aberto: navios, vegetação, construções vistas de fora, cidade e base.
// Mesma convenção do kit de móveis: a peça nasce na origem com a "frente" para +Z e é colada em (x, z) com rotação ry.
import * as THREE from 'three';
import { Construtor, polysDuasAguas, polysQuatroAguas, polysEmpenas, polysPiramide } from '../../util/construtor.js';
import { acabamentoQuadrado } from './acabamentos.js';

const por = (b, x, z, ry, fn) => { const s = new Construtor(); fn(s); b.anexar(s, x, 0, z, ry); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Número "aleatório" que depende só da posição: a mesma peça sai sempre igual.
const acaso = (x, z, n = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + n * 37.719) * 43758.5453; return v - Math.floor(v); };

// ───────── Navio ─────────

// Mastro com vergas e velas. A verga corre de um bordo ao outro; a "frente" é para onde o pano enfuna (a proa).
export function mastro(b, M, x, z, ry = 0, { h = 14, r = 0.28, w = 9, velas = 2, cor = '#5a3a22', pano = '#e6dcc2', recolhidas = false, cesto = true } = {}) {
  por(b, x, z, ry, (s) => {
    s.cilindro(M.liso, r * 0.5, r, h, 0, 0, 0, { seg: 10, cor });
    s.cilindro(M.liso, r * 1.5, r * 1.5, 0.5, 0, 0, 0, { seg: 10, cor: '#3a2416' });
    const n = Math.max(0, Math.min(3, Math.round(velas)));
    const pe = 2.6, topo = h * 0.9, trecho = n ? (topo - pe) / n : 0;
    for (let i = 0; i < n; i++) {
      const y0 = pe + trecho * i + 0.25, y1 = pe + trecho * (i + 1), larg = w * (1 - 0.22 * i);
      s.tubo(M.liso, [-larg / 2, y1, 0], [larg / 2, y1, 0], 0.09, 0.09, { seg: 8, cor });
      if (recolhidas) { s.tubo(M.liso, [-larg * 0.46, y1 - 0.2, 0.05], [larg * 0.46, y1 - 0.2, 0.05], 0.2, 0.2, { seg: 8, cor: pano }); continue; }
      // Pano enfunado: tiras verticais em arco.
      const tiras = 7, lw = larg * 0.92, fundo = lw * 0.1, hs = y1 - y0 - 0.15;
      for (let k = 0; k < tiras; k++) {
        const xa = -lw / 2 + (lw * k) / tiras, xb = xa + lw / tiras, za = fundo * (1 - (2 * xa / lw) ** 2), zb = fundo * (1 - (2 * xb / lw) ** 2);
        s.caixa(M.liso, Math.hypot(xb - xa, zb - za) * 1.04, hs, 0.05, (xa + xb) / 2, y0, 0.12 + (za + zb) / 2, { ry: -Math.atan2(zb - za, xb - xa), cor: pano });
      }
    }
    if (cesto) { const yc = h * 0.72; s.cilindro(M.liso, 0.75, 0.6, 0.12, 0, yc, 0, { seg: 12, cor }); s.cilindro(M.liso, 0.78, 0.78, 0.5, 0, yc + 0.12, 0, { seg: 12, cor, aberto: true }); }
    s.caixa(M.liso, 0.9, 0.5, 0.03, 0.45, h - 0.6, 0, { cor: '#1a1a1c' }); // bandeira
  });
}
// Canhão sobre carreta de madeira; a boca aponta para a frente.
export function canhao(b, M, x, z, ry = 0, { l = 1.7, cor = '#232326' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.7, 0.3, 1.1, 0, 0.14, -0.1, { cor: '#4a321e' });
    s.caixa(M.liso, 0.5, 0.2, 0.6, 0, 0.44, -0.3, { cor: '#4a321e' });
    for (const sx of [-1, 1]) for (const sz of [-0.5, 0.3]) s.tubo(M.liso, [sx * 0.34, 0.16, sz], [sx * 0.44, 0.16, sz], 0.16, 0.16, { seg: 10, cor: '#2a1c12' });
    s.tubo(M.metal, [0, 0.6, -0.62], [0, 0.66, l - 0.62], 0.19, 0.12, { seg: 12, cor });
    s.tubo(M.metal, [0, 0.66, l - 0.7], [0, 0.66, l - 0.6], 0.16, 0.16, { seg: 12, cor });
    s.esfera(M.metal, 0.1, 0, 0.5, -0.7, { cor });
  });
}
// Timão: roda de leme em pé, sobre um pedestal.
export function timao(b, M, x, z, ry = 0, { r = 0.55, cor = '#6b4a2c' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.3, 0.95, 0.35, 0, 0, -0.25, { cor: '#4a321e' });
    const yc = 1.05;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, a2 = ((k + 1) / 12) * Math.PI * 2;
      s.tubo(M.liso, [Math.cos(a) * r, yc + Math.sin(a) * r, 0], [Math.cos(a2) * r, yc + Math.sin(a2) * r, 0], 0.045, 0.045, { seg: 6, cor });
    }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; s.tubo(M.liso, [0, yc, 0], [Math.cos(a) * r * 1.22, yc + Math.sin(a) * r * 1.22, 0], 0.03, 0.03, { seg: 6, cor }); }
    s.tubo(M.liso, [0, yc, -0.25], [0, yc, 0.06], 0.07, 0.07, { seg: 8, cor: '#8a7a4a' });
  });
}
// Gurupés: o mastro inclinado que sai da proa. "l" é o comprimento; a frente é para onde ele aponta.
export function gurupes(b, M, x, z, ry = 0, { l = 6, r = 0.16, cor = '#5a3a22' } = {}) {
  por(b, x, z, ry, (s) => { s.tubo(M.liso, [0, 0.4, 0], [0, 0.4 + l * 0.22, l], r, r * 0.45, { seg: 8, cor }); });
}
// Bote a remo; com "vela: true" ganha um mastro pequeno com pano.
export function bote(b, M, x, z, ry = 0, { l = 3.4, w = 1.4, cor = '#5a3a22', vela = false, pano = '#e6dcc2' } = {}) {
  por(b, x, z, ry, (s) => {
    const r = w / 2;
    s.torno(M.liso, [[0.02, 0], [r * 0.7, 0.08], [r * 0.96, 0.36], [r, 0.6]], 0, 0, 0, { seg: 14, cor, sz: l / w });
    s.torno(M.liso, [[r * 0.94, 0.6], [r * 0.9, 0.36], [r * 0.62, 0.14], [0.02, 0.1]], 0, 0, 0, { seg: 14, cor: '#3a2416', sz: l / w });
    for (const fz of [-0.25, 0.2]) s.caixa(M.liso, w * 0.8, 0.05, 0.28, 0, 0.4, fz * l, { cor: '#6b4a2c' });
    if (vela) { s.cilindro(M.liso, 0.05, 0.07, l * 1.1, 0, 0.1, 0, { seg: 8, cor }); s.caixa(M.liso, w * 1.5, l * 0.75, 0.04, 0, l * 0.3, 0.1, { cor: pano }); }
  });
}

// ───────── Natureza ─────────

// Rocha irregular. "r" é o raio no chão; "h", a altura.
export function rocha(b, M, x, z, _ry, { r = 1, h = null, cor = '#6b6e72' } = {}) {
  const alt = h ?? r * 0.9, c = new THREE.Color(cor);
  for (let i = 0; i < 4; i++) {
    const f = i === 0 ? 1 : 0.45 + acaso(x, z, i) * 0.3, a = acaso(x, z, i + 9) * 6.283, d = i === 0 ? 0 : r * 0.62;
    const tom = '#' + c.clone().multiplyScalar(0.82 + acaso(x, z, i + 5) * 0.36).getHexString();
    b.esfera(M.liso, r * f, x + Math.cos(a) * d, -r * f * 0.3 * (alt / r), z + Math.sin(a) * d, { cor: tom, sy: (alt / r) * (0.7 + acaso(x, z, i + 3) * 0.3), sx: 0.9 + acaso(x, z, i + 1) * 0.25 });
  }
}
// Árvore de copa redonda. Cerejeira: cor '#f2a6c4'.
export function arvore(b, M, x, z, _ry, { h = 5, r = 2, cor = '#3d6a2c', tronco = '#4a3524' } = {}) {
  const c = new THREE.Color(cor), ht = Math.max(0.8, h - r * 1.5);
  b.cilindro(M.liso, r * 0.09, r * 0.15, ht + r * 0.4, x, 0, z, { seg: 8, cor: tronco });
  for (let i = 0; i < 4; i++) {
    const f = i === 0 ? 1 : 0.55 + acaso(x, z, i) * 0.25, a = acaso(x, z, i + 7) * 6.283, d = i === 0 ? 0 : r * 0.55;
    const tom = '#' + c.clone().multiplyScalar(0.85 + acaso(x, z, i + 2) * 0.3).getHexString();
    b.esfera(M.liso, r * f, x + Math.cos(a) * d, ht + (i === 0 ? 0 : r * 0.25 * acaso(x, z, i + 4)), z + Math.sin(a) * d, { cor: tom, sy: 0.78 });
  }
}
// Pinheiro em camadas; "neve: true" cobre os galhos de branco.
export function pinheiro(b, M, x, z, _ry, { h = 6, r = 1.5, cor = '#2f5a3a', neve = false } = {}) {
  b.cilindro(M.liso, 0.1, 0.16, h * 0.3, x, 0, z, { seg: 8, cor: '#3a2a1c' });
  for (let i = 0; i < 3; i++) {
    const y = h * (0.18 + 0.25 * i), rr = r * (1 - 0.26 * i), hh = h * 0.36;
    b.cilindro(M.liso, 0.02, rr, hh, x, y, z, { seg: 9, cor });
    if (neve) b.cilindro(M.liso, 0.02, rr * 0.72, hh * 0.72, x, y + hh * 0.3, z, { seg: 9, cor: '#eef3f8' });
  }
}
// Palmeira: tronco curvo e folhas caídas.
export function palmeira(b, M, x, z, _ry, { h = 6, cor = '#3f7a35' } = {}) {
  const a0 = acaso(x, z) * 6.283, dx = Math.cos(a0) * h * 0.12, dz = Math.sin(a0) * h * 0.12;
  b.tubo(M.liso, [x, 0, z], [x + dx * 0.4, h * 0.55, z + dz * 0.4], 0.2, 0.15, { seg: 8, cor: '#6b5236' });
  b.tubo(M.liso, [x + dx * 0.4, h * 0.55, z + dz * 0.4], [x + dx, h, z + dz], 0.15, 0.11, { seg: 8, cor: '#6b5236' });
  const tx = x + dx, tz = z + dz, c = new THREE.Color(cor);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * 6.283 + a0, l = h * (0.34 + acaso(x, z, k) * 0.1), tom = '#' + c.clone().multiplyScalar(0.8 + acaso(x, z, k + 3) * 0.4).getHexString();
    const mx = tx + Math.cos(a) * l * 0.55, mz = tz + Math.sin(a) * l * 0.55;
    b.tubo(M.liso, [tx, h, tz], [mx, h + l * 0.16, mz], 0.1, 0.16, { seg: 5, cor: tom });
    b.tubo(M.liso, [mx, h + l * 0.16, mz], [tx + Math.cos(a) * l, h - l * 0.3, tz + Math.sin(a) * l], 0.16, 0.02, { seg: 5, cor: tom });
  }
}
export function arbusto(b, M, x, z, _ry, { r = 0.6, cor = '#3d4a22' } = {}) {
  b.esfera(M.liso, r, x, -r * 0.25, z, { cor, sy: 0.7 });
  b.esfera(M.liso, r * 0.6, x + r * 0.6, -r * 0.15, z + r * 0.3, { cor, sy: 0.7 });
}

// ───────── Construções vistas de fora ─────────

// Telhado em meio cilindro (hangar): arco sobre a largura, comprido na profundidade.
function polysArco(w, d, h, n = 10) {
  const polys = [], r = w / 2, hd = d / 2;
  const pt = (k, zz) => { const a = (k / n) * Math.PI; return V(Math.cos(a) * r, Math.sin(a) * h, zz); };
  for (let k = 0; k < n; k++) polys.push([pt(k, hd), pt(k, -hd), pt(k + 1, -hd), pt(k + 1, hd)]);
  const frente = [], fundo = [];
  for (let k = 0; k <= n; k++) { frente.push(pt(k, hd)); fundo.push(pt(n - k, -hd)); }
  return { casca: polys, tampas: [frente, fundo] };
}
// Casa, galpão ou torre vistos de fora: um bloco com telhado. É um volume fechado; não se entra nele.
// telhado: 'duas-aguas', 'quatro-aguas', 'japones' (beiral largo com cumeeira), 'plano' ou 'arco' (hangar).
// A cumeeira corre na largura (w); a porta fica na frente.
export function casa(b, M, x, z, ry = 0, { w = 6, d = 5, h = 3, telhado = 'duas-aguas', cor = '#cfc6b4', corTelhado = '#3a3a40', ht = null, beiral = 0.4, neve = false, porta = true, janelas = true, andares = null, luz = '#ffcf7a' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, h, d, 0, 0, 0, { cor });
    const alt = ht ?? Math.min(w, d) * 0.42, bw = w + beiral * 2, bd = d + beiral * 2, branco = '#eef3f8';
    const cobrir = (polys, y, corT) => { s.faces(M.liso, polys, 0, y, 0, { cor: corT }); };
    if (telhado === 'plano') {
      s.caixa(M.liso, w + 0.2, 0.3, d + 0.2, 0, h, 0, { cor: corTelhado });
      if (neve) s.caixa(M.liso, w, 0.12, d, 0, h + 0.3, 0, { cor: branco });
    } else if (telhado === 'arco') {
      const { casca, tampas } = polysArco(w, d + beiral, alt);
      cobrir(casca, h, neve ? branco : corTelhado); cobrir(tampas, h, cor);
    } else if (telhado === 'quatro-aguas') {
      cobrir(polysQuatroAguas(bw, bd, alt), h, neve ? branco : corTelhado);
    } else if (telhado === 'japones') {
      // Saia larga de quatro águas embaixo e uma cumeeira de duas águas em cima.
      const b2 = Math.max(beiral, 0.8), sw = w + b2 * 2, sd = d + b2 * 2;
      cobrir(polysQuatroAguas(sw, sd, alt * 0.75), h, corTelhado);
      const cw = w * 0.72, cd = d * 0.62;
      cobrir(polysDuasAguas(cw, cd, alt * 0.7), h + alt * 0.42, corTelhado); cobrir(polysEmpenas(cw, cd, alt * 0.7), h + alt * 0.42, cor);
      s.caixa(M.liso, cw + 0.5, 0.18, 0.22, 0, h + alt * 1.1, 0, { cor: '#1c1c20' });
      for (const sx of [-1, 1]) s.caixa(M.liso, 0.2, 0.36, 0.3, sx * (cw / 2 + 0.2), h + alt * 1.1, 0, { cor: '#c9a23a' });
      if (neve) cobrir(polysQuatroAguas(sw * 0.86, sd * 0.86, alt * 0.66), h + alt * 0.12, branco);
    } else {
      cobrir(polysDuasAguas(bw, bd, alt), h, neve ? branco : corTelhado); cobrir(polysEmpenas(w, d, alt), h, cor);
    }
    // No hangar a boca é um portão largo, na frente, sob o arco.
    if (porta && telhado === 'arco') s.caixa(M.liso, w * 0.72, h + alt * 0.45, 0.1, 0, 0, d / 2 + beiral / 2, { cor: '#1c1f24' });
    else if (porta) s.caixa(M.liso, Math.min(1.2, w * 0.3), Math.min(2.1, h * 0.75), 0.08, 0, 0, d / 2, { cor: '#2a1c12' });
    // Janelas: uma fileira por andar, nas quatro faces. De dia ficam escuras; à noite, acesas.
    if (janelas && telhado !== 'arco') {
      const na = Math.max(1, Math.round(andares ?? h / 3)), ha = h / na, jh = Math.min(0.9, ha * 0.34);
      for (let i = 0; i < na; i++) {
        const y = i * ha + ha * 0.42, nf = Math.max(1, Math.floor(w / 2.3)), nl = Math.max(1, Math.floor(d / 2.3));
        for (let k = 0; k < nf; k++) {
          const xk = -w / 2 + ((k + 0.5) * w) / nf;
          if (!(i === 0 && porta && Math.abs(xk) < 1)) s.caixa(M.lampada, 0.8, jh, 0.06, xk, y, d / 2, { cor: luz });
          s.caixa(M.lampada, 0.8, jh, 0.06, xk, y, -d / 2, { cor: luz });
        }
        for (let k = 0; k < nl; k++) for (const sx of [-1, 1]) s.caixa(M.lampada, 0.06, jh, 0.8, sx * w / 2, y, -d / 2 + ((k + 0.5) * d) / nl, { cor: luz });
      }
    }
  });
}
// Torre de andares, cada um menor que o de baixo e com a sua saia de telhado: castelo japonês (largo, 3 andares)
// ou pagode (estreito, 5 andares).
export function torreAndares(b, M, x, z, ry = 0, { w = 8, d = null, andares = 3, h = 3, cor = '#e8e2d2', corTelhado = '#34343a', reduz = 0.8, base = 0, corBase = '#6b6e72' } = {}) {
  por(b, x, z, ry, (s) => {
    let lw = w, ld = d ?? w, y = 0;
    if (base > 0) { s.caixa(M.liso, lw + 1.6, base, ld + 1.6, 0, 0, 0, { cor: corBase }); y = base; }
    const n = Math.max(1, Math.round(andares));
    for (let i = 0; i < n; i++) {
      s.caixa(M.liso, lw, h, ld, 0, y, 0, { cor });
      for (const sx of [-1, 1]) s.caixa(M.lampada, lw * 0.14, h * 0.3, 0.06, sx * lw * 0.25, y + h * 0.4, ld / 2, { cor: '#ffcf7a' });
      y += h;
      const ult = i === n - 1, aba = Math.max(0.7, lw * 0.14);
      if (ult) {
        s.faces(M.liso, polysQuatroAguas(lw + aba * 2, ld + aba * 2, Math.min(lw, ld) * 0.45), 0, y, 0, { cor: corTelhado });
        s.cilindro(M.liso, 0.03, 0.09, h * 0.8, 0, y + Math.min(lw, ld) * 0.42, 0, { seg: 6, cor: '#c9a23a' });
      } else s.faces(M.liso, polysQuatroAguas(lw + aba * 2, ld + aba * 2, aba * 1.1), 0, y - 0.05, 0, { cor: corTelhado });
      lw *= reduz; ld *= reduz;
    }
  });
}
// Portal torii: dois pilares e duas traves.
export function torii(b, M, x, z, ry = 0, { w = 4, h = 4.5, cor = '#b3261e' } = {}) {
  por(b, x, z, ry, (s) => {
    for (const sx of [-1, 1]) { s.cilindro(M.liso, 0.17, 0.2, h, sx * w / 2, 0, 0, { seg: 10, cor }); s.cilindro(M.liso, 0.26, 0.26, 0.3, sx * w / 2, 0, 0, { seg: 10, cor: '#1c1c20' }); }
    s.caixa(M.liso, w * 1.45, 0.28, 0.4, 0, h, 0, { cor });
    s.caixa(M.liso, w * 1.55, 0.14, 0.5, 0, h + 0.28, 0, { cor: '#1c1c20' });
    s.caixa(M.liso, w * 1.2, 0.22, 0.26, 0, h * 0.78, 0, { cor });
  });
}
// Ponte em arco. "w" é o comprimento (de uma margem à outra), "d" a largura; dá para andar por cima.
export function ponte(b, M, x, z, ry = 0, { w = 8, d = 3, h = 1.1, cor = '#b3261e', piso = '#6b4a2c' } = {}) {
  por(b, x, z, ry, (s) => {
    const n = 18, lw = w / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, y = h * (1 - (2 * t - 1) ** 2), xc = -w / 2 + lw * (k + 0.5);
      s.caixa(M.liso, lw * 1.02, y + 0.12, d, xc, 0, 0, { cor: piso });
      for (const sz of [-1, 1]) {
        s.caixa(M.liso, lw * 1.02, 0.1, 0.1, xc, y + 0.12 + 0.75, sz * (d / 2 - 0.05), { cor });
        if (k % 3 === 1) s.caixa(M.liso, 0.1, 0.8, 0.1, xc, y + 0.1, sz * (d / 2 - 0.05), { cor });
      }
    }
  });
}
// Poste de luz ou lanterna. Combine com uma luz no mesmo ponto.
export function poste(b, M, x, z, _ry, { h = 3, cor = '#2a2622', luz = '#ffcf7a' } = {}) {
  b.cilindro(M.liso, 0.05, 0.08, h, x, 0, z, { seg: 8, cor });
  b.caixa(M.lampada, 0.3, 0.36, 0.3, x, h, z, { cor: luz });
  b.caixa(M.liso, 0.44, 0.07, 0.44, x, h + 0.36, z, { cor });
}
// Barraca de feira: quatro paus, lona inclinada e um balcão.
export function tenda(b, M, x, z, ry = 0, { w = 3, d = 2.4, h = 2.3, cor = '#a83a32' } = {}) {
  por(b, x, z, ry, (s) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.cilindro(M.liso, 0.04, 0.04, h + (sz < 0 ? 0.5 : 0), sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), { seg: 6, cor: '#3a2a1c' });
    s.faces(M.liso, [[V(-w / 2 - 0.2, h, d / 2 + 0.3), V(w / 2 + 0.2, h, d / 2 + 0.3), V(w / 2 + 0.2, h + 0.55, -d / 2), V(-w / 2 - 0.2, h + 0.55, -d / 2)]], 0, 0, 0, { cor });
    s.faces(M.liso, [[V(w / 2 + 0.2, h - 0.02, d / 2 + 0.3), V(-w / 2 - 0.2, h - 0.02, d / 2 + 0.3), V(-w / 2 - 0.2, h + 0.53, -d / 2), V(w / 2 + 0.2, h + 0.53, -d / 2)]], 0, 0, 0, { cor });
    s.caixa(M.liso, w * 0.9, 0.8, d * 0.45, 0, 0, d * 0.15, { cor: '#5a3a22' });
  });
}

// Cerca de madeira (moirões e duas travessas), em linha reta: "w" é o comprimento; com giro 0 corre na horizontal da
// imagem. Colide em toda a extensão (ver Planta.decor). Para cercar um lugar, junte vários trechos.
export function cerca(b, M, x, z, ry = 0, { w = 10, h = 1.25, cor = '#4a3320', vao = 2.4 } = {}) {
  por(b, x, z, ry, (s) => {
    const n = Math.max(1, Math.round(w / vao)), c = new THREE.Color(cor);
    for (let i = 0; i <= n; i++) {
      const px = -w / 2 + (w * i) / n, tom = '#' + c.clone().multiplyScalar(0.8 + acaso(x + px, z, i) * 0.35).getHexString();
      s.caixa(M.liso, 0.16, h + 0.1, 0.16, px, 0, 0, { cor: tom });
    }
    for (const [y, e] of [[h * 0.42, 0.09], [h * 0.82, 0.1]]) s.caixa(M.liso, w + 0.12, e, 0.07, 0, y, 0.06, { cor });
  });
}

// Fogueira acesa: anel de pedras, toras em pirâmide (tipi), brasa e chamas que tremulam (acesas de dia e de noite).
// Ponha uma luz quente no mesmo ponto ("luzes"), para ela iluminar em volta. r: raio da fogueira; h: altura das toras.
const matChama = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const matBrasa = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
matChama.userData.semSombra = matBrasa.userData.semSombra = true;
export function fogueira(b, M, x, z, ry = 0, { r = 0.9, h = 1.7, cor = '#3a2618', pedras = true, ctx } = {}) {
  por(b, x, z, ry, (s) => {
    if (pedras) for (let i = 0; i < 13; i++) {
      const a = (i / 13) * 6.283, pr = r * (0.17 + acaso(x, z, i) * 0.06);
      s.esfera(M.liso, pr, Math.cos(a) * r * 1.15, -pr * 0.45, Math.sin(a) * r * 1.15, { cor: '#57534d', sy: 0.75 });
    }
    s.cilindro(matBrasa, r * 0.55, r * 0.7, 0.07, 0, 0, 0, { seg: 12 });
    const c = new THREE.Color(cor);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + 0.3, tom = '#' + c.clone().multiplyScalar(0.75 + acaso(x, z, i + 20) * 0.5).getHexString();
      s.tubo(M.liso, [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.1, h, Math.sin(a) * r * 0.1], 0.09, 0.06, { seg: 6, cor: tom });
    }
    s.cilindro(matChama, 0, r * 0.55, h * 0.72, 0, 0.05, 0, { seg: 9 });
    s.cilindro(matChama, 0, r * 0.32, h * 0.95, r * 0.1, 0.05, -r * 0.06, { seg: 7 });
    s.cilindro(matChama, 0, r * 0.28, h * 0.6, -r * 0.16, 0.05, r * 0.1, { seg: 7 });
  });
  ctx?.anim?.((t) => {
    const k = 0.7 + 0.18 * Math.sin(t * 9.1) + 0.12 * Math.sin(t * 23.3 + 1.7);
    matChama.opacity = 0.55 + 0.35 * k; matChama.color.setRGB(1, 0.42 + 0.2 * k, 0.15);
  });
}

// ───────── Base, porto e indústria ─────────

// Contêiner de carga; "w" é o comprimento.
export function container(b, M, x, z, ry = 0, { w = 6, h = 2.6, d = 2.4, cor = '#a03a32' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, h, d, 0, 0, 0, { cor });
    const escuro = '#' + new THREE.Color(cor).multiplyScalar(0.7).getHexString();
    for (let k = 1; k < Math.round(w / 0.6); k++) for (const sz of [-1, 1]) s.caixa(M.liso, 0.08, h * 0.9, 0.05, -w / 2 + k * (w / Math.round(w / 0.6)), h * 0.05, sz * d / 2, { cor: escuro });
    s.caixa(M.liso, 0.05, h * 0.9, d * 0.94, w / 2, h * 0.05, 0, { cor: escuro });
  });
}
// Redoma branca de radar sobre uma base.
export function domo(b, M, x, z, _ry, { r = 4, base = 1.5, cor = '#dfe4ea' } = {}) {
  b.cilindro(M.liso, r * 0.8, r * 0.85, base, x, 0, z, { seg: 18, cor: '#6b7078' });
  b.esfera(M.liso, r, x, base - r * 0.35, z, { cor });
}
// Antena parabólica inclinada sobre um pedestal; a frente é para onde ela aponta.
export function parabolica(b, M, x, z, ry = 0, { r = 3, h = 4, cor = '#dfe4ea' } = {}) {
  por(b, x, z, ry, (s) => {
    s.cilindro(M.liso, 0.3, 0.5, h, 0, 0, 0, { seg: 10, cor: '#6b7078' });
    const perfil = []; for (let k = 0; k <= 6; k++) { const t = k / 6; perfil.push(new THREE.Vector2(0.05 + r * t, r * 0.32 * t * t)); }
    const fora = new THREE.LatheGeometry(perfil, 18), dentro = new THREE.LatheGeometry([...perfil].reverse(), 18);
    for (const [g, c] of [[fora, '#9aa0a8'], [dentro, cor]]) { g.rotateX(1.0); s.add(M.liso, g, 0, h, 0.2, 0, c); }
    s.tubo(M.liso, [0, h, 0.2], [0, h + r * 0.62, 0.2 + r * 0.92], 0.05, 0.05, { seg: 6, cor: '#6b7078' });
  });
}
// Torre de treliça (rádio, vigia) com luz vermelha no topo.
export function torreTrelica(b, M, x, z, ry = 0, { h = 14, w = 2.4, cor = '#7a7e84', luz = true, ctx = null } = {}) {
  por(b, x, z, ry, (s) => {
    const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]], topo = 0.22, niveis = Math.max(3, Math.round(h / 2.5));
    const pt = (i, n) => { const f = 1 - (1 - topo) * (n / niveis), [cx, cz] = cantos[i % 4]; return [cx * (w / 2) * f, (h * n) / niveis, cz * (w / 2) * f]; };
    for (let i = 0; i < 4; i++) s.tubo(M.metal, pt(i, 0), pt(i, niveis), 0.07, 0.05, { seg: 6, cor });
    for (let n = 0; n < niveis; n++) for (let i = 0; i < 4; i++) { s.tubo(M.metal, pt(i, n), pt(i + 1, n + 1), 0.03, 0.03, { seg: 5, cor }); s.tubo(M.metal, pt(i, n + 1), pt(i + 1, n + 1), 0.03, 0.03, { seg: 5, cor }); }
    s.caixa(M.liso, w * topo * 1.6, 0.12, w * topo * 1.6, 0, h, 0, { cor });
    if (luz) s.esfera(ctx?.pisca ?? M.lampada, 0.2, 0, h + 0.15, 0, { cor: '#ff3a2a' }); // pisca
  });
}
// Veículo simples: 'jipe' ou 'caminhao'. A frente é a dianteira.
// "l" muda o comprimento (jipe: 3,8 m; caminhão: 6,2 m) e o veículo inteiro acompanha.
export function veiculo(b, M, x, z, ry = 0, { modelo = 'jipe', cor = '#5a6048', l: comp = null } = {}) {
  const s0 = new Construtor(), padrao = modelo === 'caminhao' ? 6.2 : 3.8;
  ((s) => {
    const cam = modelo === 'caminhao', w = cam ? 2.3 : 1.8, l = cam ? 6.2 : 3.8, escuro = '#1c1c1e';
    s.caixa(M.liso, w, cam ? 0.9 : 0.7, l, 0, 0.45, 0, { cor });
    s.caixa(M.liso, w * 0.94, cam ? 1.1 : 0.75, cam ? 1.7 : 1.5, 0, cam ? 1.35 : 1.15, cam ? l / 2 - 1.2 : 0.1, { cor });
    s.caixa(M.liso, w * 0.96, 0.4, 0.05, 0, cam ? 1.85 : 1.4, (cam ? l / 2 - 0.35 : 0.86), { cor: '#8fb0c8' });
    if (cam) s.caixa(M.liso, w, 1.5, l - 2.3, 0, 1.35, -1.05, { cor: '#6b7058' });
    for (const sx of [-1, 1]) for (const sz of [-0.32, 0.32]) s.tubo(M.liso, [sx * (w / 2 - 0.15), 0.42, sz * l], [sx * (w / 2 + 0.12), 0.42, sz * l], 0.42, 0.42, { seg: 12, cor: escuro });
  })(s0);
  b.anexar(s0, x, 0, z, ry, comp ? comp / padrao : 1);
}
// Guindaste de pátio: torre e lança. A frente é para onde a lança aponta.
export function guindaste(b, M, x, z, ry = 0, { h = 8, alcance = 9, cor = '#d9a020' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 3, 0.9, 3.6, 0, 0, 0, { cor: '#4a4e54' });
    s.caixa(M.liso, 2.2, 1.6, 2.4, 0, 0.9, -0.2, { cor });
    for (const sx of [-0.5, 0.5]) { s.tubo(M.metal, [sx, 2.4, -0.6], [sx * 0.3, h, alcance * 0.25], 0.09, 0.07, { seg: 6, cor }); s.tubo(M.metal, [sx, 2.4, 0.4], [sx * 0.3, h * 0.8, alcance], 0.09, 0.06, { seg: 6, cor }); }
    s.tubo(M.metal, [0, h, alcance * 0.25], [0, h * 0.8, alcance], 0.03, 0.03, { seg: 5, cor: '#1c1c1e' });
    s.tubo(M.metal, [0, h * 0.8, alcance], [0, h * 0.35, alcance], 0.02, 0.02, { seg: 5, cor: '#1c1c1e' });
    s.caixa(M.liso, 0.4, 0.4, 0.4, 0, h * 0.35 - 0.4, alcance, { cor: '#1c1c1e' });
  });
}

// Partes soltas de uma peça: malhas próprias, fora do bloco único, para poderem girar ou deixar passar por baixo.
function solta(ctx, x, z, ry, fn, { teto = false } = {}) {
  const s = new Construtor(); fn(s);
  const g = s.construir();
  g.position.set(x, ctx?.base ?? 0, z); g.rotation.y = ry;
  if (teto) g.traverse((o) => { o.userData.teto = true; });
  ctx?.solto?.(g);
  return g;
}
// Portão com telhado: dois pilares e uma cobertura por cima. Passa-se por baixo (criaturas e câmera).
// "w" é o vão livre entre os pilares; "h", a altura da passagem.
export function portao(b, M, x, z, ry = 0, { w = 4, h = 3.4, d = 2.2, cor = '#3a2a1c', corTelhado = '#34343a', telhado = 'japones', estilo = null, textura = 'pedraMuro', abertura = 55, ctx = null } = {}) {
  if (estilo === 'ferro') { portaoFerro(b, M, x, z, ry, { w, h, textura, abertura }); return; }
  por(b, x, z, ry, (s) => { for (const sx of [-1, 1]) s.caixa(M.liso, 0.5, h, d * 0.7, sx * (w / 2 + 0.25), 0, 0, { cor }); });
  solta(ctx, x, z, ry, (s) => {
    s.caixa(M.liso, w + 1.4, 0.35, d * 0.8, 0, h, 0, { cor });
    if (telhado === 'plano') s.caixa(M.liso, w + 1.8, 0.25, d + 0.4, 0, h + 0.35, 0, { cor: corTelhado });
    else { s.faces(M.liso, polysQuatroAguas(w + 3, d + 1.6, 1.3), 0, h + 0.35, 0, { cor: corTelhado }); s.caixa(M.liso, w + 1, 0.16, 0.2, 0, h + 1.55, 0, { cor: '#1c1c20' }); }
  }, { teto: true });
}
// Portão de ferro entre dois pilares de pedra (mansão, cemitério, parque): pilares com capitel e pinha, duas folhas de
// grade com lanças, abertas "abertura" graus para dentro, e um arco de ferro por cima. "w" é o vão entre os pilares.
function portaoFerro(b, M, x, z, ry, { w, h, textura, abertura }) {
  const pedra = acabamentoQuadrado(M, textura), ferro = '#17181a', hf = h * 0.86;
  por(b, x, z, ry, (s) => {
    for (const sx of [-1, 1]) {
      const px = sx * (w / 2 + 0.45);
      s.caixa(pedra, 1.0, 0.35, 1.0, px, 0, 0, { cor: '#9a958c' });
      s.caixa(pedra, 0.86, h - 0.35, 0.86, px, 0.35, 0, { cor: '#b5afa4' });
      s.caixa(pedra, 1.08, 0.2, 1.08, px, h, 0, { cor: '#9a958c' });
      s.caixa(pedra, 0.7, 0.18, 0.7, px, h + 0.2, 0, { cor: '#b5afa4' });
      s.esfera(pedra, 0.26, px, h + 0.38, 0, { cor: '#b5afa4' });
    }
    // Arco de ferro com volutas simples.
    const n = 14, arco = (t) => [-w / 2 + w * t, h + 0.15 + Math.sin(Math.PI * t) * 0.75];
    for (let k = 0; k < n; k++) { const [x0, y0] = arco(k / n), [x1, y1] = arco((k + 1) / n); s.tubo(M.metal, [x0, y0, 0], [x1, y1, 0], 0.035, 0.035, { seg: 5, cor: ferro }); }
    s.tubo(M.metal, [-w / 2, h + 0.15, 0], [w / 2, h + 0.15, 0], 0.035, 0.035, { seg: 5, cor: ferro });
    for (let k = 1; k < n; k++) { const [xa, ya] = arco(k / n); s.tubo(M.metal, [xa, h + 0.15, 0], [xa, ya, 0], 0.016, 0.016, { seg: 4, cor: ferro }); }
    s.esfera(M.metal, 0.12, 0, h + 0.86, 0, { cor: ferro });
  });
  // Folhas: dobradiça no pilar, abertas para dentro.
  for (const sx of [-1, 1]) {
    const folha = new Construtor(), lw = w / 2 - 0.05, nb = Math.max(4, Math.round(lw / 0.13));
    for (const y of [0.18, hf * 0.45, hf - 0.15]) folha.tubo(M.metal, [0, y, 0], [sx * -lw, y, 0], 0.03, 0.03, { seg: 5, cor: ferro });
    for (let k = 0; k <= nb; k++) {
      const bx = sx * -lw * (k / nb), topo = hf + (k % 2 ? 0 : 0.12);
      folha.tubo(M.metal, [bx, 0.05, 0], [bx, topo, 0], 0.017, 0.017, { seg: 4, cor: ferro });
      folha.cilindro(M.metal, 0, 0.04, 0.14, bx, topo, 0, { seg: 4, cor: ferro });
    }
    const hx = sx * (w / 2), ang = sx * (-abertura * Math.PI) / 180, c = Math.cos(ry), sn = Math.sin(ry);
    b.anexar(folha, x + hx * c, 0, z - hx * sn, ry + ang);
  }
}
// Chafariz de pedra: tanque redondo com água, coluna torneada, uma ou duas taças e uma cortina de água caindo.
const AGUA = new THREE.MeshStandardMaterial({ color: 0x3d6672, roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.86 });
const CORTINA = new THREE.MeshStandardMaterial({ color: 0x9cc8d8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false });
function torneado(mat, perfil, seg = 28) {
  // Sólido de revolução com UV em metros, para a textura não esticar em volta.
  const t = mat.userData.tile ? mat.userData.tile[0] : 1, g = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  let comp = 0; const acum = [0]; for (let i = 1; i < perfil.length; i++) { comp += Math.hypot(perfil[i][0] - perfil[i - 1][0], perfil[i][1] - perfil[i - 1][1]); acum.push(comp); }
  const rMed = perfil.reduce((m, p) => m + p[0], 0) / perfil.length, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const j = i % perfil.length; uv.setXY(i, (uv.getX(i) * 2 * Math.PI * rMed) / t, acum[j] / t); }
  return g;
}
export function chafariz(b, M, x, z, _ry, { r = 2.4, niveis = 2, textura = 'pedraMuro', ctx = null } = {}) {
  const pedra = acabamentoQuadrado(M, textura, true), s = new Construtor(), claro = '#c2bcb0', escuro = '#a39d92';
  s.add(pedra, torneado(pedra, [[r - 0.34, 0.16], [r - 0.34, 0.6], [r - 0.24, 0.7], [r - 0.06, 0.72], [r + 0.06, 0.6], [r + 0.08, 0.12], [r + 0.16, 0.0]]), 0, 0, 0, 0, claro);
  s.cilindro(pedra, r - 0.33, r - 0.33, 0.16, 0, 0, 0, { seg: 28, cor: escuro });
  s.cilindro(AGUA, r - 0.35, r - 0.35, 0.02, 0, 0.5, 0, { seg: 28 });
  s.add(pedra, torneado(pedra, [[0.62, 0], [0.62, 0.3], [0.36, 0.42], [0.24, 0.7], [0.32, 0.95], [0.24, 1.25], [0.2, 1.42]]), 0, 0, 0, 0, claro);
  const taca = (y, rt) => {
    s.add(pedra, torneado(pedra, [[0.12, 0], [rt * 0.55, 0.12], [rt * 0.95, 0.32], [rt, 0.42], [rt * 0.9, 0.44]]), 0, y, 0, 0, claro);
    s.cilindro(AGUA, rt * 0.86, rt * 0.86, 0.02, 0, y + 0.36, 0, { seg: 24 });
    // Fios de água caindo da borda, com uma leve curva para fora.
    const n = Math.max(8, Math.round(rt * 14));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), ym = (y + 0.4 + 0.5) / 2;
      s.tubo(CORTINA, [c * rt * 1.0, y + 0.4, sn * rt * 1.0], [c * rt * 1.1, ym, sn * rt * 1.1], 0.03, 0.022, { seg: 4 });
      s.tubo(CORTINA, [c * rt * 1.1, ym, sn * rt * 1.1], [c * rt * 1.16, 0.5, sn * rt * 1.16], 0.022, 0.016, { seg: 4 });
    }
  };
  const r1 = Math.min(1.25, r * 0.48);
  taca(1.42, r1);
  if (niveis > 1) {
    s.add(pedra, torneado(pedra, [[0.2, 0], [0.13, 0.25], [0.18, 0.5], [0.12, 0.72]]), 0, 1.86, 0, 0, claro);
    taca(2.58, r1 * 0.55);
    s.add(pedra, torneado(pedra, [[0.0, 0], [0.12, 0.05], [0.14, 0.22], [0.06, 0.42], [0.0, 0.5]]), 0, 3.02, 0, 0, claro);
  } else s.add(pedra, torneado(pedra, [[0.0, 0], [0.12, 0.05], [0.14, 0.22], [0.06, 0.42], [0.0, 0.5]]), 0, 1.86, 0, 0, claro);
  b.anexar(s, x, 0, z, 0);
  ctx?.anim?.((t) => { CORTINA.opacity = 0.24 + 0.08 * Math.sin(t * 6.1); });
}
// Banco: 'igreja' (encosto alto, laterais fechadas) ou 'praca' (ripas de madeira e pés de ferro). A frente é para onde
// quem senta olha; "w" é o comprimento.
export function banco(b, M, x, z, ry = 0, { w = 1.8, estilo = 'igreja', cor = '#4a3020', quebrado = false } = {}) {
  por(b, x, z, ry, (s) => {
    if (estilo === 'praca') {
      for (let k = 0; k < 3; k++) s.caixa(M.liso, w, 0.04, 0.11, 0, 0.44, 0.14 - k * 0.14, { cor });
      for (let k = 0; k < 2; k++) s.caixa(M.liso, w, 0.11, 0.04, 0, 0.58 + k * 0.16, -0.24, { cor });
      for (const sx of [-1, 1]) { s.caixa(M.liso, 0.06, 0.44, 0.5, sx * (w / 2 - 0.12), 0, -0.02, { cor: '#1c1c1e' }); s.caixa(M.liso, 0.06, 0.5, 0.06, sx * (w / 2 - 0.12), 0.44, -0.24, { cor: '#1c1c1e' }); }
      return;
    }
    s.caixa(M.liso, w, 0.06, 0.42, 0, 0.42, 0.02, { cor });
    s.caixa(M.liso, w, quebrado ? 0.32 : 0.62, 0.05, 0, 0.46, -0.2, { cor });
    s.caixa(M.liso, w, 0.08, 0.06, 0, quebrado ? 0.78 : 1.08, -0.2, { cor });
    s.caixa(M.liso, w, 0.3, 0.04, 0, 0.12, 0.2, { cor: '#3a2618' }); // genuflexório
    for (const sx of [-1, 1]) s.caixa(M.liso, 0.06, quebrado && sx > 0 ? 0.6 : 1.0, 0.52, sx * (w / 2 - 0.03), 0, -0.02, { cor: '#3a2618' });
  });
}
// Radar giratório sobre um mastro.
export function radar(b, M, x, z, ry = 0, { h = 6, r = 1.6, cor = '#c9ced6', ctx = null } = {}) {
  b.cilindro(M.liso, 0.14, 0.22, h, x, 0, z, { seg: 8, cor: '#6b7078' });
  const g = solta(ctx, x, z, ry, (s) => {
    s.caixa(M.liso, r * 2, r * 0.7, 0.08, 0, h, 0, { cor });
    s.caixa(M.liso, r * 2.1, 0.06, 0.2, 0, h + r * 0.35, 0.12, { cor: '#6b7078' });
    s.cilindro(M.liso, 0.2, 0.2, 0.3, 0, h - 0.15, 0, { seg: 8, cor: '#6b7078' });
  });
  ctx?.anim?.((t) => { g.rotation.y = ry + t * 1.1; });
}

// ───────── Rede elétrica ─────────

// Isolador de porcelana: pilha de discos. Sobe a partir de y.
function isolador(s, M, x, y, z, h = 1, r = 0.11, cor = '#6a3a28') {
  const n = Math.max(3, Math.round(h / 0.16));
  s.cilindro(M.liso, r * 0.45, r * 0.45, h, x, y, z, { seg: 6, cor });
  for (let i = 0; i < n; i++) s.cilindro(M.liso, r * 0.7, r, 0.05, x, y + (i + 0.5) * (h / n), z, { seg: 8, cor });
}
// Transformador de subestação: tanque com aletas de resfriamento nos dois lados, tanque de óleo em cima e três buchas.
export function transformador(b, M, x, z, ry = 0, { w = 3.2, d = 2.2, h = 2.8, cor = '#8d9088' } = {}) {
  por(b, x, z, ry, (s) => {
    const escuro = '#' + new THREE.Color(cor).multiplyScalar(0.62).getHexString();
    s.caixa(M.liso, w + 0.5, 0.25, d + 0.9, 0, 0, 0, { cor: '#3a3c3e' });                 // base
    s.caixa(M.liso, w, h, d, 0, 0.25, 0, { cor });                                          // tanque
    s.caixa(M.liso, w + 0.12, 0.12, d + 0.12, 0, 0.25 + h, 0, { cor: escuro });             // tampa
    const n = Math.max(4, Math.round(w / 0.28));
    for (let i = 0; i < n; i++) for (const sz of [-1, 1]) s.caixa(M.liso, 0.07, h * 0.72, 0.42, -w / 2 + ((i + 0.5) * w) / n, 0.25 + h * 0.14, sz * (d / 2 + 0.24), { cor: escuro }); // aletas
    s.tubo(M.liso, [-w * 0.3, 0.25 + h + 0.75, -d * 0.28], [w * 0.3, 0.25 + h + 0.75, -d * 0.28], 0.3, 0.3, { seg: 10, cor });  // conservador de óleo
    for (const sx of [-0.25, 0.25]) s.caixa(M.liso, 0.08, 0.5, 0.08, sx * w, 0.25 + h + 0.1, -d * 0.28, { cor: escuro });
    for (const sx of [-0.3, 0, 0.3]) isolador(s, M, sx * w, 0.37 + h, d * 0.2, 1.1, 0.13);    // buchas
    s.caixa(M.liso, 0.5, 0.7, 0.14, w / 2 - 0.4, 0.25 + h * 0.45, d / 2, { cor: '#2a2c2e' }); // painel
  });
}
// Pórtico de subestação: dois pés em treliça, uma viga por cima e cadeias de isoladores penduradas.
// "w" é o vão entre os pés; a viga corre na largura.
export function portico(b, M, x, z, ry = 0, { w = 8, h = 7, cor = '#74787c', isoladores = 3 } = {}) {
  por(b, x, z, ry, (s) => {
    const l = 0.42; // lado do pé
    for (const sx of [-1, 1]) {
      const cx = (sx * w) / 2;
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) s.tubo(M.metal, [cx + dx * l, 0, dz * l], [cx + dx * l * 0.55, h, dz * l * 0.55], 0.05, 0.04, { seg: 5, cor });
      const niv = Math.max(3, Math.round(h / 1.3));
      for (let k = 0; k < niv; k++) { const y0 = (h * k) / niv, y1 = (h * (k + 1)) / niv, zig = k % 2 ? 1 : -1; s.tubo(M.metal, [cx - l * zig, y0, l], [cx + l * zig, y1, l], 0.025, 0.025, { seg: 4, cor }); s.tubo(M.metal, [cx + l * zig, y0, -l], [cx - l * zig, y1, -l], 0.025, 0.025, { seg: 4, cor }); }
      s.cilindro(M.metal, 0.02, 0.05, 1.1, cx, h, 0, { seg: 5, cor }); // para-raios
      s.caixa(M.liso, l * 3, 0.2, l * 3, cx, 0, 0, { cor: '#4a4c4e' });
    }
    // Viga em treliça.
    for (const dz of [-0.22, 0.22]) for (const y of [h - 0.5, h]) s.tubo(M.metal, [-w / 2, y, dz], [w / 2, y, dz], 0.04, 0.04, { seg: 5, cor });
    const nz = Math.max(4, Math.round(w / 0.9));
    for (let k = 0; k < nz; k++) { const xa = -w / 2 + (w * k) / nz, xb = -w / 2 + (w * (k + 1)) / nz; for (const dz of [-0.22, 0.22]) s.tubo(M.metal, [xa, k % 2 ? h : h - 0.5, dz], [xb, k % 2 ? h - 0.5 : h, dz], 0.022, 0.022, { seg: 4, cor }); }
    const ni = Math.max(0, Math.round(isoladores));
    for (let k = 0; k < ni; k++) { const xi = -w / 2 + ((k + 1) * w) / (ni + 1); isolador(s, M, xi, h - 1.6, 0, 1.1, 0.1); s.cilindro(M.metal, 0.03, 0.03, 0.12, xi, h - 1.72, 0, { seg: 5, cor: '#1a1a1c' }); }
  });
}
// Cabos aéreos: saem do ponto dado e vão "l" metros para a frente, com barriga. "h" é a altura na saída e "h2" na
// chegada; "n" cabos lado a lado, separados por "sep".
export function cabo(b, M, x, z, ry = 0, { l = 20, h = 8, h2 = null, flecha = 1, n = 3, sep = 1.1, cor = '#141416' } = {}) {
  por(b, x, z, ry, (s) => {
    const hf = h2 ?? h, seg = 10;
    for (let i = 0; i < n; i++) {
      const xi = (i - (n - 1) / 2) * sep;
      for (let k = 0; k < seg; k++) {
        const t0 = k / seg, t1 = (k + 1) / seg, y = (t) => h + (hf - h) * t - flecha * 4 * t * (1 - t);
        s.tubo(M.liso, [xi, y(t0), l * t0], [xi, y(t1), l * t1], 0.028, 0.028, { seg: 4, cor });
      }
    }
  });
}
