// Transição de porta no estilo dos survival horror clássicos: no escuro, a câmera anda até a porta,
// a porta abre e a câmera atravessa. Enquanto toca, esta cena substitui o mapa na tela.
import * as THREE from 'three';

const suave = (t) => t * t * (3 - 2 * t);
const trecho = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

const ESTILOS = {
  porta: { folhas: 1, cor: 0x3a4046, painel: 0x2c3136, metal: 0.6, largura: 1.05, altura: 2.2 },
  'porta-dupla': { folhas: 2, cor: 0x4a2c18, painel: 0x3a2112, metal: 0, largura: 2.1, altura: 2.6 },
  // Porta de cabana: tábuas verticais com travessas em Z, dobradiças de ferro e argola (chalé, celeiro, barraco).
  'porta-madeira': { folhas: 1, cor: 0x5e3d24, painel: 0x3f2814, metal: 0, largura: 1.0, altura: 2.1, tabuas: true },
};

export class Transicao {
  constructor() {
    this.ativa = false; this.t = 0; this.dur = 3.8; this.fim = null;
    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
    this.luz = new THREE.PointLight(0xffd2a0, 0, 12, 1.6);
    this.luz.position.set(0.6, 2.6, 2.2);
    this.cena.add(this.luz, new THREE.AmbientLight(0x30343c, 0.6));
    this.porta = new THREE.Group();
    this.cena.add(this.porta);
    this.pivos = [];
    this.som = new Audio('assets/sons/porta.mp3');
    this.somTocou = false;
    const pular = () => { if (this.ativa) this.t = Math.max(this.t, this.dur - 0.05); };
    window.addEventListener('pointerdown', pular);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === ' ') pular(); });
  }

  _montar(estilo) {
    const E = ESTILOS[estilo] ?? ESTILOS.porta;
    this.porta.clear(); this.pivos = [];
    const mat = new THREE.MeshStandardMaterial({ color: E.cor, roughness: 0.62, metalness: E.metal });
    const matP = new THREE.MeshStandardMaterial({ color: E.painel, roughness: 0.7, metalness: E.metal });
    const latao = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.9 });
    const batente = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.8 });
    const L = E.largura, H = E.altura, lf = L / E.folhas;
    // Batente e um pouco de parede em volta, para a porta não flutuar no vazio.
    const caixa = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); this.porta.add(o); return o; };
    caixa(0.14, H + 0.14, 0.2, -L / 2 - 0.07, H / 2 + 0.07, 0, batente); caixa(0.14, H + 0.14, 0.2, L / 2 + 0.07, H / 2 + 0.07, 0, batente);
    caixa(L + 0.28, 0.14, 0.2, 0, H + 0.07, 0, batente);
    const parede = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.95 });
    caixa(4, H + 2, 0.12, -L / 2 - 2.14, (H + 2) / 2, -0.02, parede); caixa(4, H + 2, 0.12, L / 2 + 2.14, (H + 2) / 2, -0.02, parede);
    caixa(L + 0.28, 2, 0.12, 0, H + 1.14, -0.02, parede);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.55 }));
    chao.rotation.x = -Math.PI / 2; chao.position.z = 3; this.porta.add(chao);
    for (let i = 0; i < E.folhas; i++) {
      const lado = E.folhas === 1 ? -1 : i === 0 ? -1 : 1; // lado da dobradiça
      const pivo = new THREE.Group();
      pivo.position.set(lado * (L / 2), 0, 0);
      const folha = new THREE.Mesh(new THREE.BoxGeometry(lf, H, 0.06), mat);
      folha.position.set(-lado * (lf / 2), H / 2, 0);
      pivo.add(folha);
      if (E.tabuas) {
        // Frisos entre as tábuas, travessas e a diagonal do Z, dobradiças compridas de ferro e uma argola.
        const ferro = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.5, metalness: 0.7 });
        const nt = 5;
        for (let t = 1; t < nt; t++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, H * 0.98, 0.065), matP); f.position.set(-lado * (lf * t / nt), H / 2, 0.003); pivo.add(f); }
        for (const py of [0.16, 0.84]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(lf * 0.9, 0.12, 0.035), mat); tr.position.set(-lado * (lf / 2), H * py, 0.045); pivo.add(tr); }
        const comp = Math.hypot(lf * 0.82, H * 0.62), diag = new THREE.Mesh(new THREE.BoxGeometry(comp, 0.11, 0.03), mat);
        diag.position.set(-lado * (lf / 2), H / 2, 0.045); diag.rotation.z = lado * Math.atan2(H * 0.62, lf * 0.82); pivo.add(diag);
        for (const py of [0.16, 0.84]) { const d = new THREE.Mesh(new THREE.BoxGeometry(lf * 0.55, 0.05, 0.02), ferro); d.position.set(-lado * (lf * 0.25), H * py, 0.07); pivo.add(d); }
        const arg = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), ferro);
        arg.position.set(-lado * (lf - 0.14), H * 0.5, 0.08); pivo.add(arg);
      } else {
        for (const py of [0.28, 0.72]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(lf * 0.66, H * 0.34, 0.03), matP);
          p.position.set(-lado * (lf / 2), H * py, 0.04); pivo.add(p);
        }
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), latao);
        m.position.set(-lado * (lf - 0.12), H * 0.46, 0.09); pivo.add(m);
      }
      pivo.userData.lado = lado;
      this.porta.add(pivo); this.pivos.push(pivo);
    }
    this.olho = Math.min(1.6, H * 0.66);
  }

  // Toca a animação e resolve quando a tela volta a ficar preta.
  tocar(estilo = 'porta') {
    this.estilo = estilo;
    this._montar(estilo);
    this.t = 0; this.ativa = true; this.somTocou = false;
    return new Promise((ok) => { this.fim = ok; });
  }

  atualizar(dt, aspecto) {
    if (!this.ativa) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const chega = suave(trecho(k, 0.0, 0.46)), abre = suave(trecho(k, 0.4, 0.8)), passa = suave(trecho(k, 0.6, 1.0));
    const z = 4.6 - chega * 2.5 - passa * 3.5; // para a uns dois metros, vê a porta abrir, e só então atravessa
    const andando = (k < 0.46 || k > 0.6) ? Math.sin(this.t * 9) * 0.022 : 0;
    this.camera.aspect = aspecto; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, this.olho + andando, z);
    this.camera.lookAt(0, this.olho - 0.05, z - 3);
    for (const p of this.pivos) p.rotation.y = p.userData.lado * abre * 1.75;
    if (abre > 0.02 && !this.somTocou) { this.somTocou = true; this.som.currentTime = 0; this.som.play().catch(() => {}); }
    this.luz.intensity = 14 * suave(trecho(k, 0, 0.12)) * (1 - suave(trecho(k, 0.82, 0.98)));
    if (k >= 1 && this.fim) { const f = this.fim; this.fim = null; f(); }
  }
}
