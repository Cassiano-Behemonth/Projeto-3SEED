// Acabamentos de parede dos interiores: papel de parede com lambri (mansão), tábuas (bar),
// concreto (base) e pedra (subsolo). Cada material traz o tamanho do ladrilho:
// tile[0] = metros por repetição ao longo da parede; tile[1] = fração da altura por repetição.
import * as THREE from 'three';
import { ALTURA_PAREDE } from './medidas.js';

const cache = new Map();

function textura(desenhar, w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const ruido = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 5); } };

// Papel de parede floral envelhecido em cima, lambri de madeira escura embaixo.
function papelDeParede(g, w, h) {
  const corte = h * (1 - 1.15 / ALTURA_PAREDE); // lambri de 1,15 m embaixo; o resto, para cima, é papel
  g.fillStyle = '#a8977a'; g.fillRect(0, 0, w, corte);
  for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(120,90,50,0.07)'; g.fillRect(x, 0, 14, corte); }
  const flor = (x, y, r) => {
    g.fillStyle = '#5f7048'; g.beginPath(); g.ellipse(x - r * 1.5, y + r * 0.9, r * 1.1, r * 0.45, -0.5, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(x + r * 1.5, y + r * 0.9, r * 1.1, r * 0.45, 0.5, 0, 6.3); g.fill();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283; g.fillStyle = k % 2 ? '#8a3a34' : '#9c4a40'; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, 0, 6.3); g.fill(); }
    g.fillStyle = '#c98a5a'; g.beginPath(); g.arc(x, y, r * 0.38, 0, 6.3); g.fill();
  };
  // Estampa miúda e cerrada, como papel de parede antigo.
  // O canvas é mais alto que largo na mesma proporção da parede, então as flores saem sem esticar.
  for (let j = 0; j * 44 + 24 < corte - 10; j++) for (let i = 0; i < 8; i++) flor(i * 64 + (j % 2 ? 48 : 16), 24 + j * 44, 6.5);
  ruido(g, w, corte, 2600, 0.05);
  // Lambri: réguas verticais, friso em cima e rodapé.
  g.fillStyle = '#44291a'; g.fillRect(0, corte, w, h - corte);
  for (let x = 0; x < w; x += 64) { g.fillStyle = '#2c1a10'; g.fillRect(x, corte, 4, h - corte); g.fillStyle = 'rgba(255,220,170,0.05)'; g.fillRect(x + 6, corte + 22, 50, h - corte - 50); }
  ruido(g, w, h, 1800, 0.04);
  g.fillStyle = '#2a1810'; g.fillRect(0, corte, w, 12); g.fillRect(0, h - 22, w, 22);
  g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(0, corte + 12, w, 3);
}
function tabuas(g, w, h) {
  g.fillStyle = '#3a2416'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 48) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,210,160'},${0.02 + Math.random() * 0.04})`; g.fillRect(x, 0, 46, h); g.fillStyle = '#1c110a'; g.fillRect(x + 46, 0, 2, h); }
  ruido(g, w, h, 2400, 0.05);
  g.fillStyle = '#20130b'; g.fillRect(0, h - 26, w, 26);
}

// Chapas de metal rebitadas (base militar, galpão, navio de ferro).
function metal(g, w, h) {
  g.fillStyle = '#7d848c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + Math.random() * 0.05})`; g.fillRect(x + 2, y + 2, 124, 124);
    g.fillStyle = '#4d5359'; g.fillRect(x, y, 128, 3); g.fillRect(x, y, 3, 128);
    g.fillStyle = '#b9c0c8'; for (const [rx, ry] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { g.beginPath(); g.arc(x + rx, y + ry, 3, 0, 6.3); g.fill(); }
  }
  ruido(g, w, h, 2200, 0.05);
  g.fillStyle = 'rgba(40,30,20,0.25)'; g.fillRect(0, h - 30, w, 30);
}
// Reboco branco com esteios de madeira escura (casa japonesa, enxaimel) e base de madeira.
function reboco(g, w, h) {
  g.fillStyle = '#e4dccb'; g.fillRect(0, 0, w, h);
  ruido(g, w, h, 2600, 0.04);
  g.fillStyle = '#2e2018';
  for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 12, h);
  g.fillRect(0, 0, w, 14); g.fillRect(0, h * 0.5, w, 10); g.fillRect(0, h - 70, w, 70);
  for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,220,170,0.06)'; g.fillRect(x + 2, h - 66, 26, 62); }
}
// Blocos de gelo e neve socada.
function gelo(g, w, h) {
  g.fillStyle = '#dfeaf2'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < w; x += 128) {
    g.fillStyle = `rgba(120,170,210,${0.08 + Math.random() * 0.12})`; g.fillRect(x + 2, y + 2, 124, 60);
    g.fillStyle = 'rgba(90,130,170,0.5)'; g.fillRect(x, y, 128, 2); g.fillRect(x, y, 2, 64);
  }
  ruido(g, w, h, 1800, 0.05);
}

// Tijolo aparente: fiadas de 6,5 cm com junta de argamassa, cada tijolo num tom.
function tijolo(g, w, h) {
  g.fillStyle = '#b8ad9c'; g.fillRect(0, 0, w, h);
  const bw = 64, bh = 21;
  for (let j = 0, y = 0; y < h; j++, y += bh + 3) for (let x = j % 2 ? -bw / 2 : 0; x < w; x += bw + 3) {
    const t = Math.random(); g.fillStyle = `rgb(${150 + t * 50 | 0},${72 + t * 30 | 0},${52 + t * 24 | 0})`; g.fillRect(x, y, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + bh - 4, bw, 4);
  }
  ruido(g, w, h, 2600, 0.05);
}

// Pedra velha de ruína: silhares irregulares, escorridos escuros, musgo (mais denso no pé) e rachaduras.
function ruina(g, w, h) {
  g.fillStyle = '#7a756c'; g.fillRect(0, 0, w, h);
  for (let y = 0, j = 0; y < h; j++) {
    const bh = 34 + Math.random() * 22;
    for (let x = j % 2 ? -40 : 0; x < w;) {
      const bw = 60 + Math.random() * 60, t = Math.random();
      g.fillStyle = `rgb(${105 + t * 45 | 0},${100 + t * 42 | 0},${92 + t * 38 | 0})`; g.fillRect(x + 2, y + 2, bw - 3, bh - 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 2, y + bh - 6, bw - 3, 4);
      x += bw;
    }
    y += bh;
  }
  // Escorridos de chuva.
  for (let i = 0; i < 26; i++) { const x = Math.random() * w, l = 60 + Math.random() * 380, y0 = Math.random() * h * 0.7; const gr = g.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, 'rgba(20,18,14,0.38)'); gr.addColorStop(1, 'rgba(20,18,14,0)'); g.fillStyle = gr; g.fillRect(x, y0, 5 + Math.random() * 16, l); }
  // Musgo: manchas por toda a parede, bem mais densas no terço de baixo.
  const mancha = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = 60 + Math.random() * 40 | 0; gr.addColorStop(0, `rgba(${v * 0.55 | 0},${v},${v * 0.35 | 0},0.75)`); gr.addColorStop(1, 'rgba(40,70,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
  for (let i = 0; i < 70; i++) mancha(Math.random() * w, Math.random() * h, 10 + Math.random() * 26);
  for (let i = 0; i < 260; i++) mancha(Math.random() * w, h - Math.random() ** 2 * h * 0.3, 12 + Math.random() * 34);
  // Rachaduras: linhas quebradas que descem em zigue-zague, com ramos.
  const rachar = (x, y, n, esp) => { g.strokeStyle = 'rgba(12,10,8,0.85)'; g.lineWidth = esp; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < n; k++) { x += (Math.random() - 0.5) * 34; y += 14 + Math.random() * 26; g.lineTo(x, y); if (esp > 1.5 && Math.random() < 0.22) { g.stroke(); rachar(x, y, 5, 1.2); g.strokeStyle = 'rgba(12,10,8,0.85)'; g.lineWidth = esp; g.beginPath(); g.moveTo(x, y); } } g.stroke(); };
  for (let i = 0; i < 5; i++) rachar(Math.random() * w, Math.random() * h * 0.5, 14 + Math.random() * 10 | 0, 2.6);
  ruido(g, w, h, 5000, 0.06);
}

// Textura vinda de um arquivo (uma foto, ou um quadro de um atlas): o mapa registra com um nome e usa como acabamento.
// recorte: [x0, y0, x1, y1] dentro da imagem; metros: quantos metros um quadro cobre antes de repetir.
export function registrarTextura(nome, { imagem, recorte = null, metros = 3 }) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#777'; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const img = new Image();
  img.onload = () => { const [x0, y0, x1, y1] = recorte ?? [0, 0, img.width, img.height]; g.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, 512, 512); t.needsUpdate = true; };
  img.onerror = () => console.warn(`Textura "${nome}": não consegui ler ${imagem}`);
  img.src = imagem;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, vertexColors: true });
  mat.userData.tile = [metros, metros / ALTURA_PAREDE];
  cache.set(nome, mat);
  return mat;
}

// Nome do acabamento -> material com textura fotográfica de assets/texturas (ver materiais.js).
const PACOTES = {
  paralelepipedo: 'pedra', pisoPraca: 'pisoPraca', grama: 'grama', asfalto: 'asfalto', calcada: 'calcada',
  telhaBarro: 'telha', ardosiaFoto: 'ardosia', arenito: 'arenito', pedraMuro: 'pedraMuro', rebocoBranco: 'reboco', concretoParede: 'concreto',
};
export const NOMES_PACOTES = Object.keys(PACOTES);

// O mesmo acabamento com a textura repetindo igual nos dois sentidos: para chão, tampos e peças (fonte, portão).
// Nas paredes a repetição vertical é uma fração da altura da parede, o que esticaria a textura numa peça baixa.
export function acabamentoQuadrado(M, nome, duplo = false) {
  const chave = nome + (duplo ? '#q2' : '#q');
  if (cache.has(chave)) return cache.get(chave);
  const base = acabamento(M, nome), t = base.userData.tile[0], mat = base.clone();
  mat.userData = { tile: [t, t] };
  if (duplo) mat.side = THREE.DoubleSide;
  cache.set(chave, mat);
  return mat;
}

export function acabamento(M, nome) {
  if (cache.has(nome)) return cache.get(nome);
  let mat;
  if (nome === 'mansao') {
    mat = new THREE.MeshStandardMaterial({ map: textura(papelDeParede, 512, Math.round((512 * ALTURA_PAREDE) / 1.7)), roughness: 0.92, vertexColors: true });
    mat.userData.tile = [1.7, 1];
  } else if (nome === 'tabuas') {
    mat = new THREE.MeshStandardMaterial({ map: textura(tabuas), roughness: 0.85, vertexColors: true });
    mat.userData.tile = [2.2, 1];
  } else if (PACOTES[nome] && M[PACOTES[nome]]) {
    // Texturas fotográficas dos pacotes (assets/texturas), com o nome em português.
    const base = M[PACOTES[nome]], t = base.userData.tile[0];
    mat = base.clone(); mat.userData = { tile: [t, t / ALTURA_PAREDE] };
  } else if (nome === 'ruina') {
    mat = new THREE.MeshStandardMaterial({ map: textura(ruina, 512, 1024), roughness: 0.95, vertexColors: true });
    mat.userData.tile = [5, 10 / ALTURA_PAREDE]; // repete a cada 5 m na largura e 10 m na altura (o musgo fica no pé)
  } else if (nome === 'tijolo') {
    mat = new THREE.MeshStandardMaterial({ map: textura(tijolo), roughness: 0.9, vertexColors: true });
    mat.userData.tile = [1.7, 1.7 / ALTURA_PAREDE];
  } else if (nome === 'metal') {
    mat = new THREE.MeshStandardMaterial({ map: textura(metal), roughness: 0.55, metalness: 0.35, vertexColors: true });
    mat.userData.tile = [2.4, 2.4 / ALTURA_PAREDE];
  } else if (nome === 'reboco') {
    mat = new THREE.MeshStandardMaterial({ map: textura(reboco), roughness: 0.92, vertexColors: true });
    mat.userData.tile = [2.4, 1];
  } else if (nome === 'gelo') {
    mat = new THREE.MeshStandardMaterial({ map: textura(gelo), roughness: 0.5, vertexColors: true });
    mat.userData.tile = [3, 3 / ALTURA_PAREDE];
  } else if (nome === 'madeira') {
    mat = new THREE.MeshStandardMaterial({ map: textura(tabuas), roughness: 0.85, vertexColors: true });
    mat.userData.tile = [2.2, 1];
  } else if (nome === 'pedra') {
    mat = M.pedraMuro.clone(); mat.userData = { tile: [3.5, 3.5 / ALTURA_PAREDE] };
  } else {
    mat = M.concreto.clone(); mat.color = new THREE.Color(1.5, 1.5, 1.5); mat.userData = { tile: [5, 5 / ALTURA_PAREDE] };
  }
  cache.set(nome, mat);
  return mat;
}
