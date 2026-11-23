// Kit de móveis para os interiores. Cada peça nasce na origem com a "frente" para +Z
// e é colada no construtor da sala em (x, z) com rotação ry (radianos).
import { Construtor } from '../../util/construtor.js';
import { acabamentoQuadrado } from './acabamentos.js';

const por = (b, x, z, ry, fn) => { const s = new Construtor(); fn(s); b.anexar(s, x, 0, z, ry); };
const BRANCO = '#dcdcd6', METAL = '#8a8d90';
// Peças com "acabamento" (o nome de uma textura: as das paredes, as dos pacotes ou as de "texturas" do mapa) usam a textura no lugar
// do material liso; "cor" passa a tingir a textura (branco = sem tinta).
const matDe = (M, acabamento) => (acabamento ? acabamentoQuadrado(M, acabamento) : M.liso);
const corDe = (acabamento, cor, padrao) => cor ?? (acabamento ? '#ffffff' : padrao);

export function cama(b, M, x, z, ry = 0, { cor = '#5d6b3f', w = 0.95, l = 2 } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, 0.28, l, 0, 0, 0, { cor: '#3b2f26' });
    s.caixa(M.liso, w - 0.06, 0.14, l - 0.06, 0, 0.28, 0, { cor: '#d8d2c0' });
    s.caixa(M.liso, w - 0.02, 0.07, l * 0.62, 0, 0.42, l * 0.17, { cor });
    s.caixa(M.liso, w * 0.7, 0.1, 0.34, 0, 0.42, -l / 2 + 0.24, { cor: '#e6e0d0' });
    s.caixa(M.liso, w, 0.75, 0.06, 0, 0, -l / 2, { cor: '#3b2f26' });
  });
}
export function vaso(b, M, x, z, ry = 0) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.38, 0.4, 0.18, 0, 0.3, -0.2, { cor: BRANCO });
    s.cilindro(M.liso, 0.19, 0.14, 0.4, 0, 0, 0.06, { seg: 12, cor: BRANCO });
  });
}
export function pia(b, M, x, z, ry = 0) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.5, 0.14, 0.4, 0, 0.76, 0, { cor: BRANCO });
    s.cilindro(M.liso, 0.07, 0.1, 0.76, 0, 0, -0.05, { seg: 8, cor: BRANCO });
  });
}
export function mesa(b, M, x, z, ry = 0, { w = 1, d = 1, h = 0.76, cor, pes = '#2a2622', acabamento = null } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(matDe(M, acabamento), w, 0.06, d, 0, h - 0.06, 0, { cor: corDe(acabamento, cor, '#5a4030') });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.caixa(M.liso, 0.06, h - 0.06, 0.06, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), { cor: pes });
  });
}
export function mesaRedonda(b, M, x, z, _ry, { r = 0.6, h = 0.74, cor = '#5a4030' } = {}) {
  b.cilindro(M.liso, r, r, 0.05, x, h - 0.05, z, { seg: 20, cor });
  b.cilindro(M.liso, 0.05, 0.22, h - 0.05, x, 0, z, { seg: 8, cor: '#2a2622' });
}
export function cadeira(b, M, x, z, ry = 0, { cor = '#3a3632' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.44, 0.05, 0.44, 0, 0.43, 0, { cor });
    s.caixa(M.liso, 0.44, 0.48, 0.05, 0, 0.46, -0.2, { cor });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.caixa(M.liso, 0.04, 0.43, 0.04, sx * 0.18, 0, sz * 0.18, { cor: '#1f1d1b' });
  });
}
export function banqueta(b, M, x, z, _ry, { cor = '#2a2826', h = 0.72 } = {}) {
  b.cilindro(M.liso, 0.17, 0.17, 0.05, x, h, z, { seg: 12, cor });
  b.cilindro(M.liso, 0.03, 0.13, h, x, 0, z, { seg: 8, cor: '#1f1d1b' });
}
export function sofa(b, M, x, z, ry = 0, { w = 0.85, cor = '#4a2c22' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, 0.42, 0.82, 0, 0, 0, { cor });
    s.caixa(M.liso, w, 0.45, 0.18, 0, 0.42, -0.32, { cor });
    for (const sx of [-1, 1]) s.caixa(M.liso, 0.14, 0.2, 0.82, sx * (w / 2 - 0.07), 0.42, 0, { cor });
  });
}
export function balcao(b, M, x, z, ry = 0, { w = 2, d = 0.6, h = 1.05, cor = '#3a2a20', tampo = '#6b1f1c' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, h - 0.05, d, 0, 0, 0, { cor });
    s.caixa(M.liso, w + 0.06, 0.05, d + 0.06, 0, h - 0.05, 0, { cor: tampo });
  });
}
// Estante encostada na parede (fundo em -Z), com objetos coloridos nas prateleiras.
export function estante(b, M, x, z, ry = 0, { w = 2, h = 2, d = 0.35, cor = '#3a2a20', itens = null, rng = Math.random } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, h, 0.04, 0, 0, -d / 2 + 0.02, { cor });
    for (const sx of [-1, 1]) s.caixa(M.liso, 0.04, h, d, sx * (w / 2 - 0.02), 0, 0, { cor });
    for (let y = 0.02; y < h; y += 0.42) {
      s.caixa(M.liso, w, 0.035, d, 0, y, 0, { cor });
      if (!itens || y + 0.4 > h) continue;
      for (let px = -w / 2 + 0.14; px < w / 2 - 0.1; px += 0.13 + rng() * 0.12) {
        const a = 0.14 + rng() * 0.18;
        s.caixa(M.liso, 0.07 + rng() * 0.05, a, 0.08, px, y + 0.035, 0.02, { cor: itens[Math.floor(rng() * itens.length)] });
      }
    }
  });
}
export function sinuca(b, M, x, z, ry = 0) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 1.56, 0.34, 2.76, 0, 0.5, 0, { cor: '#4a2c16' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.caixa(M.liso, 0.14, 0.5, 0.14, sx * 0.62, 0, sz * 1.2, { cor: '#3a2212' });
    s.caixa(M.liso, 1.3, 0.03, 2.5, 0, 0.84, 0, { cor: '#4aa83c' });
    for (const sx of [-1, 1]) s.caixa(M.liso, 0.13, 0.07, 2.76, sx * 0.715, 0.84, 0, { cor: '#4a2c16' });
    for (const sz of [-1, 1]) s.caixa(M.liso, 1.3, 0.07, 0.13, 0, 0.84, sz * 1.315, { cor: '#4a2c16' });
    const bolas = [['#c62828', 0.2, 0.5], ['#f5f5f0', -0.1, 0.9], ['#1b1b1b', 0.3, -0.3], ['#c62828', -0.3, -0.7], ['#e0a020', 0.1, -0.1]];
    for (const [cor, bx, bz] of bolas) s.esfera(M.liso, 0.03, bx, 0.87, bz, { cor });
  });
}
export function jukebox(b, M, x, z, ry = 0) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 0.85, 1.45, 0.55, 0, 0, 0, { cor: '#3a1210' });
    s.caixa(M.neonVermelho, 0.6, 0.55, 0.04, 0, 0.75, 0.28, { cor: '#ffffff' });
  });
}
export function caixote(b, M, x, z, ry = 0, { w = 0.8, h = 0.5, d = 0.6, cor, acabamento = null } = {}) {
  por(b, x, z, ry, (s) => s.caixa(matDe(M, acabamento), w, h, d, 0, 0, 0, { cor: corDe(acabamento, cor, '#3a3d2e') }));
}
export function maca(b, M, x, z, ry = 0, { cor = '#bfe3c0' } = {}) {
  por(b, x, z, ry, (s) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.caixa(M.metal, 0.04, 0.5, 0.04, sx * 0.38, 0, sz * 0.92, { cor: METAL });
    s.caixa(M.metal, 0.86, 0.05, 2, 0, 0.5, 0, { cor: METAL });
    s.caixa(M.liso, 0.8, 0.13, 1.92, 0, 0.55, 0, { cor });
    s.caixa(M.liso, 0.6, 0.08, 0.36, 0, 0.68, -0.72, { cor: '#eef3ee' });
    s.caixa(M.metal, 0.86, 0.5, 0.04, 0, 0.5, -1.0, { cor: METAL });
    s.cilindro(M.metal, 0.012, 0.012, 1.85, 0.55, 0, -0.85, { seg: 6, cor: METAL });
    s.caixa(M.liso, 0.12, 0.2, 0.05, 0.55, 1.6, -0.85, { cor: '#d8e6f0' });
  });
}
export function rackArmas(b, M, x, z, ry = 0, { w = 2, h = 1.8 } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, h, 0.06, 0, 0.3, 0, { cor: '#22241f' });
    for (let y = 0.55; y < h + 0.2; y += 0.3) s.caixa(M.metal, w * 0.8, 0.07, 0.07, 0, y, 0.07, { cor: '#15161a' });
  });
}
export function tela(b, M, x, y, z, ry = 0, { w = 1.2, h = 0.7 } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w + 0.08, h + 0.08, 0.05, 0, y, 0, { cor: '#0c0c0e' });
    s.caixa(M.fachada, w, h, 0.02, 0, y + 0.04, 0.03, { cor: '#6f8fc8' });
  });
}
export function vela(b, M, x, z) {
  b.cilindro(M.liso, 0.035, 0.04, 0.18, x, 0, z, { seg: 6, cor: '#e8e0c8' });
  b.esfera(M.lampada, 0.03, x, 0.18, z, { cor: '#ffffff', sy: 1.5 });
}
export function barril(b, M, x, z, _ry, { cor = '#4a3220' } = {}) {
  b.cilindro(M.liso, 0.3, 0.3, 0.85, x, 0, z, { seg: 12, cor });
}
export function lareira(b, M, x, z, ry = 0, { w = 2 } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, 1.2, 0.7, 0, 0, 0, { cor: '#55504a' });
    s.caixa(M.liso, w * 0.6, 0.6, 0.1, 0, 0.08, 0.33, { cor: '#0c0a08' });
    s.caixa(M.lampada, w * 0.4, 0.22, 0.06, 0, 0.1, 0.37, { cor: '#ff7a28' });
    s.caixa(M.liso, w + 0.2, 0.1, 0.8, 0, 1.2, 0, { cor: '#3a3632' });
  });
}
export function banheira(b, M, x, z, ry = 0, { cor = '#d8d2c4' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, 1.75, 0.55, 0.8, 0, 0.06, 0, { cor });
    s.caixa(M.liso, 1.55, 0.04, 0.6, 0, 0.59, 0, { cor: '#4a6a72' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.caixa(M.metal, 0.08, 0.08, 0.08, sx * 0.7, 0, sz * 0.3, { cor: '#8a7a4a' });
  });
}
// Castiçal de pé com vela acesa.
export function castical(b, M, x, z) {
  b.cilindro(M.metal, 0.02, 0.12, 1.3, x, 0, z, { seg: 6, cor: '#6a5a32' });
  b.cilindro(M.liso, 0.03, 0.03, 0.14, x, 1.3, z, { seg: 6, cor: '#e8e0c8' });
  b.esfera(M.lampada, 0.035, x, 1.44, z, { cor: '#ffffff', sy: 1.5 });
}
// Peças genéricas, para o que o kit não cobre.
export function alcapao(b, M, x, z, ry = 0, { w = 1.5, d = 1.6, cor = '#4a321e' } = {}) {
  por(b, x, z, ry, (s) => {
    s.caixa(M.liso, w, 0.08, d, 0, 0, 0, { cor });
    s.cilindro(M.metal, 0.22, 0.22, 0.04, 0, 0.08, 0, { seg: 16, cor: '#6a5a3a' });
  });
}
// Sarcófago de pedra: base e tampa com uma cumeeira. "aberto": a tampa fica deslocada, mostrando o vão. "acabamento" muda a pedra.
export function sarcofago(b, M, x, z, ry = 0, { w = 0.9, l = 2, h = 0.6, cor, aberto = false, acabamento = null } = {}) {
  por(b, x, z, ry, (s) => {
    const mat = matDe(M, acabamento), c = corDe(acabamento, cor, '#6f6a60');
    s.caixa(mat, w, h, l, 0, 0, 0, { cor: c });
    if (aberto) s.caixa(M.liso, w - 0.2, 0.04, l - 0.2, 0, h - 0.04, 0, { cor: '#14110e' });   // o vão escuro
    const tz = aberto ? l * 0.32 : 0;   // a tampa escorregada para um lado
    s.caixa(mat, w + 0.06, 0.12, l + 0.06, 0.0, h, tz, { cor: c });
    s.caixa(mat, w * 0.55, 0.08, l * 0.8, 0, h + 0.12, tz, { cor: c });
  });
}
// Ossário: um monte baixo de ossos e crânios. "w" e "d" são a área; "n" a quantidade de crânios (o resto são ossos longos).
export function ossario(b, M, x, z, ry = 0, { w = 1.2, d = 1.2, n = 5, cor = '#d8d0b8' } = {}) {
  por(b, x, z, ry, (s) => {
    let sem = 7; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    s.cilindro(M.liso, Math.min(w, d) * 0.5, Math.min(w, d) * 0.5, 0.06, 0, 0, 0, { seg: 12, cor: '#2b241c' });   // a mancha escura sob os ossos
    for (let i = 0; i < n; i++) s.esfera(M.liso, 0.1, (rnd() - 0.5) * w * 0.8, 0.12 + rnd() * 0.12, (rnd() - 0.5) * d * 0.8, { cor, sy: 1.1 });
    for (let i = 0; i < n * 3; i++) {
      const cx = (rnd() - 0.5) * w * 0.9, cz = (rnd() - 0.5) * d * 0.9, ang = rnd() * Math.PI, c = Math.cos(ang) * 0.22, sn = Math.sin(ang) * 0.22, y = 0.07 + rnd() * 0.08;
      s.tubo(M.liso, [cx - c, y, cz - sn], [cx + c, y, cz + sn], 0.025, 0.025, { seg: 5, cor });
    }
  });
}
// "alt" ergue a peça do chão (telhado sobre pilares, copa de árvore, quadro na parede).
export function caixa(b, M, x, z, ry = 0, { w = 1, h = 1, d = 1, cor, alt = 0, acabamento = null } = {}) {
  por(b, x, z, ry, (s) => s.caixa(matDe(M, acabamento), w, h, d, 0, alt, 0, { cor: corDe(acabamento, cor, '#5a4630') }));
}
export function cilindro(b, M, x, z, _ry, { r = 0.5, h = 1, cor, alt = 0, acabamento = null } = {}) {
  b.cilindro(matDe(M, acabamento), r, r, h, x, alt, z, { seg: 20, cor: corDe(acabamento, cor, '#5a4630') });
}
