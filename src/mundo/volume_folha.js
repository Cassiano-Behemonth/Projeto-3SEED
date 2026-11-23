// Volume esculpido pelas silhuetas de uma folha de quatro vistas (frente, lateral direita, fundos e vista de cima).
// Mesma ideia de Planta.folha (prédios): o objeto é cortado em fatias horizontais e, em cada fatia, só existe onde a vista
// de frente E a de lado têm desenho. Aqui, para objetos que se movem (carros, armadilhas), as fatias são arredondadas:
//  - em planta, cada fatia é um retângulo de cantos arredondados (raio = "redondo" x a menor meia-medida);
//  - na vertical, as fatias não fazem degrau: o anel de baixo e o de cima de cada fatia ficam na média com o da vizinha,
//    então as laterais sobem em rampa, como uma carroceria de verdade;
//  - a arte entra por projeção planar (frente/fundos pela posição x, lado pela posição z), contínua de uma fatia para outra.
// A folha é um PNG com transparência (fundo já tirado) e as vistas em retângulos F, S, B e T, em pixels.
// A frente do objeto fica em +z; a vista lateral tem a frente à esquerda; a vista de cima, também.
import * as THREE from 'three';

const prontos = new Map();
const ARCO = 5; // segmentos em cada canto arredondado

export function volumeDeFolha(url, { F, S, B, T, W, H, D, fatias = 96, suaviza = 7, redondo = 0.5, plano = false, cruzado = false }) {
  const chave = url + JSON.stringify([F, S, B, T, W, H, D, fatias, suaviza, redondo, plano, cruzado]);
  if (!prontos.has(chave)) prontos.set(chave, new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error(`volume: não consegui ler ${url}`));
    img.onload = () => {
      const c = document.createElement('canvas'), iw = (c.width = img.width), ih = (c.height = img.height);
      const g2 = c.getContext('2d', { willReadFrequently: true }); g2.drawImage(img, 0, 0);
      const px = g2.getImageData(0, 0, iw, ih).data;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      // Trechos com desenho numa vista, entre duas alturas (t de 0, no pé, a 1, no topo): pares [coluna inicial, final).
      const trechos = (r, t0, t1) => {
        const l0 = Math.max(0, Math.round(r[3] - t1 * (r[3] - r[1]))), l1 = Math.min(ih, Math.max(l0 + 1, Math.round(r[3] - t0 * (r[3] - r[1]))));
        const out = []; let ini = -1, vazio = 0;
        for (let col = r[0]; col <= r[2]; col++) {
          let tem = false;
          if (col < r[2]) for (let l = l0; l < l1; l++) if (px[(l * iw + col) * 4 + 3] > 127) { tem = true; break; }
          if (tem) { if (ini < 0) ini = col; vazio = 0; }
          else if (ini >= 0 && (++vazio > 2 || col === r[2])) { const fim = col - vazio + 1; if (fim - ini >= 2) out.push([ini, fim]); ini = -1; vazio = 0; }
        }
        return out;
      };
      const cortes = []; for (let k = 0; k < fatias; k++) cortes.push([trechos(F, k / fatias, (k + 1) / fatias), trechos(S, k / fatias, (k + 1) / fatias)]);
      // A borda de um desenho oscila de uma fatia para a outra; diferenças de até "suaviza" px seguem a fatia de baixo.
      for (let k = 1; k < fatias; k++) for (const v of [0, 1]) for (const t of cortes[k][v]) for (const i of [0, 1]) {
        let perto = null; for (const q of cortes[k - 1][v]) if (Math.abs(q[i] - t[i]) <= suaviza && (perto === null || Math.abs(q[i] - t[i]) < Math.abs(perto - t[i]))) perto = q[i];
        if (perto !== null) t[i] = perto;
      }
      // Retrovisores e partes soltas: numa fatia com um trecho largo (o corpo), os trechos estreitos ao lado dele (menos de 22% da
      // vista) não viram volume, senão cruzados com a outra vista viram lâminas ao longo do objeto. Onde não há trecho largo
      // (as duas rodas, por exemplo), todos ficam.
      for (const fa of cortes) for (const [v, r] of [[0, F], [1, S]]) {
        const total = r[2] - r[0], larg = fa[v].some(([p, q]) => q - p > 0.5 * total);
        if (larg && fa[v].length > 1) fa[v] = fa[v].filter(([p, q]) => q - p >= 0.22 * total);
      }
      // Abas finas: uma saliência de poucas fatias (retrovisor, aba da tampa do porta-malas, antena) cruzada com a outra vista
      // vira uma lâmina larga ao longo do objeto. Nas faixas de altura com um só trecho em cada vista, cada extremo passa por
      // uma mediana vertical (janela de 9 fatias): picos curtos somem, e as rampas de verdade (para-brisa, capô) ficam.
      const mediana = (v, i, w) => { const s = v.slice(Math.max(0, i - w), Math.min(v.length, i + w + 1)).sort((p, q) => p - q); return s[s.length >> 1]; };
      for (let k = 0; k < fatias;) {
        if (cortes[k][0].length !== 1 || cortes[k][1].length !== 1) { k++; continue; }
        let e = k; while (e + 1 < fatias && cortes[e + 1][0].length === 1 && cortes[e + 1][1].length === 1) e++;
        for (const [vista, lado] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
          const serie = []; for (let j = k; j <= e; j++) serie.push(cortes[j][vista][0][lado]);
          // depois da mediana, médias móveis suaves: sem elas a mediana deixa patamares e cada degrau pega luz como uma persiana
          let s2 = serie.map((_, i) => mediana(serie, i, 4));
          for (let passo = 0; passo < 4; passo++) s2 = s2.map((_, i) => { let soma = 0, n = 0; for (let j = Math.max(0, i - 3); j <= Math.min(s2.length - 1, i + 3); j++) { soma += s2[j]; n++; } return soma / n; });
          for (let j = k; j <= e; j++) cortes[j][vista][0][lado] = s2[j - k];
        }
        k = e + 1;
      }
      // Extensões (metros) de cada combinação frente x lado de cada fatia.
      const ext = cortes.map(([fr, sr]) => {
        const lista = [];
        for (const [a0, a1] of fr) for (const [b0, b1] of sr) lista.push({
          x0: -W / 2 + ((a0 - F[0]) / (F[2] - F[0])) * W, x1: -W / 2 + ((a1 - F[0]) / (F[2] - F[0])) * W,
          zf: D / 2 - ((b0 - S[0]) / (S[2] - S[0])) * D, zb: D / 2 - ((b1 - S[0]) / (S[2] - S[0])) * D,
        });
        return lista;
      });
      // A combinação da fatia vizinha que mais se sobrepõe a esta (ou null).
      const vizinha = (e, lista) => {
        let melhor = null, area = 0;
        for (const q of lista ?? []) {
          const ox = Math.min(e.x1, q.x1) - Math.max(e.x0, q.x0), oz = Math.min(e.zf, q.zf) - Math.max(e.zb, q.zb);
          if (ox > 0 && oz > 0 && ox * oz > area) { area = ox * oz; melhor = q; }
        }
        return melhor;
      };
      const media = (e, q) => (q ? { x0: (e.x0 + q.x0) / 2, x1: (e.x1 + q.x1) / 2, zf: (e.zf + q.zf) / 2, zb: (e.zb + q.zb) / 2 } : e);
      // Anel de cantos arredondados, no sentido de a = 0 (+x) para +z.
      const anel = (e, y) => {
        const r = Math.max(0, redondo * Math.min((e.x1 - e.x0) / 2, (e.zf - e.zb) / 2)), pts = [];
        for (const [cx, cz, a0] of [[e.x1 - r, e.zf - r, 0], [e.x0 + r, e.zf - r, 90], [e.x0 + r, e.zb + r, 180], [e.x1 - r, e.zb + r, 270]])
          for (let s = 0; s <= ARCO; s++) { const a = ((a0 + (90 * s) / ARCO) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]); }
        return pts;
      };
      const linha = (r, y) => r[3] - (y / H) * (r[3] - r[1]);
      const uvFrente = (x, y) => [F[0] + ((x + W / 2) / W) * (F[2] - F[0]), linha(F, y)];
      const uvFundos = (x, y) => [B[0] + ((W / 2 - x) / W) * (B[2] - B[0]), linha(B, y)]; // vista por trás: espelhada
      const uvLado = (z, y) => [S[0] + ((D / 2 - z) / D) * (S[2] - S[0]), linha(S, y)];
      const tw = T[2] - T[0], th = T[3] - T[1];
      const uvCima = (x, z) => [T[2] - ((z + D / 2) / D) * tw, T[1] + ((x + W / 2) / W) * th]; // frente à esquerda, lado +x embaixo
      const pos = [], uv = [];
      const vert = (p, u) => { pos.push(p[0], p[1], p[2]); uv.push(u[0] / iw, 1 - u[1] / ih); };
      if (cruzado) { // objeto vazado (armadilha): três planos que se cruzam, com a vista de cima, a de frente e a lateral
        const yy = 0.03, tri = (cs, uvs) => { for (const i of [0, 1, 2, 0, 2, 3]) vert(cs[i], uvs[i]); };
        tri([[-W / 2, yy, D / 2], [W / 2, yy, D / 2], [W / 2, yy, -D / 2], [-W / 2, yy, -D / 2]], [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]].map(([x, z]) => uvCima(x, z)));
        tri([[-W / 2, 0, 0], [W / 2, 0, 0], [W / 2, H, 0], [-W / 2, H, 0]], [[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]].map(([x, y]) => uvFrente(x, y)));
        tri([[0, 0, D / 2], [0, 0, -D / 2], [0, H, -D / 2], [0, H, D / 2]], [[D / 2, 0], [-D / 2, 0], [-D / 2, H], [D / 2, H]].map(([z, y]) => uvLado(z, y)));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
        resolve({ geometria: g, textura: tex }); return;
      }
      if (plano) { // objeto baixo e chato (armadilha no chão): só a vista de cima, deitada um pouco acima do chão
        const yy = 0.03, cs = [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]];
        for (const i of [0, 1, 2, 0, 2, 3]) vert([cs[i][0], yy, cs[i][1]], uvCima(cs[i][0], cs[i][1]));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
        resolve({ geometria: g, textura: tex }); return;
      }
      for (let k = 0; k < fatias; k++) {
        const y0 = (k / fatias) * H, y1 = ((k + 1) / fatias) * H;
        for (const e of ext[k]) {
          const abaixo = k > 0 ? vizinha(e, ext[k - 1]) : null, acima = k < fatias - 1 ? vizinha(e, ext[k + 1]) : null;
          const base = anel(media(e, abaixo), y0), topo = anel(media(e, acima), y1), n = base.length;
          for (let j = 0; j < n; j++) {
            const j2 = (j + 1) % n, b0 = base[j], b1 = base[j2], t0 = topo[j], t1 = topo[j2];
            const dx = b1[0] - b0[0], dz = b1[2] - b0[2], mz = (b0[2] + b1[2]) / 2;
            if (Math.abs(dx) + Math.abs(dz) < 1e-6 && Math.abs(t1[0] - t0[0]) + Math.abs(t1[2] - t0[2]) < 1e-6) continue;
            // Faces que olham mais para cima do que para o lado (capô, para-brisa, teto, vidro de trás) levam a vista de cima;
            // as de lado levam a vista lateral (correm ao longo de z) ou a de frente/fundos (as outras).
            const ex = dx, ez = dz, ux = t0[0] - b0[0], uy = t0[1] - b0[1], uz = t0[2] - b0[2];
            const nx = -ez * uy, ny = ez * ux - ex * uz, nz = ex * uy, nl = Math.hypot(nx, ny, nz);
            const paraCima = nl > 1e-9 && Math.abs(ny) / nl > 0.72;
            const uvDe = paraCima ? (p) => uvCima(p[0], p[2]) : Math.abs(dz) >= Math.abs(dx) ? (p) => uvLado(p[2], p[1]) : mz >= 0 ? (p) => uvFrente(p[0], p[1]) : (p) => uvFundos(p[0], p[1]);
            vert(b1, uvDe(b1)); vert(b0, uvDe(b0)); vert(t0, uvDe(t0));
            vert(b1, uvDe(b1)); vert(t0, uvDe(t0)); vert(t1, uvDe(t1));
          }
          // Tampas: o topo da fatia só onde nada a cobre; a base só onde ela avança além da fatia de baixo (a base do objeto fica aberta).
          const tampa = (a, cima) => {
            const cx = a.reduce((s, p) => s + p[0], 0) / a.length, cz = a.reduce((s, p) => s + p[2], 0) / a.length, c0 = [cx, a[0][1], cz];
            for (let j = 0; j < a.length; j++) {
              const p = a[j], q = a[(j + 1) % a.length];
              const [u0, u1, u2] = [uvCima(cx, cz), uvCima(p[0], p[2]), uvCima(q[0], q[2])];
              if (cima) { vert(c0, u0); vert(q, u2); vert(p, u1); } else { vert(c0, u0); vert(p, u1); vert(q, u2); }
            }
          };
          if (!acima) tampa(topo, true);
          if (k > 0 && !abaixo) tampa(base, false);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      resolve({ geometria: g, textura: tex });
    };
    img.src = url;
  }));
  return prontos.get(chave);
}
