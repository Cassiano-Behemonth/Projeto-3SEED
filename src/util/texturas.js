// Texturas: fotos PBR (Poly Haven, CC0) e texturas desenhadas em canvas.
import * as THREE from 'three';

const carregador = new THREE.TextureLoader();
let ANISO = 8;
export function definirAnisotropia(n) { ANISO = n; }

export function pbr(nome) {
  const cfg = (t, srgb) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = ANISO;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {
    map: cfg(carregador.load(`assets/texturas/${nome}_diff.jpg`), true),
    normalMap: cfg(carregador.load(`assets/texturas/${nome}_nor.jpg`), false),
  };
}

function tela(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repetir = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function ruido(g, w, h, n, alfa = 0.05) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alfa})` : `rgba(255,255,255,${alfa})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

const LUZES_JANELA = ['#ffcf87', '#ffe0ad', '#fff0d2', '#ffd9a0', '#ffc070', '#b9d2ff'];

// Atlas 8x8 de fachada residencial (parede clara para tingir + janela). Devolve cor e mapa de luz.
export function atlasFachada(rng, pAcesa = 0.34) {
  const N = 8, S = 128;
  const [c, g] = tela(N * S, N * S);
  const [ce, ge] = tela(N * S, N * S);
  g.fillStyle = '#dcd8d0'; g.fillRect(0, 0, N * S, N * S);
  ruido(g, N * S, N * S, 9000, 0.035);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, N * S, N * S);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * S, y = j * S;
    const wx = x + S * 0.24, wy = y + S * 0.2, ww = S * 0.52, wh = S * 0.5;
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, y + S - 4, S, 4);
    g.fillStyle = '#c4beb3'; g.fillRect(wx - 5, wy - 5, ww + 10, wh + 12);
    const grad = g.createLinearGradient(0, wy, 0, wy + wh);
    grad.addColorStop(0, '#2c3a47'); grad.addColorStop(1, '#151c23');
    g.fillStyle = grad; g.fillRect(wx, wy, ww, wh);
    g.strokeStyle = '#ece9e2'; g.lineWidth = 3; g.strokeRect(wx, wy, ww, wh);
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
    if (rng() < pAcesa) {
      ge.fillStyle = LUZES_JANELA[Math.floor(rng() * LUZES_JANELA.length)];
      ge.globalAlpha = 0.55 + rng() * 0.45;
      ge.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      ge.globalAlpha = 1;
      if (rng() < 0.5) { ge.fillStyle = 'rgba(0,0,0,0.45)'; ge.fillRect(wx + 2, wy + 2, (ww - 4) * (0.25 + rng() * 0.3), wh - 4); }
      ge.fillStyle = '#000'; ge.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
    }
  }
  return { map: tex(c, { repetir: true }), emissiveMap: tex(ce, { repetir: true }) };
}

// Pele de vidro da torre comercial (8x8 painéis).
export function atlasVidro(rng) {
  const N = 8, S = 64;
  const [c, g] = tela(N * S, N * S);
  const [ce, ge] = tela(N * S, N * S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, N * S, N * S);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * S, y = j * S, v = 14 + Math.floor(rng() * 14);
    g.fillStyle = `rgb(${v},${v + 4},${v + 9})`; g.fillRect(x, y, S, S);
    g.fillStyle = '#07090b'; g.fillRect(x, y, S, 3); g.fillRect(x, y, 2, S);
    if (rng() < 0.06) {
      // Sala acesa atrás do vidro fumê: brilho suave, mais forte no teto, com persiana.
      const gl = ge.createLinearGradient(0, y, 0, y + S);
      const tom = rng() < 0.5 ? '255,214,160' : '205,220,255';
      gl.addColorStop(0, `rgba(${tom},0.75)`); gl.addColorStop(0.55, `rgba(${tom},0.3)`); gl.addColorStop(1, `rgba(${tom},0.08)`);
      ge.fillStyle = gl; ge.fillRect(x + 3, y + 4, S - 5, S - 6);
      ge.fillStyle = 'rgba(0,0,0,0.5)';
      for (let k = 8; k < S - 4; k += 7) ge.fillRect(x + 3, y + k, S - 5, 2);
    }
  }
  return { map: tex(c, { repetir: true }), emissiveMap: tex(ce, { repetir: true }) };
}

// Vidraça de uma janela (moldura + travessas). Usada em painéis retos ou em arco.
export function vidraca({ moldura = '#efeae0', colunas = 2, linhas = 3, grade = false, luz = '#ffd596' } = {}) {
  const W = 128, H = 192;
  const [c, g] = tela(W, H);
  const [ce, ge] = tela(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#34424f'); grad.addColorStop(1, '#131a20');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const gl = ge.createRadialGradient(W / 2, H * 0.45, 8, W / 2, H * 0.5, H * 0.7);
  gl.addColorStop(0, luz); gl.addColorStop(1, '#5a3a14');
  ge.fillStyle = gl; ge.fillRect(0, 0, W, H);
  const riscar = (ctx, cor, esp) => {
    ctx.strokeStyle = cor; ctx.lineWidth = esp;
    for (let i = 1; i < colunas; i++) { ctx.beginPath(); ctx.moveTo((W * i) / colunas, 0); ctx.lineTo((W * i) / colunas, H); ctx.stroke(); }
    for (let j = 1; j < linhas; j++) { ctx.beginPath(); ctx.moveTo(0, (H * j) / linhas); ctx.lineTo(W, (H * j) / linhas); ctx.stroke(); }
    ctx.lineWidth = esp * 3.2; ctx.strokeRect(0, 0, W, H);
  };
  riscar(g, moldura, 5); riscar(ge, '#000', 5);
  if (grade) {
    for (const ctx of [g, ge]) {
      ctx.strokeStyle = ctx === g ? '#0c0d0e' : '#000'; ctx.lineWidth = 4;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((W * i) / 6, 0); ctx.lineTo((W * i) / 6, H); ctx.stroke(); }
    }
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}

// Vitral gótico (mosaico colorido com chumbo).
export function vitral(rng, redondo = false) {
  const W = redondo ? 256 : 128, H = 256;
  const [c, g] = tela(W, H);
  const paleta = ['#1f4fa8', '#2a6fd0', '#8f1d2c', '#c7902a', '#3b8f6b', '#5a2a8a', '#d6c27a'];
  g.fillStyle = '#0b0b10'; g.fillRect(0, 0, W, H);
  if (redondo) {
    const cx = W / 2, cy = H / 2;
    for (let anel = 4; anel >= 1; anel--) {
      const r0 = (anel - 1) * 30 + 8, r1 = anel * 30 + 4, n = anel * 6;
      for (let i = 0; i < n; i++) {
        g.fillStyle = paleta[Math.floor(rng() * paleta.length)];
        g.beginPath();
        g.arc(cx, cy, r1, (i / n) * Math.PI * 2 + 0.03, ((i + 1) / n) * Math.PI * 2 - 0.03);
        g.arc(cx, cy, r0, ((i + 1) / n) * Math.PI * 2 - 0.03, (i / n) * Math.PI * 2 + 0.03, true);
        g.fill();
      }
    }
    g.fillStyle = '#d6c27a'; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
  } else {
    const cw = W / 4, ch = H / 10;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) {
      g.fillStyle = paleta[Math.floor(rng() * paleta.length)];
      g.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4);
    }
    g.fillStyle = '#0b0b10'; g.fillRect(W / 2 - 3, 0, 6, H);
  }
  const t = tex(c);
  return { map: t, emissiveMap: t };
}

// Letreiro com texto. linhas: [{ t, tam, cor, peso }]
export function letreiro(linhas, { w = 1024, h = 128, fundo = '#1b1b1b', borda = null, fonte = 'Arial, Helvetica, sans-serif' } = {}) {
  const [c, g] = tela(w, h);
  if (fundo) { g.fillStyle = fundo; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
  if (borda) { g.strokeStyle = borda; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const total = linhas.reduce((s, l) => s + l.tam * 1.25, 0);
  let y = (h - total) / 2;
  for (const l of linhas) {
    g.font = `${l.peso ?? 700} ${l.tam}px ${l.fonte ?? fonte}`;
    g.fillStyle = l.cor ?? '#fff';
    y += l.tam * 0.625;
    g.fillText(l.t, w / 2, y, w * 0.94);
    y += l.tam * 0.625;
  }
  return tex(c);
}

// Quadra poliesportiva da escola.
export function quadra() {
  const W = 320, H = 560;
  const [c, g] = tela(W, H);
  g.fillStyle = '#b5552d'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3f7d4a'; g.fillRect(34, 34, W - 68, H - 68);
  ruido(g, W, H, 2500, 0.04);
  g.strokeStyle = '#f2f2ea'; g.lineWidth = 4;
  g.strokeRect(34, 34, W - 68, H - 68);
  g.beginPath(); g.moveTo(34, H / 2); g.lineTo(W - 34, H / 2); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 40, 0, Math.PI * 2); g.stroke();
  for (const s of [1, -1]) {
    const y0 = s > 0 ? 34 : H - 34;
    g.strokeRect(W / 2 - 34, s > 0 ? y0 : y0 - 62, 68, 62);
    g.beginPath(); g.arc(W / 2, y0, 96, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : Math.PI * 2); g.stroke();
  }
  return tex(c);
}

// Mancha radial suave: poças de luz dos postes (aditiva) e sombras de contato.
export function brilho(preto = false) {
  const S = 128;
  const [c, g] = tela(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  const k = preto ? '0,0,0' : '255,255,255';
  gr.addColorStop(0, `rgba(${k},1)`); gr.addColorStop(0.22, `rgba(${k},0.55)`); gr.addColorStop(0.55, `rgba(${k},0.14)`); gr.addColorStop(1, `rgba(${k},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

// Telão do palco da rave.
export function telao() {
  const W = 256, H = 128;
  const [c, g] = tela(W, H);
  g.fillStyle = '#12051f'; g.fillRect(0, 0, W, H);
  for (let r = 60; r > 4; r -= 9) {
    g.strokeStyle = r % 18 === 6 ? '#ff5cf0' : '#8a3dff'; g.lineWidth = 4;
    g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#ffd0ff'; g.beginPath(); g.arc(W / 2, H / 2, 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3aa0ff'; g.lineWidth = 3;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(10 + i * 14, 20); g.lineTo(70 + i * 6, 108); g.stroke(); g.beginPath(); g.moveTo(W - 10 - i * 14, 20); g.lineTo(W - 70 - i * 6, 108); g.stroke(); }
  const t = tex(c);
  return { map: t, emissiveMap: t };
}

// Mostrador de relógio de parede.
export function relogio() {
  const S = 128;
  const [c, g] = tela(S, S);
  g.fillStyle = '#d8d2bf'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * 46, S / 2 + Math.sin(a) * 46); g.lineTo(S / 2 + Math.cos(a) * 54, S / 2 + Math.sin(a) * 54); g.stroke();
  }
  g.lineWidth = 5; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + 4, S / 2 - 34); g.stroke();
  g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 - 24, S / 2 + 10); g.stroke();
  const t = tex(c);
  return { map: t, emissiveMap: t };
}
