// Monta um interior a partir da planta 2D original: a imagem vira o piso e as medidas
// são dadas em pixels dessa imagem (assim móveis e paredes caem em cima do desenho).
import * as THREE from 'three';
import { Construtor, geoCaixa, geoFaces, polysDuasAguas, polysQuatroAguas, polysEmpenas } from '../../util/construtor.js';
import { acabamento, acabamentoQuadrado } from './acabamentos.js';

import { ALTURA_PAREDE, ALTURA_PORTA } from './medidas.js';
import { dentroDe } from './formato.js';

const carregador = new THREE.TextureLoader();
const LOTE_MATA = 32; // lado, em metros, de cada lote de árvores (ver Planta.arvore)

// Folhas de prédio já recortadas, por arquivo. O fundo liso sai por "inundação" a partir das bordas da imagem:
// só vira transparente o que se liga à borda com a cor do canto, então o cinza de dentro do prédio fica.
const folhasProntas = new Map();
function recortarFolha(url, tol, pronto) {
  const chave = url + '|' + tol;
  let reg = folhasProntas.get(chave);
  if (reg) { if (reg.tex) pronto(reg.tex, reg.w, reg.h, reg.px); else reg.fila.push(pronto); return; }
  reg = { tex: null, w: 0, h: 0, px: null, fila: [pronto] }; folhasProntas.set(chave, reg);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), W = (c.width = img.width), H = (c.height = img.height);
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const dados = g.getImageData(0, 0, W, H), px = dados.data, lim = tol * 255, r0 = px[0], g0 = px[1], b0 = px[2];
    const fundo = new Uint8Array(W * H), pilha = new Int32Array(W * H); let n = 0;
    // O fundo pode ser um degradê: cada pixel é comparado com o vizinho de onde a inundação veio (passo curto)
    // e, de longe, com a cor do canto.
    const longe = lim * 3, passo = Math.max(4, lim / 3);
    const por = (i, de) => {
      if (fundo[i]) return;
      const k = i * 4;
      if (Math.abs(px[k] - r0) > longe || Math.abs(px[k + 1] - g0) > longe || Math.abs(px[k + 2] - b0) > longe) return;
      if (de >= 0) { const q = de * 4; if (Math.abs(px[k] - px[q]) > passo || Math.abs(px[k + 1] - px[q + 1]) > passo || Math.abs(px[k + 2] - px[q + 2]) > passo) return; }
      fundo[i] = 1; pilha[n++] = i;
    };
    for (let x = 0; x < W; x++) { por(x, -1); por((H - 1) * W + x, -1); }
    for (let y = 0; y < H; y++) { por(y * W, -1); por(y * W + W - 1, -1); }
    while (n) { const i = pilha[--n], x = i % W; if (x > 0) por(i - 1, i); if (x < W - 1) por(i + 1, i); if (i >= W) por(i - W, i); if (i < W * (H - 1)) por(i + W, i); }
    // Tira também um pixel da beira, que mistura a cor do fundo.
    for (let i = 0; i < W * H; i++) { const x = i % W; if (fundo[i] || (x > 0 && fundo[i - 1]) || (x < W - 1 && fundo[i + 1]) || (i >= W && fundo[i - W]) || (i < W * (H - 1) && fundo[i + W])) px[i * 4 + 3] = 0; }
    g.putImageData(dados, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    reg.tex = tex; reg.w = W; reg.h = H; reg.px = px; for (const f of reg.fila) f(tex, W, H, px); reg.fila = [];
  };
  img.onerror = () => console.warn(`Folha de prédio: não consegui ler ${url}`);
  img.src = url;
}
export { ALTURA_PAREDE };

export class Planta {
  // topo: cor da tampa das paredes. Nos interiores é preta (parede "cortada"); a céu aberto, 'parede' usa a cor da própria parede.
  constructor(M, { imagem, imagemNoite = null, larguraPx, alturaPx, escala, parede = null, topo = '#0b0b0c', alturaMax = ALTURA_PAREDE }) {
    this.topo = topo;
    this.alturaMax = alturaMax; // sem teto, um muro pode passar do pé-direito
    this.brilho = 1;
    this.imagemPredios = null;
    this.matsChao = []; // materiais dos decalques, que acompanham a luz do piso
    this.estilo = parede; // acabamento padrão das paredes (ver acabamentos.js); null = cor lisa
    this.M = M; this.W = larguraPx; this.H = alturaPx; this.E = escala; this.imagem = imagem; this.imagemNoite = imagemNoite;
    this.b = new Construtor(); // piso e móveis
    this.mata = new Map(); // árvores, em lotes de LOTE_MATA metros (ver arvore())
    this.p = new Construtor(); // paredes (altura 1, esticadas depois)
    this.portas = []; this.salas = {}; this.soltos = []; this.soltosParede = [];
    this.muros = []; // segmentos sólidos para a colisão (paredes, grades)
    this.plataformas = []; // pisos elevados
    this.predios = []; // prédios que levam a pintura no telhado
    this.fachadas = []; // frentes pintadas, aplicadas em pé
    this.recortes = { pos: [], uv: [] }; // frentes recortadas pela silhueta (torres e pontas contra o céu)
    this.bal = null; // conjunto que balança (um navio): contorno, peças e paredes próprias
    this.anims = []; // animações das peças (radar que gira, luz que pisca)
    this.desafios = new Map(); // desafios do mapa (ver desafio()): nome -> peças de antes e de depois
    // Luz vermelha que pisca, compartilhada pelas peças que a usam.
    this.matPisca = new THREE.MeshStandardMaterial({ color: 0x2a0806, emissive: 0xff2a1a, emissiveIntensity: 3 });
    this.anims.push((t) => { this.matPisca.emissiveIntensity = (t * 0.8) % 1 < 0.5 ? 3.2 : 0.15; });
  }
  X(px) { return (px - this.W / 2) * this.E; }
  Z(py) { return (py - this.H / 2) * this.E; }

  // Parede entre dois pontos da planta (qualquer ângulo).
  // altura (em metros) faz um muro mais baixo que o pé-direito; sem ela, a parede vai até o teto.
  // base (em metros) ergue a parede do chão: é o piso da plataforma onde ela está.
  parede(x1, y1, x2, y2, { esp = 0.22, cor, estilo = this.estilo, altura = null, base = 0, balanco = false } = {}) {
    const alvo = balanco && this.bal ? this.bal.p : this.p;
    const hf = altura ? Math.min(this.alturaMax, altura) / ALTURA_PAREDE : 1; // fração do pé-direito
    const y0 = base / ALTURA_PAREDE;
    const ax = this.X(x1), az = this.Z(y1), bx = this.X(x2), bz = this.Z(y2);
    const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
    this.muros.push({ ax, az, bx, bz, esp });
    if (estilo) {
      // Parede com acabamento: a textura corre ao longo da parede e cobre a altura inteira.
      const mat = acabamento(this.M, estilo), [tu, tv] = mat.userData.tile;
      alvo.add(mat, geoCaixa(L + esp - 0.03, hf, esp, tu, tv).translate(0, hf / 2, 0), (ax + bx) / 2, y0, (az + bz) / 2, ry, cor ?? '#ffffff');
    } else {
      alvo.add(this.M.liso, new THREE.BoxGeometry(L + esp - 0.03, hf, esp).translate(0, hf / 2, 0), (ax + bx) / 2, y0, (az + bz) / 2, ry, cor ?? '#4b4e52');
    }
    alvo.add(this.M.liso, new THREE.BoxGeometry(L + esp + 0.03, 0.02, esp + 0.03), (ax + bx) / 2, y0 + hf, (az + bz) / 2, ry, base ? (cor ?? '#0b0b0c') : this.topo === 'parede' ? (cor ?? '#8a8d90') : this.topo);
  }

  // Piso elevado (convés de navio, palco, cais, mezanino): o contorno, em pixels, sobe "altura" metros
  // e leva junto a pintura da planta que está dentro dele. As laterais ganham a cor "cor".
  // afunila < 1 fecha a base em direção ao centro (casco de barco). mureta ergue uma amurada em toda a borda.
  // fundo: cor que cobre, no chão, a pintura que ficou embaixo de um casco afunilado (a água em volta do navio).
  // encosta: com afunila > 1 (a base mais larga que o topo), as laterais viram encosta com a pintura do chão projetada de
  // cima, em vez da cor lisa. Assim se faz um morro: camadas em que a encosta de cada uma continua a da de cima.
  plataforma(pontos, altura, { cor = '#4a3524', afunila = 1, mureta = 0, corMureta = null, espMureta = 0.16, fundo = '#0c3558', encosta = false } = {}) {
    if (!pontos || pontos.length < 3 || !(altura > 0)) return;
    const mx = pontos.reduce((s, p) => s + p[0], 0) / pontos.length, my = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
    const balanco = this.noBalanco(mx, my);
    this.plataformas.push({ pontos, altura, cor, afunila, fundo, balanco, encosta: encosta && afunila > 1.001 });
    if (mureta > 0) for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i], b = pontos[(i + 1) % pontos.length];
      this.parede(a[0], a[1], b[0], b[1], { esp: espMureta, cor: corMureta ?? cor, estilo: null, altura: mureta, base: altura, balanco });
    }
  }
  _malhasDePlataforma(matPiso) {
    const malhas = [];
    for (const { pontos, altura, cor, afunila, fundo, balanco, encosta } of this.plataformas) {
      const destino = balanco && this.bal ? this.bal.malhas : malhas;
      const cx0 = pontos.reduce((s, p) => s + p[0], 0) / pontos.length, cy0 = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
      // Tampo: o polígono triangulado, com o mesmo pedaço da pintura que está embaixo dele.
      const pts = pontos.map(([x, y]) => new THREE.Vector2(x, y));
      const tri = THREE.ShapeUtils.triangulateShape(pts, []);
      const pos = [], uv = [];
      for (const t of tri) for (const i of [t[0], t[2], t[1]]) { const [x, y] = pontos[i]; pos.push(this.X(x), altura, this.Z(y)); uv.push(x / this.W, 1 - y / this.H); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      // A triangulação pode sair com a face para baixo, conforme o sentido em que o contorno foi escrito.
      if (g.attributes.normal.getY(0) < 0) { const idx = []; for (let i = 0; i < pos.length / 3; i += 3) idx.push(i, i + 2, i + 1); g.setIndex(idx); g.computeVertexNormals(); }
      const tampo = new THREE.Mesh(g, matPiso); tampo.receiveShadow = true; destino.push(tampo);
      if (afunila < 0.999) {
        // Casco: a base é menor que o convés, então a pintura original sobraria em volta; cobre-se com a cor da água.
        const gf = g.clone(); const pf = gf.attributes.position, fx = this.X(cx0), fz = this.Z(cy0);
        for (let i = 0; i < pf.count; i++) pf.setXYZ(i, fx + (pf.getX(i) - fx) * 1.04, 0.03, fz + (pf.getZ(i) - fz) * 1.04); // um pouco maior, para cobrir a borda pintada
        gf.deleteAttribute('uv');
        const chao = new THREE.Mesh(gf, new THREE.MeshStandardMaterial({ color: fundo, roughness: 0.6 })); chao.receiveShadow = true; malhas.push(chao);
      }
      // Laterais: uma face por trecho do contorno, do tampo até o chão.
      const cx = pontos.reduce((s, p) => s + p[0], 0) / pontos.length, cy = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
      const pe = ([x, y]) => [this.X(cx + (x - cx) * afunila), this.Z(cy + (y - cy) * afunila)];
      // Num casco (afunila < 1) a lateral ganha três faixas: cinta clara em cima, costado e obras vivas escuras junto à água.
      const casco = afunila < 0.999, cBase = new THREE.Color(cor);
      const faixas = casco ? [[1, 0.8, 1.25], [0.8, 0.3, 1], [0.3, 0, 0.55]] : [[1, 0, 1]];
      if (encosta) {
        // Encosta: uma faixa por trecho do contorno, do topo ao pé, com a pintura do chão vista de cima (uv pela posição).
        const ep = [], eu = [], uvDe = (x, z) => [(x / this.E + this.W / 2) / this.W, 1 - (z / this.E + this.H / 2) / this.H];
        for (let i = 0; i < pontos.length; i++) {
          const a = pontos[i], b = pontos[(i + 1) % pontos.length], [pax, paz] = pe(a), [pbx, pbz] = pe(b);
          const A1 = [this.X(a[0]), altura, this.Z(a[1])], B1 = [this.X(b[0]), altura, this.Z(b[1])], A0 = [pax, 0, paz], B0 = [pbx, 0, pbz];
          for (const v of [A1, A0, B0, A1, B0, B1]) { ep.push(...v); eu.push(...uvDe(v[0], v[2])); }
        }
        const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(eu, 2)); ge.computeVertexNormals();
        if (ge.attributes.normal.getY(0) < 0) { const idx = []; for (let i = 0; i < ep.length / 3; i += 3) idx.push(i, i + 2, i + 1); ge.setIndex(idx); ge.computeVertexNormals(); }
        const enc = new THREE.Mesh(ge, matPiso); enc.receiveShadow = true; destino.push(enc);
        continue;
      }
      const lp = [], lc = [];
      for (let i = 0; i < pontos.length; i++) {
        const a = pontos[i], b = pontos[(i + 1) % pontos.length], [ax, az] = [this.X(a[0]), this.Z(a[1])], [bx, bz] = [this.X(b[0]), this.Z(b[1])], [pax, paz] = pe(a), [pbx, pbz] = pe(b);
        const em = (tx, px, f) => px + (tx - px) * f; // do pé (f = 0) ao topo (f = 1)
        for (const [f1, f0, tom] of faixas) {
          const A1 = [em(ax, pax, f1), altura * f1, em(az, paz, f1)], A0 = [em(ax, pax, f0), altura * f0, em(az, paz, f0)];
          const B1 = [em(bx, pbx, f1), altura * f1, em(bz, pbz, f1)], B0 = [em(bx, pbx, f0), altura * f0, em(bz, pbz, f0)];
          lp.push(...A1, ...A0, ...B0, ...A1, ...B0, ...B1);
          for (let k = 0; k < 6; k++) lc.push(Math.min(1, cBase.r * tom), Math.min(1, cBase.g * tom), Math.min(1, cBase.b * tom));
        }
      }
      const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); gl.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); gl.computeVertexNormals();
      const lado = new THREE.Mesh(gl, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
      lado.castShadow = lado.receiveShadow = true; destino.push(lado);
    }
    return malhas;
  }
  // Barreira invisível (só colisão), para grades e parapeitos finos.
  barreira(x1, y1, x2, y2, esp = 0.1) { this.muros.push({ ax: this.X(x1), az: this.Z(y1), bx: this.X(x2), bz: this.Z(y2), esp }); }
  paredes(lista, opts) { for (const [x1, y1, x2, y2] of lista) this.parede(x1, y1, x2, y2, opts); }

  // Porta numa abertura da parede, entre dois pontos da planta. A dobradiça fica no primeiro ponto.
  // revela: salas que aparecem quando a porta abre. fixa: porta só de enfeite (ex.: a de entrada).
  porta(x1, y1, x2, y2, { revela = [], cor = 0x4a2c18, sentido = 1, fixa = false, altura = null, corVerga = null, textura = null, alturaFolha = null } = {}) {
    const ax = this.X(x1), az = this.Z(y1), bx = this.X(x2), bz = this.Z(y2);
    const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
    const pivo = new THREE.Group();
    pivo.position.set(ax, 0, az); pivo.rotation.y = ry;
    const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7 });
    // As medidas verticais são frações da altura da parede (o grupo das paredes é esticado depois).
    const hf = ALTURA_PORTA / ALTURA_PAREDE;
    // textura { imagem, rect: [x0, y0, x1, y1] }: a folha da porta é um painel com a arte (recortada pela transparência), da altura alturaFolha (m).
    let hFolha = hf, folha;
    if (textura) {
      hFolha = (alturaFolha ?? ALTURA_PORTA) / ALTURA_PAREDE;
      const tex = carregador.load(textura.imagem, (t) => { const [x0, y0, x1, y1] = textura.rect, { width: iw, height: ih } = t.image; t.repeat.set((x1 - x0) / iw, (y1 - y0) / ih); t.offset.set(x0 / iw, 1 - y1 / ih); if (textura.espelhar) { t.repeat.x *= -1; t.offset.x = x1 / iw; } });
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      folha = new THREE.Mesh(new THREE.PlaneGeometry(L, hFolha).translate(L / 2, hFolha / 2, 0), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.2 }));
    } else folha = new THREE.Mesh(new THREE.BoxGeometry(L, hf, 0.07).translate(L / 2, hf / 2, 0), mat);
    const macaneta = textura ? new THREE.Group() : new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6).scale(1, 1 / ALTURA_PAREDE, 1).translate(L - 0.12, hf * 0.46, 0), new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.4, metalness: 0.9 }));
    folha.castShadow = true;
    pivo.add(folha, macaneta);
    // Verga: fecha o vão entre o topo da porta e o teto.
    // É uma peça solta e marcada como "teto": quem passa por baixo não pode tomá-la por chão (era isso que barrava as criaturas na porta).
    // Vai até o topo da parede onde a porta está (muros baixos têm "altura" própria); se a parede não passa da porta, não há verga.
    const topo = altura ? Math.min(1, altura / ALTURA_PAREDE) : 1;
    if (!textura && topo > hf + 0.01) {
      const verga = new THREE.Mesh(new THREE.BoxGeometry(L, topo - hf, 0.2), new THREE.MeshStandardMaterial({ color: corVerga ?? 0x241811, roughness: 0.9 }));
      verga.position.set((ax + bx) / 2, hf + (topo - hf) / 2, (az + bz) / 2); verga.rotation.y = ry;
      verga.userData.teto = true;
      this.soltosParede.push(verga);
    }
    const p = { pivo, folha, ry, sentido, aberta: false, k: 0, revela: [].concat(revela), fixa, seg: { ax, az, bx, bz } };
    folha.userData.porta = p;
    this.portas.push(p); this.soltosParede.push(pivo);
    return p;
  }
  // Sala que começa oculta: blocos pretos sobre os retângulos [x0, y0, x1, y1] da planta.
  sala(id, rets) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x030303, transparent: true, opacity: 1 });
    const malhas = rets.map(([x0, y0, x1, y1]) => {
      const alt = ALTURA_PAREDE + 0.14;
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) * this.E, alt, Math.abs(y1 - y0) * this.E), mat);
      m.position.set(this.X((x0 + x1) / 2), alt / 2, this.Z((y0 + y1) / 2));
      m.renderOrder = 1;
      return m;
    });
    this.salas[id] = { malhas, revelada: false, op: 1 };
    this.soltos.push(...malhas);
  }

  // Teto: uma laje na altura das paredes. Só aparece quando a câmera está dentro (abaixo dela);
  // nas vistas de cima fica oculta para não tampar a planta.
  // area [x0, y0, x1, y1] (pixels) limita o teto ao prédio; sem ela, cobre a planta inteira.
  teto(cor = 0x2b1f16, { vigas = false, area = null } = {}) {
    const [x0, y0, x1, y1] = area ? [Math.min(area[0], area[2]), Math.min(area[1], area[3]), Math.max(area[0], area[2]), Math.max(area[1], area[3])] : [0, 0, this.W, this.H];
    const w = (x1 - x0) * this.E, d = (y1 - y0) * this.E;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95 }));
    m.position.set(this.X((x0 + x1) / 2), 1.0, this.Z((y0 + y1) / 2));
    m.visible = false;
    m.userData.teto = true; // teto e vigas não contam como "chão" para a colisão
    if (vigas) {
      // Vigas de madeira atravessando o teto.
      const matViga = new THREE.MeshStandardMaterial({ color: 0x1f140c, roughness: 0.9 });
      for (let x = -w / 2 + 1; x < w / 2; x += 2.1) {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, d), matViga);
        v.position.set(x, -0.035, 0);
        v.userData.teto = true;
        m.add(v);
      }
    }
    this.tetoMalha = m;
    this.soltosParede.push(m);
  }

  // Moldura preta em volta do prédio [x0, y0, x1, y1]: esconde o que vaza para fora das paredes (luz no chão, bordas da pintura).
  moldura(x0, y0, x1, y1, margem = 40) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const ax = this.X(x0), bx = this.X(x1), az = this.Z(y0), bz = this.Z(y1);
    const faixa = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat); m.position.set(x, 0.06, z); this.soltos.push(m); };
    faixa(bx - ax + 2 * margem, margem, (ax + bx) / 2, az - margem / 2); faixa(bx - ax + 2 * margem, margem, (ax + bx) / 2, bz + margem / 2);
    faixa(margem, bz - az, ax - margem / 2, (az + bz) / 2); faixa(margem, bz - az, bx + margem / 2, (az + bz) / 2);
  }

  // Coloca um móvel do kit: posição em pixels, rotação em graus (0 = frente para baixo na planta, 90 = para a direita).
  // base (em metros) é a altura do piso onde ele fica (0 no chão; a altura da plataforma, se estiver em cima de uma).
  m(fn, px, py, graus = 0, opts, base = 0) {
    const balanco = this.noBalanco(px, py), alvo = balanco ? this.bal.b : this.b;
    // ctx: o que uma peça precisa para ter partes soltas (que giram, piscam ou deixam passar por baixo).
    const o = { ...opts, ctx: { base, pisca: this.matPisca, anim: (f) => this.anims.push(f), solto: (obj) => (balanco ? this.bal.malhas : this.soltos).push(obj) } };
    if (!base) { fn(alvo, this.M, this.X(px), this.Z(py), (graus * Math.PI) / 180, o); return; }
    const s = new Construtor();
    fn(s, this.M, this.X(px), this.Z(py), (graus * Math.PI) / 180, o);
    alvo.anexar(s, 0, base, 0, 0);
  }

  // Desafio (uma cabana para montar, uma fogueira para acender): o que fn constrói vai para um grupo próprio, da fase
  // "antes" (o material no chão; some quando o desafio é feito) ou "depois" (a barraca montada; aparece). As colisões
  // criadas dentro dele valem só enquanto o grupo aparece (ver sistemas/desafios.js).
  desafio(nome, fase, px, py, base, fn) {
    const d = this._desafio(nome, px, py, base), salvo = { b: this.b, soltos: this.soltos, muros: this.muros.length };
    this.b = new Construtor(); this.soltos = [];
    try { fn(); } finally {
      const g = new THREE.Group();
      g.add(this.b.construir(), ...this.soltos);
      d[fase].push(g);
      d.muros[fase].push(...this.muros.slice(salvo.muros));
      this.b = salvo.b; this.soltos = salvo.soltos;
    }
  }
  // Luz que acende (ou apaga) com o desafio: o registro da luz, como mundo.luzes o guarda.
  desafioLuz(nome, fase, px, py, base, luz) { if (luz) this._desafio(nome, px, py, base).luzes[fase].push(luz); }
  _desafio(nome, px, py, base) {
    if (!this.desafios.has(nome)) this.desafios.set(nome, { nome, pos: [this.X(px), base, this.Z(py)], antes: [], depois: [], muros: { antes: [], depois: [] }, luzes: { antes: [], depois: [] } });
    return this.desafios.get(nome);
  }

  // Árvore no chão (pinheiro, árvore, palmeira). Uma floresta tem milhares delas: juntas numa malha só, cada raio que
  // mede a altura do chão testaria todos os triângulos, e a sombra da lanterna redesenharia a mata inteira a cada passo.
  // Por isso vão em lotes de LOTE_MATA metros (o que está fora da vista ou da luz não é desenhado), não entram no raio
  // do chão e barram quem anda com um círculo no tronco.
  // base: altura do piso onde ela está (o terraço de um morro feito com plataformas).
  arvore(fn, px, py, graus = 0, opts = {}, base = 0) {
    this.decor(fn, px, py, graus, opts, base, { comprimento: 0, esp: 0.5 });
  }
  // Peça de cenário que não é chão (árvore, cerca): vai em lotes, fora do raio da altura do chão, e colide por um
  // segmento ao longo dela (comprimento 0 = um círculo, como o tronco de uma árvore).
  decor(fn, px, py, graus = 0, opts = {}, base = 0, { comprimento = 0, esp = 0.5 } = {}) {
    const x = this.X(px), z = this.Z(py), chave = `${Math.floor(x / LOTE_MATA)},${Math.floor(z / LOTE_MATA)}`, ry = (graus * Math.PI) / 180;
    if (!this.mata.has(chave)) this.mata.set(chave, new Construtor());
    const lote = this.mata.get(chave), alvo = base ? new Construtor() : lote;
    fn(alvo, this.M, x, z, ry, { ...opts, ctx: { base, pisca: this.matPisca, anim: (f) => this.anims.push(f), solto: (obj) => this.soltos.push(obj) } });
    if (base) lote.anexar(alvo, 0, base, 0, 0);
    const dx = (Math.cos(ry) * comprimento) / 2, dz = (-Math.sin(ry) * comprimento) / 2;
    this.muros.push({ ax: x - dx, az: z - dz, bx: x + dx, bz: z + dz, esp });
  }

  // Prédio visto de fora que conserva a arte: as paredes sobem do retângulo [x0, y0, x1, y1] até "altura" e o telhado
  // (de duas águas, quatro águas ou plano) recebe por cima o pedaço da pintura que está dentro do retângulo.
  // Visto do alto continua sendo o desenho original; de lado, ganha paredes e janelas. A cumeeira corre no lado maior.
  // fachada: altura, em pixels, da frente pintada logo abaixo do telhado (vista oblíqua). O volume desce para o pé
  // dela e a faixa pintada é aplicada em pé, na parede da frente.
  predio(area, altura, { telhado = 'duas-aguas', ht = null, cor = '#6b5a48', janelas = true, porta = true, estilo = null, beiral = 0.25, fachada = 0, frente: modoFrente = 'pintada', silhueta = null, fatorAltura = 0.72, corTelhado = null, estiloTelhado = null, base = 0, luz = '#ffcf7a' } = {}) {
    const x0 = Math.min(area[0], area[2]), x1 = Math.max(area[0], area[2]), y0 = Math.min(area[1], area[3]), y1 = Math.max(area[1], area[3]);
    const w = (x1 - x0) * this.E, d = (y1 - y0) * this.E, cx = this.X((x0 + x1) / 2), cz = this.Z((y0 + y1) / 2 + fachada);
    if (!(w > 0.2 && d > 0.2 && altura > 0)) return;
    const M = this.M, frente = cz + d / 2;
    // Paredes: com acabamento (textura), ou lisas na cor dada.
    if (estilo) { const mat = acabamento(M, estilo), [tu, tv] = mat.userData.tile; this.b.add(mat, geoCaixa(w, altura, d, tu, tv * ALTURA_PAREDE).translate(0, altura / 2, 0), cx, base, cz, 0, cor); }
    else this.b.caixa(M.liso, w, altura, d, cx, base, cz, { cor });
    // Colisão: uma cápsula ao longo do lado maior, para a câmera não entrar no volume.
    const meio = Math.abs(w - d) / 2;
    this.muros.push(w >= d ? { ax: cx - meio, az: cz, bx: cx + meio, bz: cz, esp: d } : { ax: cx, az: cz - meio, bx: cx, bz: cz + meio, esp: w });
    const sorte = (k) => { const v = Math.sin(cx * 12.9898 + cz * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    // Silhueta: o contorno do prédio pintado (com torres e pontas). A pintura inteira dele fica em pé na frente do
    // volume, recortada nesse contorno; fatorAltura converte pixels em altura (desfaz o esticamento da vista oblíqua).
    const recortada = Array.isArray(silhueta) && silhueta.length >= 3;
    if (recortada) {
      const pe = Math.max(...silhueta.map((q) => q[1]));
      for (const t of THREE.ShapeUtils.triangulateShape(silhueta.map(([x, y]) => new THREE.Vector2(x, y)), [])) for (const i of t) {
        const [x, y] = silhueta[i];
        this.recortes.pos.push(this.X(x), base + (pe - y) * this.E * fatorAltura, frente + beiral + 0.1); this.recortes.uv.push(x / this.W, 1 - y / this.H);
      }
    }
    const pintada = fachada > 0 && modoFrente !== 'gerada' && !recortada;
    if (pintada) {
      // A frente pintada, em pé: o retângulo logo abaixo do telhado na imagem.
      this.fachadas.push({ cx, cz: frente + 0.04, w, base, altura, u0: x0 / this.W, u1: x1 / this.W, v0: 1 - (y1 + fachada) / this.H, v1: 1 - y1 / this.H });
    } else if (porta && !recortada) { this.b.caixa(M.liso, Math.min(1.4, w * 0.3) + 0.24, Math.min(2.2, altura * 0.72) + 0.12, 0.05, cx, base, frente, { cor: '#d8d2c4' }); this.b.caixa(M.liso, Math.min(1.4, w * 0.3), Math.min(2.2, altura * 0.72), 0.09, cx, base, frente, { cor: '#241811' }); }
    if (janelas) {
      // Uma fileira por andar; parte delas acesa à noite, o resto de vidro escuro.
      const na = Math.max(1, Math.round(altura / 3)), ha = altura / na, jh = Math.min(1.1, ha * 0.36);
      const janela = (k, jw, jd, x, y, z) => {
        const acesa = sorte(k) < 0.45, naFrente = jw > jd, m = 0.08;
        // Moldura clara, vidro (aceso ou escuro) e uma travessa: fica nítido de qualquer distância.
        this.b.caixa(M.liso, naFrente ? jw + 2 * m : jw * 0.6, jh + 2 * m, naFrente ? jd * 0.6 : jd + 2 * m, x, base + y - m, z, { cor: '#d8d2c4' });
        this.b.caixa(acesa ? M.lampada : M.liso, jw, jh, jd, x, base + y, z, { cor: acesa ? luz : '#14181e' });
        this.b.caixa(M.liso, naFrente ? 0.05 : jw * 1.2, jh, naFrente ? jd * 1.2 : 0.05, x, base + y, z, { cor: '#d8d2c4' });
      };
      let k = 0;
      for (let i = 0; i < na; i++) {
        const y = i * ha + ha * 0.46, nf = Math.max(1, Math.floor(w / 2.8)), nl = Math.max(1, Math.floor(d / 2.8));
        for (let q = 0; q < nf; q++) {
          const xq = cx - w / 2 + ((q + 0.5) * w) / nf;
          if (!pintada && !recortada && !(i === 0 && porta && Math.abs(xq - cx) < 1.3)) janela(k++, 0.7, 0.07, xq, y, frente);
          janela(k++, 0.7, 0.07, xq, y, cz - d / 2);
        }
        for (let q = 0; q < nl; q++) for (const sx of [-1, 1]) janela(k++, 0.07, 0.7, cx + (sx * w) / 2, y, cz - d / 2 + ((q + 0.5) * d) / nl);
      }
    }
    // Telhado: sai um pouco das paredes (beiral) e leva a pintura do retângulo original.
    const tw = w + beiral * 2, td = d + beiral * 2, alt = telhado === 'plano' ? 0 : ht ?? Math.min(w, d) * 0.35;
    let polys;
    // O telhado plano fica um pouco acima do topo das paredes: duas faces na mesma altura "brigam" e a textura treme.
    if (telhado === 'plano') polys = [[[-tw / 2, 0.06, td / 2], [tw / 2, 0.06, td / 2], [tw / 2, 0.06, -td / 2], [-tw / 2, 0.06, -td / 2]]];
    else {
      const girar = d > w; // a cumeeira corre no lado maior
      const lado = telhado === 'quatro-aguas' ? polysQuatroAguas(girar ? td : tw, girar ? tw : td, alt) : polysDuasAguas(girar ? td : tw, girar ? tw : td, alt);
      polys = lado.map((q) => q.map((v) => (girar && telhado !== 'quatro-aguas' ? [-v.z, v.y, v.x] : [v.x, v.y, v.z])));
      // Empenas: os triângulos de parede que fecham as pontas do telhado de duas águas.
      if (telhado !== 'quatro-aguas') for (const e of polysEmpenas(girar ? d : w, girar ? w : d, alt)) { const pe = [e.map((v) => (girar ? new THREE.Vector3(-v.z, v.y, v.x) : v))]; if (estilo) { const me = acabamento(M, estilo), tu = me.userData.tile[0]; this.b.add(me, geoFaces(pe, tu, tu), cx, base + altura, cz, 0, cor); } else this.b.faces(M.liso, pe, cx, base + altura, cz, { cor }); } // a empena leva o mesmo acabamento da parede
    }
    if (beiral > 0.01) this.b.caixa(M.liso, tw, 0.08, td, cx, base + altura - 0.1, cz, { cor: '#1c1512' }); // forro do beiral
    // Telhado com textura própria (ardósia, telha), em vez da pintura.
    if (estiloTelhado) { const mt = acabamento(M, estiloTelhado), tu = mt.userData.tile[0]; this.b.add(mt, geoFaces(polys.map((q) => q.map((v) => new THREE.Vector3(v[0], v[1], v[2]))), tu, tu), cx, base + altura, cz, 0, corTelhado ?? '#ffffff'); return; }
    // Com corTelhado o telhado é liso, nessa cor (a pintura do telhado já está na silhueta, ou não se quer usá-la).
    if (corTelhado) { this.b.faces(M.liso, polys.map((q) => q.map((v) => new THREE.Vector3(v[0], v[1], v[2]))), cx, base + altura, cz, { cor: corTelhado }); return; }
    this.predios.push({ polys, cx, cz, altura: base + altura, tw, td, u0: x0 / this.W, u1: x1 / this.W, v0: 1 - y1 / this.H, v1: 1 - y0 / this.H });
  }
  _malhasDePredio(matPiso) {
    const pos = [], uv = [];
    for (const { polys, cx, cz, altura, tw, td, u0, u1, v0, v1 } of this.predios) for (const p of polys) for (let i = 1; i < p.length - 1; i++) for (const v of [p[0], p[i], p[i + 1]]) {
      pos.push(cx + v[0], altura + v[1], cz + v[2]);
      uv.push(u0 + (v[0] / tw + 0.5) * (u1 - u0), v1 - (v[2] / td + 0.5) * (v1 - v0)); // o telhado inteiro, com beiral, recebe o retângulo pintado
    }
    for (const f of this.fachadas) {
      const a = [f.cx - f.w / 2, f.base, f.cz, f.u0, f.v0], b = [f.cx + f.w / 2, f.base, f.cz, f.u1, f.v0], c = [f.cx + f.w / 2, f.base + f.altura, f.cz, f.u1, f.v1], e = [f.cx - f.w / 2, f.base + f.altura, f.cz, f.u0, f.v1];
      for (const v of [a, b, c, a, c, e]) { pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); }
    }
    const malhas = [];
    for (const [p, u, dupla] of [[pos, uv, false], [this.recortes.pos, this.recortes.uv, true]]) {
      if (!p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals();
      if (dupla) matPiso.side = THREE.DoubleSide; // o recorte é visto dos dois lados
      const m = new THREE.Mesh(g, matPiso); m.castShadow = m.receiveShadow = true; malhas.push(m);
    }
    return malhas;
  }

  // Prédio montado a partir de uma folha de referência: uma imagem com vistas sem perspectiva sobre fundo liso
  // (frente, lateral direita, fundos e telhado visto de cima). O volume é esculpido pelas silhuetas: o prédio é cortado
  // em fatias horizontais e, em cada fatia, só existe onde a vista de frente E a vista de lado têm desenho. Cada face
  // recebe a arte da sua vista, e os topos recebem a vista do telhado. Torres, empenas e recuos ficam com volume de
  // verdade, sem caixa por trás. Só com "frente", a peça é simétrica (uma torre) ou, com "profundidade" pequena, uma parede.
  // largura (m) é a da frente; a altura sai da proporção da vista de frente; profundidade: da vista lateral, ou dada.
  folha({ imagem, frente, lado = null, fundos = null, telhado = null, x, y, giro = 0, largura = 20, profundidade = null, altura = null, fatias = 72, tolerancia = 0.11, brilho = 1, colide = true, telhadoFrente = 'baixo', escadas = 'pintadas', base = 0, vao = null }) {
    if (!imagem || !Array.isArray(frente)) return;
    const F = frente, S = lado ?? frente, B = fundos ?? frente, T = telhado;
    // altura: só quando o prédio precisa ocupar um terreno largo sem ficar alto demais (a arte é achatada na vertical).
    const W = largura, H = altura ?? (W * (F[3] - F[1])) / (F[2] - F[0]), D = profundidade ?? (H * (S[2] - S[0])) / (S[3] - S[1]), ry = (giro * Math.PI) / 180;
    const g = new THREE.BufferGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(brilho, brilho, brilho), roughness: 0.9, alphaTest: 0.5, emissive: 0xffffff, emissiveIntensity: 0.22 });
    const malha = new THREE.Mesh(g, mat);
    malha.position.set(this.X(x), base, this.Z(y)); malha.rotation.y = ry; malha.visible = false; malha.castShadow = malha.receiveShadow = true;
    malha.userData.atravessavel = !colide; // sem colisão, a câmera também não a trata como terreno (ver Fisica.camera)
    malha.userData.folha = true; // nasce do chão para cima: num desafio, é ela que sobe ao ser montada
    this.soltos.push(malha);
    // as janelas pintadas "acendem" à noite; numa noite escura ("luar" baixo) a fachada brilha menos
    const noiteFachada = 0.4 * (0.3 + 0.7 * Math.min(1, this.luar ?? 1));
    this.anims.push((_t, f) => { mat.emissiveIntensity = 0.14 + (noiteFachada - 0.14) * f; });
    recortarFolha(imagem, tolerancia, (tex, iw, ih, px) => {
      // Trechos com desenho numa vista, entre duas alturas (t de 0, no pé, a 1, no topo): pares [coluna inicial, final).
      const trechos = (r, t0, t1) => {
        const l0 = Math.max(0, Math.round(r[3] - t1 * (r[3] - r[1]))), l1 = Math.min(ih, Math.max(l0 + 1, Math.round(r[3] - t0 * (r[3] - r[1]))));
        const out = []; let ini = -1, vazio = 0;
        for (let c = r[0]; c <= r[2]; c++) {
          let tem = false;
          if (c < r[2]) for (let l = l0; l < l1; l++) if (px[(l * iw + c) * 4 + 3] > 127) { tem = true; break; }
          if (tem) { if (ini < 0) ini = c; vazio = 0; }
          else if (ini >= 0 && (++vazio > 2 || c === r[2])) { const fim = c - vazio + 1; if (fim - ini >= 2) out.push([ini, fim]); ini = -1; vazio = 0; }
        }
        return out;
      };
      const pos = [], uv = [];
      // Quatro cantos no sentido anti-horário, vistos de fora, com a posição de cada um na folha (em pixels).
      const quad = (a, b, c, d, ua, ub, uc, ud) => { for (const [p, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) { pos.push(p[0], p[1], p[2]); uv.push(u[0] / iw, 1 - u[1] / ih); } };
      const linha = (r, t) => r[3] - t * (r[3] - r[1]);
      const cortes = []; for (let k = 0; k < fatias; k++) cortes.push([trechos(F, k / fatias, (k + 1) / fatias), trechos(S, k / fatias, (k + 1) / fatias)]);
      // A borda de um desenho oscila um ou dois pixels de uma fatia para a outra, e cada oscilação viraria um degrau
      // (uma linha de sombra atravessando a fachada). Diferenças de até 3 px seguem a fatia de baixo; ressaltos de verdade ficam.
      for (let k = 1; k < fatias; k++) for (const v of [0, 1]) for (const t of cortes[k][v]) for (const i of [0, 1]) {
        let perto = null; for (const q of cortes[k - 1][v]) if (Math.abs(q[i] - t[i]) <= 3 && (perto === null || Math.abs(q[i] - t[i]) < Math.abs(perto - t[i]))) perto = q[i];
        if (perto !== null) t[i] = perto;
      }
      // Escadas e alpendres: na vista lateral eles avançam só no pé do prédio. Cruzados com a frente inteira, virariam um
      // degrau da largura toda (com a arte esticada por cima, a "entrada quadrada"). No pé (até 12% da altura) a lateral não
      // passa da largura que tem logo acima, e a escada fica pintada na fachada. escadas: 'volume' desliga isso.
      if (lado && escadas !== 'volume') {
        const ref = cortes[Math.min(fatias - 1, Math.ceil(fatias * 0.15))][1];
        if (ref.length) {
          const r0 = Math.min(...ref.map((q) => q[0])), r1 = Math.max(...ref.map((q) => q[1]));
          for (let k = 0; k < Math.floor(fatias * 0.12); k++) cortes[k][1] = cortes[k][1].map(([a, b]) => [Math.max(a, r0), Math.min(b, r1)]).filter(([a, b]) => b - a >= 2);
        }
      }
      // Quanto de um trecho [a0, a1) fica coberto pelos trechos da fatia de cima.
      const coberto = (a0, a1, lista) => { let c = 0; for (const [q0, q1] of lista) c += Math.max(0, Math.min(a1, q1) - Math.max(a0, q0)); return c / (a1 - a0); };
      for (let k = 0; k < fatias; k++) {
        const t0 = k / fatias, t1 = (k + 1) / fatias, y0 = t0 * H, y1 = t1 * H;
        const [fr, sr] = cortes[k], acima = cortes[k + 1] ?? [[], []];
        for (const [a0, a1] of fr) for (const [b0, b1] of sr) {
          const x0 = -W / 2 + ((a0 - F[0]) / (F[2] - F[0])) * W, x1 = -W / 2 + ((a1 - F[0]) / (F[2] - F[0])) * W;
          const zf = D / 2 - ((b0 - S[0]) / (S[2] - S[0])) * D, zb = D / 2 - ((b1 - S[0]) / (S[2] - S[0])) * D;
          const cb = (xx) => B[0] + ((W / 2 - xx) / W) * (B[2] - B[0]); // a vista de fundos é vista por trás: espelhada
          quad([x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf], [a0, linha(F, t0)], [a1, linha(F, t0)], [a1, linha(F, t1)], [a0, linha(F, t1)]);
          quad([x1, y0, zb], [x0, y0, zb], [x0, y1, zb], [x1, y1, zb], [cb(x1), linha(B, t0)], [cb(x0), linha(B, t0)], [cb(x0), linha(B, t1)], [cb(x1), linha(B, t1)]);
          quad([x1, y0, zf], [x1, y0, zb], [x1, y1, zb], [x1, y1, zf], [b0, linha(S, t0)], [b1, linha(S, t0)], [b1, linha(S, t1)], [b0, linha(S, t1)]);
          quad([x0, y0, zb], [x0, y0, zf], [x0, y1, zf], [x0, y1, zb], [b1, linha(S, t0)], [b0, linha(S, t0)], [b0, linha(S, t1)], [b1, linha(S, t1)]);
          // vao: { de, ate, margem } esvazia o miolo de um trecho maciço (a cabine de uma torre de vigia): entre t = de e
          // t = ate, as peças que cobrem quase toda a planta ficam só com a casca (parede de "margem" metros), com faces
          // por dentro, piso (o topo da fatia de baixo) e borda no alto. Postes e peças estreitas ficam como estão.
          const oco = vao && t0 >= vao.de - 1e-6 && t1 <= vao.ate + 1e-6 && x1 - x0 > 0.6 * W && zf - zb > 0.6 * D;
          if (oco) {
            const mx = Math.min(vao.margem ?? 0.3, (x1 - x0) / 3), mz = Math.min(vao.margem ?? 0.3, (zf - zb) / 3), ix0 = x0 + mx, ix1 = x1 - mx, izf = zf - mz, izb = zb + mz;
            const u0 = [a0, linha(F, t0)], u1 = [a1, linha(F, t0)], u2 = [a1, linha(F, t1)], u3 = [a0, linha(F, t1)];
            quad([ix1, y0, izf], [ix0, y0, izf], [ix0, y1, izf], [ix1, y1, izf], u1, u0, u3, u2); // parede da frente, vista de dentro
            quad([ix0, y0, izb], [ix1, y0, izb], [ix1, y1, izb], [ix0, y1, izb], u0, u1, u2, u3);   // parede do fundo
            quad([ix0, y0, izf], [ix0, y0, izb], [ix0, y1, izb], [ix0, y1, izf], u0, u1, u2, u3);   // lado esquerdo (olha para +x)
            quad([ix1, y0, izb], [ix1, y0, izf], [ix1, y1, izf], [ix1, y1, izb], u1, u0, u3, u2);   // lado direito
            if (t1 + 1 / fatias > vao.ate + 1e-6) { // última fatia do trecho: só a borda de cima, o miolo fica aberto
              const cima = (xa, xb, za, zc) => quad([xa, y1, za], [xb, y1, za], [xb, y1, zc], [xa, y1, zc], u0, u1, u2, u3);
              cima(x0, x1, zf, izf); cima(x0, x1, izb, zb); cima(x0, ix0, izf, izb); cima(ix1, x1, izf, izb);
            }
          } else
          // Só é telhado o topo que fica descoberto. Um ressalto estreito, quase todo debaixo da fatia de cima, leva a
          // cor da própria fachada, senão vira uma linha escura atravessando a parede.
          if (T &&!(coberto(a0, a1, acima[0]) > 0.75 && coberto(b0, b1, acima[1]) > 0.75)) {
            // telhadoFrente: de que lado da vista do telhado fica a frente do prédio (a vista pode vir deitada na folha).
            const fx = (xx) => (xx + W / 2) / W, fz = (zz) => (zz + D / 2) / D, tw = T[2] - T[0], th = T[3] - T[1];
            const pt = telhadoFrente === 'direita' ? (xx, zz) => [T[0] + fz(zz) * tw, T[3] - fx(xx) * th]
              : telhadoFrente === 'esquerda' ? (xx, zz) => [T[2] - fz(zz) * tw, T[1] + fx(xx) * th]
              : telhadoFrente === 'cima' ? (xx, zz) => [T[2] - fx(xx) * tw, T[3] - fz(zz) * th]
              : (xx, zz) => [T[0] + fx(xx) * tw, T[1] + fz(zz) * th];
            quad([x0, y1, zf], [x1, y1, zf], [x1, y1, zb], [x0, y1, zb], pt(x0, zf), pt(x1, zf), pt(x1, zb), pt(x0, zb));
          } else quad([x0, y1, zf], [x1, y1, zf], [x1, y1, zb], [x0, y1, zb], [a0, linha(F, t0)], [a1, linha(F, t0)], [a1, linha(F, t1)], [a0, linha(F, t1)]); // sem vista de telhado: a própria faixa da frente
          // Fundo da fatia: fecha por baixo o que avança além da fatia de baixo (cornijas, beirais), senão se vê através.
          quad([x0, y0, zb], [x1, y0, zb], [x1, y0, zf], [x0, y0, zf], [a0, linha(F, t0)], [a1, linha(F, t0)], [a1, linha(F, t1)], [a0, linha(F, t1)]);
        }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      mat.map = mat.emissiveMap = tex; mat.needsUpdate = true; malha.visible = true;
    });
    if (colide) {
      const meio = Math.abs(W - D) / 2, c = Math.cos(ry), sn = Math.sin(ry), cx = this.X(x), cz = this.Z(y);
      this.muros.push(W >= D ? { ax: cx - meio * c, az: cz + meio * sn, bx: cx + meio * c, bz: cz - meio * sn, esp: D } : { ax: cx - meio * sn, az: cz - meio * c, bx: cx + meio * sn, bz: cz + meio * c, esp: W });
    }
  }
  // Pedaço de chão vindo de outra imagem (a planta de um pátio, de uma ruína, de uma subestação), deitado sobre o piso.
  // recorte: o retângulo dentro da imagem; largura em metros; semFundo tira o fundo liso em volta do desenho.
  decalque({ imagem, recorte = null, x, y, largura = 10, giro = 0, semFundo = false, tolerancia = 0.11, brilho = 1, alt = 0.05 }) {
    if (!imagem) return;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(brilho, brilho, brilho), roughness: 0.95, alphaTest: 0.5, emissive: 0xffffff, emissiveIntensity: 0.3 });
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    malha.position.set(this.X(x), alt, this.Z(y)); malha.rotation.y = (giro * Math.PI) / 180; malha.visible = false; malha.receiveShadow = true;
    this.soltos.push(malha); this.matsChao.push(mat);
    recortarFolha(imagem, semFundo ? tolerancia : -1, (tex, iw, ih) => {
      const r = recorte ?? [0, 0, iw, ih], uv = malha.geometry.attributes.uv;
      malha.scale.set(largura, 1, (largura * (r[3] - r[1])) / (r[2] - r[0]));
      for (let i = 0; i < uv.count; i++) { const u = i % 2, v = i < 2 ? 1 : 0; uv.setXY(i, (r[0] + u * (r[2] - r[0])) / iw, 1 - (r[1] + (1 - v) * (r[3] - r[1])) / ih); }
      uv.needsUpdate = true; mat.map = mat.emissiveMap = tex; mat.needsUpdate = true; malha.visible = true;
    });
  }

  // Piso com textura (lajotas de uma igreja, calçamento, assoalho) por cima da pintura, num contorno de pixels.
  // nome é um acabamento (os de parede, os dos pacotes ou um de "texturas" do mapa); alt é a altura em metros.
  piso(pontos, nome, alt = 0.03) {
    if (!pontos || pontos.length < 3 || !nome) return;
    const mat = acabamentoQuadrado(this.M, nome), t = mat.userData.tile[0];
    const tri = THREE.ShapeUtils.triangulateShape(pontos.map(([x, y]) => new THREE.Vector2(x, y)), []), pos = [], uv = [];
    for (const f of tri) for (const i of [f[0], f[2], f[1]]) { const x = this.X(pontos[i][0]), z = this.Z(pontos[i][1]); pos.push(x, alt, z); uv.push(x / t, -z / t); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const idx = []; for (let i = 0; i < pos.length / 3; i += 3) idx.push(i, i + 2, i + 1); g.setIndex(idx); g.computeVertexNormals(); }
    this.b.add(mat, g, 0, 0, 0, 0, '#ffffff');
  }

  // O que está dentro deste contorno balança junto, como um navio na água.
  definirBalanco(pontos) { this.bal = { pontos, b: new Construtor(), p: new Construtor(), malhas: [] }; }
  noBalanco(px, py) { return !!this.bal && dentroDe(this.bal.pontos, px, py); }
  // Água animada por cima do que é água na pintura. cor: a cor da água (sem ela, vale o que for azulado);
  // tolerancia: quanto a cor pode variar (0 a 1); forca: intensidade do brilho.
  agua(op) { this._agua = { cor: null, tolerancia: 0.3, forca: 0.25, ...(op && typeof op === 'object' ? op : {}) }; }
  // Partículas caindo sobre o mapa: 'neve' ou 'petalas'.
  clima(tipo) { this._clima = tipo; }

  _criarAgua() {
    const w = this.W * this.E, d = this.H * this.E, cv = document.createElement('canvas');
    cv.width = 640; cv.height = Math.max(8, Math.round((640 * this.H) / this.W));
    const mascara = new THREE.CanvasTexture(cv);
    const { cor, tolerancia, forca } = this._agua, alvo = cor ? new THREE.Color(cor).convertLinearToSRGB() : null;
    const aoCarregar = (img) => {
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, cv.width, cv.height);
      const dados = g.getImageData(0, 0, cv.width, cv.height), px = dados.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], gg = px[i + 1], b = px[i + 2];
        let e;
        const soma = r + gg + b + 1;
        if (alvo) {
          // Compara o tom (a proporção entre as cores) e, com mais folga, o brilho: asfalto escuro não é lago escuro.
          const sa = alvo.r + alvo.g + alvo.b + 0.004;
          e = Math.hypot(r / soma - alvo.r / sa, gg / soma - alvo.g / sa, b / soma - alvo.b / sa) < tolerancia * 0.3 && Math.abs(soma / 765 - sa / 3) < tolerancia * 1.2;
        } else e = (b - r > 34 && r < 0.62 * Math.max(gg, b) && b >= gg * 0.8) || (b > r * 1.4 && gg > r * 1.2 && b >= gg * 0.9 && soma > 60); // azul ou verde-água, claro ou escuro; não branco nem cinza
        px[i] = px[i + 1] = px[i + 2] = e ? 255 : 0; px[i + 3] = 255;
      }
      g.putImageData(dados, 0, 0);
      // Suaviza a borda, para a água não acabar num serrilhado.
      try { g.filter = 'blur(2px)'; g.drawImage(cv, 0, 0); g.filter = 'none'; } catch (e) { /* sem filtro, fica como está */ }
      mascara.needsUpdate = true;
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMask: { value: mascara }, uT: { value: 0 }, uForca: { value: forca }, uNoite: { value: 0 }, uTam: { value: new THREE.Vector2(w, d) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D uMask; uniform float uT, uForca, uNoite; uniform vec2 uTam; varying vec2 vUv;
        float onda(vec2 p, float t) { float v = 0.0; for (int i = 0; i < 5; i++) { float a = float(i) * 1.256 + 0.4; v += sin(dot(p, vec2(cos(a), sin(a))) * (0.9 + float(i) * 0.35) + t * (0.7 + float(i) * 0.21) + float(i) * 1.9); } return v / 5.0; }
        void main() {
          float m = texture2D(uMask, vUv).r; if (m < 0.03) discard;
          vec2 p = vUv * uTam;
          float a = onda(p * 0.8, uT), b = onda(p * 0.33 + vec2(3.1, 1.7), -uT * 0.6);
          // Fios de luz finos, que só aparecem onde duas ondas se cruzam, e uma sombra larga que vai e vem.
          float linhas = clamp(pow(1.0 - abs(a), 16.0) * (0.35 + 0.65 * smoothstep(-0.2, 0.6, b)), 0.0, 1.0);
          float al = linhas * uForca * 0.5 * (1.0 - 0.55 * uNoite), as = (0.5 + 0.5 * b) * 0.2 * uForca;
          gl_FragColor = vec4(mix(vec3(0.0, 0.04, 0.10), vec3(0.82, 0.97, 1.0), al / (al + as + 0.0001)), (al + as) * m);
        }`,
    });
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
    malha.position.y = 0.035; malha.renderOrder = 2;
    this.anims.push((t, f) => { mat.uniforms.uT.value = t; mat.uniforms.uNoite.value = f; });
    return { malha, aoCarregar };
  }
  _criarClima() {
    const neve = this._clima === 'neve', n = neve ? 2200 : 600, w = this.W * this.E, d = this.H * this.E, teto = 26;
    const pos = new Float32Array(n * 3), fase = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * w; pos[i * 3 + 1] = Math.random() * teto; pos[i * 3 + 2] = (Math.random() - 0.5) * d; fase[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uTeto: { value: teto }, uVel: { value: neve ? 1.6 : 0.8 }, uDeriva: { value: neve ? 0.5 : 1.4 }, uTam: { value: neve ? 0.11 : 0.2 }, uCor: { value: new THREE.Color(neve ? '#ffffff' : '#f6b6cf') } },
      vertexShader: `
        attribute float aFase; uniform float uT, uTeto, uVel, uDeriva, uTam;
        void main() {
          vec3 p = position;
          p.y = mod(position.y - uT * uVel * (0.6 + aFase * 0.8), uTeto);
          p.x += sin(uT * 0.7 + aFase * 30.0) * uDeriva; p.z += cos(uT * 0.5 + aFase * 17.0) * uDeriva;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv; gl_PointSize = uTam * 900.0 / max(1.0, -mv.z);
        }`,
      fragmentShader: 'uniform vec3 uCor; void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(uCor, (1.0 - r * 2.0) * 0.85); }',
    });
    const pontos = new THREE.Points(g, mat); pontos.frustumCulled = false; pontos.renderOrder = 3;
    this.anims.push((t) => { mat.uniforms.uT.value = t; });
    return pontos;
  }

  // Chão liso em volta da planta, para o mapa não acabar no vazio (mar, neve, mato).
  entorno(cor) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(this.W * this.E * 6, this.H * this.E * 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.9 }));
    m.position.y = -0.04; m.receiveShadow = true; m.userData.teto = true; // não conta como chão para a colisão
    this.soltos.push(m);
  }

  construir(alturaParede = ALTURA_PAREDE) {
    const agua = this._agua ? this._criarAgua() : null;
    const carregar = (url, feito) => { const t = carregador.load(url, feito); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const tex = carregar(this.imagem, agua ? (t) => agua.aoCarregar(t.image) : undefined), texNoite = this.imagemNoite ? carregar(this.imagemNoite) : null;
    // O piso é a pintura original: recebe luz, mas também "brilha" um pouco para não sumir no escuro.
    const matPiso = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.95, color: new THREE.Color(1.15, 1.15, 1.15) });
    if (this.brilho !== 1) matPiso.color.multiplyScalar(this.brilho); // pintura escura demais: clareia o piso e tudo o que leva a pintura
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(this.W * this.E, this.H * this.E).rotateX(-Math.PI / 2), matPiso);
    piso.receiveShadow = true;
    const grupo = this.b.construir();
    for (const lote of this.mata.values()) {
      const g = lote.construir();
      g.traverse((o) => { if (o.isMesh) o.raycast = () => {}; }); // árvore não é chão: colide pelo círculo do tronco
      grupo.add(g);
    }
    const paredes = this.p.construir();
    paredes.scale.y = alturaParede;
    paredes.userData.altura = alturaParede;
    for (const o of this.soltosParede) paredes.add(o);
    // Telhados e fachadas podem vir de outra imagem (a original), quando a do piso teve os prédios apagados.
    let matPredio = matPiso;
    if (this.imagemPredios) {
      matPredio = matPiso.clone(); matPredio.map = matPredio.emissiveMap = carregar(this.imagemPredios);
      this.anims.push(() => { matPredio.emissiveIntensity = matPiso.emissiveIntensity; });
    }
    grupo.add(piso, paredes, ...this.soltos, ...this._malhasDePlataforma(matPiso), ...this._malhasDePredio(matPredio));
    for (const d of this.desafios.values()) if (d.antes.length + d.depois.length) grupo.add(...d.antes, ...d.depois);
    if (this.matsChao.length) this.anims.push(() => { for (const m of this.matsChao) m.emissiveIntensity = matPiso.emissiveIntensity; });
    if (agua) grupo.add(agua.malha);
    if (this._clima) grupo.add(this._criarClima());
    if (this.bal) {
      // O conjunto gira em torno do próprio centro, na linha d'água: sobe e desce, aderna e arfa de leve.
      const pts = this.bal.pontos, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const cx = this.X((Math.min(...xs) + Math.max(...xs)) / 2), cz = this.Z((Math.min(...ys) + Math.max(...ys)) / 2);
      const compridoEmX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
      const dentro = new THREE.Group(), fora = new THREE.Group(), pb = this.bal.p.construir();
      pb.scale.y = alturaParede;
      dentro.add(this.bal.b.construir(), pb, ...this.bal.malhas); dentro.position.set(-cx, 0, -cz);
      fora.add(dentro); fora.position.set(cx, 0, cz); grupo.add(fora);
      this.anims.push((t) => {
        const aderna = Math.sin(t * 0.8 + 1) * 0.028, arfa = Math.sin(t * 0.55) * 0.012;
        fora.position.y = Math.sin(t * 0.95) * 0.1 - 0.05;
        fora.rotation.x = compridoEmX ? aderna : arfa; fora.rotation.z = compridoEmX ? arfa : aderna;
      });
    }
    // Troca a pintura do piso conforme dia/noite (quando a planta tem as duas versões).
    let noite = false;
    const trocar = texNoite ? (f) => { const n = f > 0.5; if (n !== noite) { noite = n; matPiso.map = matPiso.emissiveMap = n ? texNoite : tex; } } : null;
    const anims = this.anims, animar = (t, f) => { if (trocar) trocar(f); if (grupo.visible) for (const a of anims) a(t, f); };
    return { grupo, paredes, animar, balanco: !!this.bal, portas: this.portas, salas: this.salas, muros: this.muros, teto: this.tetoMalha ?? null, matPiso, desafios: [...this.desafios.values()] };
  }
}
