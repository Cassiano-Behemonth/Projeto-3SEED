// Criaturas como figuras em pé: o vídeo do monstro num painel vertical que gira para encarar a câmera.
import * as THREE from 'three';
import { brilho } from '../util/texturas.js';

export class Monstros {
  constructor(cena, camera, canvas, controles, mundo) {
    this.cena = cena; this.camera = camera; this.canvas = canvas; this.controles = controles; this.mundo = mundo;
    this.lista = []; this.selecionado = null; this.aoMudar = () => {}; this.mapa = 'cidade';
    this.restricao = null; // (criatura, x, z) => { x, z, y } quando há colisão no mapa atual
    this.contador = 0;     // cada criatura ganha um número, usado para espelhar na segunda tela
    this.bloqueado = false; // na segunda tela ninguém arrasta nada
    this.raio = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.geoChao = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.texSombra = brilho(true);
    this.texBrilho = brilho();
    this.carregador = new THREE.TextureLoader();
    this.somLanterna = new Audio('assets/sons/lanterna.mp3');
    this.arrasto = null;
    // Em captura, para decidir antes dos controles de câmera.
    canvas.addEventListener('pointerdown', (e) => this._descer(e), { capture: true });
    window.addEventListener('pointermove', (e) => this._mover(e));
    window.addEventListener('pointerup', () => this._soltar());
  }

  // Personagem com frente e costas (imagens paradas) e, se tiver, uma lanterna que ilumina de verdade.
  _invocarPersonagem(def, x, z) {
    const vistas = {};
    for (const [nome, q] of Object.entries(def.vistas)) {
      const tex = this.carregador.load(q.arquivo);
      tex.colorSpace = THREE.SRGBColorSpace;
      vistas[nome] = { ...q, tex, aspecto: q.w / q.h };
    }
    const figura = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: vistas.costas.tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    const sombra = new THREE.Mesh(this.geoChao, new THREE.MeshBasicMaterial({ map: this.texSombra, transparent: true, opacity: 0.6, depthWrite: false }));
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb3261e, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    sombra.renderOrder = 3; anel.renderOrder = 4; anel.visible = false;
    const grupo = new THREE.Group();
    grupo.add(sombra, anel, figura);
    // Nasce olhando para onde a câmera olha (de costas para ela).
    const dir = new THREE.Vector3().subVectors(this.controles.target, this.camera.position);
    const m = { def, grupo, figura, sombra, anel, video: null, tex: null, altura: def.altura, aspecto: 0.38, mapa: this.mapa, vistas, vista: 'costas', espelho: false, pose: 'parado', andandoAte: 0, rumo: Math.atan2(dir.x, dir.z), ganho: def.ganho ?? 1 };
    m.aspecto = vistas.costas.aspecto;
    if (def.lanterna) {
      m.luz = new THREE.PointLight(0xffb45e, 0, 10, 1.6);
      m.luz.castShadow = this.mapa !== 'cidade'; // na cidade a sombra custaria caro demais
      m.luz.shadow.mapSize.set(512, 512);
      m.luz.shadow.bias = -0.004;
      m.luz.shadow.autoUpdate = false; // a sombra da lanterna só é refeita quando precisa (ver atualizar)
      m.chama = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texBrilho, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      m.acesa = true;
      this.cena.add(m.luz, m.chama);
    }
    figura.userData.monstro = m;
    this._escala(m);
    grupo.position.set(x, this._chao(x, z), z);
    this.cena.add(grupo);
    m.uid = ++this.contador;
    this.lista.push(m);
    this.selecionar(m);
    return m;
  }
  girar(m, angulo) { if (m?.vistas) m.rumo += angulo; }
  definirPose(m, pose) { if (m?.vistas && (pose === 'parado' || m.vistas[pose])) { m.pose = pose; this.aoMudar(); } }
  alternarLanterna(m) {
    if (!m?.luz) return;
    m.acesa = !m.acesa;
    this.somLanterna.currentTime = 0; this.somLanterna.play().catch(() => {});
    this.aoMudar();
  }

  invocar(def, x, z) {
    if (def.vistas) return this._invocarPersonagem(def, x, z);
    const video = document.createElement('video');
    video.src = 'assets/monstros/' + encodeURIComponent(def.arquivo);
    video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'auto';
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const figura = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide }));
    const sombra = new THREE.Mesh(this.geoChao, new THREE.MeshBasicMaterial({ map: this.texSombra, transparent: true, opacity: 0.6, depthWrite: false }));
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb3261e, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    sombra.renderOrder = 3; anel.renderOrder = 4; anel.visible = false;
    const grupo = new THREE.Group();
    grupo.add(sombra, anel, figura);
    const m = { def, grupo, figura, sombra, anel, video, tex, altura: def.altura, aspecto: 1, mapa: this.mapa };
    figura.userData.monstro = m;
    video.addEventListener('loadedmetadata', () => { m.aspecto = video.videoWidth / video.videoHeight; this._escala(m); });
    video.play().catch(() => {});
    this._escala(m);
    grupo.position.set(x, this._chao(x, z), z);
    this.cena.add(grupo);
    m.uid = ++this.contador;
    this.lista.push(m);
    this.selecionar(m);
    return m;
  }

  // Segunda tela: deixa as criaturas iguais às da janela do mestre (cria, move, ajusta e remove).
  espelhar(lista, defs) {
    const vivas = new Set();
    for (const c of lista) {
      vivas.add(c.u);
      let m = this.lista.find((x) => x.uid === c.u);
      if (!m) {
        const def = defs[c.d];
        if (!def) continue;
        const mapaAqui = this.mapa;
        this.mapa = c.m; m = this.invocar(def, c.x, c.z); this.mapa = mapaAqui;
        m.uid = c.u;
        this.selecionar(null);
      }
      m.grupo.position.set(c.x, c.y, c.z);
      if (m.altura !== c.a) this.definirAltura(m, c.a);
      if (m.vistas) { m.rumo = c.r; m.pose = c.p || 'parado'; }
      if (m.luz) m.acesa = c.l;
      m.mapa = c.m;
      m.grupo.visible = c.m === this.mapa;
      if (m.luz) m.luz.visible = m.chama.visible = m.grupo.visible;
    }
    for (const m of [...this.lista]) if (!vivas.has(m.uid)) this.remover(m);
  }

  // Cada criatura pertence ao mapa onde foi colocada.
  definirMapa(id) {
    this.mapa = id;
    for (const m of this.lista) { m.grupo.visible = m.mapa === id; if (m.luz) m.luz.visible = m.chama.visible = m.mapa === id; }
    if (this.selecionado && this.selecionado.mapa !== id) this.selecionar(null);
  }

  _escala(m) {
    const larg = m.altura * m.aspecto;
    if (!m.vistas) m.figura.scale.set(larg, m.altura, 1); // personagens ajustam a figura a cada quadro (ver atualizar)
    m.sombra.scale.set(larg * 0.95, 1, Math.max(larg * 0.45, m.altura * 0.25));
    m.sombra.position.y = 0.04;
    m.anel.scale.setScalar(Math.max(larg, 1.2) * 1.1);
    m.anel.position.y = 0.06;
    if (m.luz) { m.luz.distance = m.altura * 8; m.luz.shadow.camera.near = m.altura * 0.04; m.luz.shadow.camera.far = m.altura * 8; m.chama.scale.setScalar(m.altura * 0.42); }
  }
  definirAltura(m, altura) { m.altura = altura; this._escala(m); }

  alturaDoChao(x, z, ref) { return this._chao(x, z, ref); }

  // Altura do chão (calçada, telhado, degrau) no ponto x,z.
  // ref: altura em que a criatura está. O que fica mais de uma pessoa acima dela (vela, verga, marquise) não é chão.
  _chao(x, z, ref = null) {
    this.raio.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
    this.raio.far = 500;
    const toque = this.raio.intersectObjects(this.mundo.solidos, true).find((t) => t.face && t.face.normal.y > 0.3 && !t.object.isInstancedMesh && !t.object.material.transparent && !t.object.userData.teto && (ref == null || t.point.y <= ref + 2.1));
    this.raio.far = Infinity;
    return toque ? toque.point.y : 0;
  }

  selecionar(m) {
    if (this.selecionado) this.selecionado.anel.visible = false;
    this.selecionado = m;
    if (m) m.anel.visible = true;
    this.aoMudar();
  }
  remover(m) {
    if (!m) return;
    if (m.video) { m.video.pause(); m.video.removeAttribute('src'); m.video.load(); m.tex.dispose(); }
    if (m.luz) { this.cena.remove(m.luz, m.chama); m.luz.dispose(); }
    m.figura.material.dispose();
    this.cena.remove(m.grupo);
    this.lista = this.lista.filter((x) => x !== m);
    if (this.selecionado === m) this.selecionado = null;
    this.aoMudar();
  }

  _apontar(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.mouse, this.camera);
  }
  _descer(e) {
    if (this.bloqueado || e.button !== 0 || !this.lista.length) return;
    this._apontar(e);
    const toque = this.raio.intersectObjects(this.lista.filter((m) => m.mapa === this.mapa).map((m) => m.figura), false)[0];
    if (!toque) { if (this.selecionado && !e.shiftKey) this.selecionar(null); return; }
    const m = toque.object.userData.monstro;
    this.selecionar(m);
    this.plano.constant = -m.grupo.position.y;
    const p = new THREE.Vector3();
    this.raio.ray.intersectPlane(this.plano, p);
    this.arrasto = { m, dx: m.grupo.position.x - p.x, dz: m.grupo.position.z - p.z };
    this.controles.enabled = false;
    e.stopPropagation();
  }
  _mover(e) {
    if (!this.arrasto) return;
    this._apontar(e);
    const p = new THREE.Vector3();
    if (!this.raio.ray.intersectPlane(this.plano, p)) return;
    const { m, dx, dz } = this.arrasto;
    const ax = m.grupo.position.x, az = m.grupo.position.z;
    const r = this.restricao?.(m, p.x + dx, p.z + dz);
    if (r) { m.grupo.position.set(r.x, r.y, r.z); this.arrasto.fisica = true; }
    else { m.grupo.position.x = p.x + dx; m.grupo.position.z = p.z + dz; }
    // Personagem vira para o lado em que está sendo levado.
    const mx = m.grupo.position.x - ax, mz = m.grupo.position.z - az;
    if (m.vistas && Math.hypot(mx, mz) > m.altura * 0.012) { m.rumo = Math.atan2(mx, mz); m.andandoAte = this.t + 0.22; }
  }
  _soltar() {
    if (!this.arrasto) return;
    const m = this.arrasto.m;
    if (!this.arrasto.fisica) m.grupo.position.y = this._chao(m.grupo.position.x, m.grupo.position.z);
    this.arrasto = null;
    this.controles.enabled = true;
  }

  atualizar(brilhoFiguras, t = 0) {
    this.t = t;
    const c = this.camera.position;
    for (const m of this.lista) {
      const p = m.grupo.position;
      m.figura.rotation.y = Math.atan2(c.x - p.x, c.z - p.z);
      if (m.vistas) {
        // De que lado a câmera vê o personagem: ângulo entre a frente dele e a direção até a câmera.
        const n = Math.hypot(c.x - p.x, c.z - p.z) || 1, tx = (c.x - p.x) / n, tz = (c.z - p.z) / n;
        const frente = Math.sin(m.rumo) * tx + Math.cos(m.rumo) * tz;       // 1 = câmera bem na frente dele
        const esquerda = Math.cos(m.rumo) * tx - Math.sin(m.rumo) * tz;     // > 0 = câmera do lado esquerdo dele
        const ang = Math.acos(Math.min(1, Math.max(-1, frente)));           // 0 (frente) a pi (costas)
        const faixa = Math.min(4, Math.floor((ang + Math.PI / 8) / (Math.PI / 4)));
        // Sem ciclo de caminhada (ficava truncado): ele fica na pose escolhida ou parado, virado para o lado certo.
        const balanco = 0;
        const nome = m.pose !== 'parado' ? m.pose : ['frente', 'tqFrente', 'perfil', 'tqCostas', 'costas'][faixa];
        const q = m.vistas[nome];
        // As vistas de lado olham para a direita; espelha quando ele deve olhar para a esquerda da tela.
        const lateral = nome !== 'frente' && nome !== 'costas' && nome !== 'erguer' && nome !== 'examinar';
        const espelho = lateral && esquerda > 0;
        if (m.vista !== nome) { m.vista = nome; m.figura.material.map = q.tex; m.aspecto = q.aspecto; }
        const respira = 1 + 0.011 * Math.sin(t * 1.7 + m.rumo); // respiração: sobe e desce devagar, a partir dos pés
        const alt = m.altura * q.alt * respira, larg = alt * q.aspecto;
        m.figura.scale.set(espelho ? -larg : larg, alt, 1);
        m.figura.position.y = m.altura * balanco;
        if (m.luz) {
          // A lanterna acompanha a mão em cada quadro.
          const ry = m.figura.rotation.y, u = (espelho ? 1 - q.lu : q.lu) - 0.5;
          const lx = p.x + Math.cos(ry) * larg * u + tx * m.altura * 0.08;
          const lz = p.z - Math.sin(ry) * larg * u + tz * m.altura * 0.08;
          const ly = p.y + alt * q.lv + m.altura * balanco;
          // Refaz a sombra quando a lanterna se move; parada, só de vez em quando (portas, outras figuras).
          const moveu = Math.abs(m.luz.position.x - lx) + Math.abs(m.luz.position.z - lz) + Math.abs(m.luz.position.y - ly) > m.altura * 0.004;
          m.quadro = (m.quadro ?? 0) + 1;
          if (moveu || m.quadro % 6 === 0) m.luz.shadow.needsUpdate = true;
          m.luz.position.set(lx, ly, lz);
          m.chama.position.copy(m.luz.position);
          const tremula = 0.9 + 0.07 * Math.sin(t * 11.3) + 0.03 * Math.sin(t * 23.7);
          m.luz.intensity = m.acesa ? 9 * m.altura ** 1.7 * tremula : 0;
          m.chama.material.opacity = m.acesa ? 0.85 * tremula : 0;
        }
      }
      // Figura colada na câmera (câmera no ombro) vira silhueta escura, como personagem de costas em primeiro plano.
      const d = Math.hypot(c.x - p.x, c.z - p.z) / m.altura;
      const perto = Math.min(1, Math.max(0, (d - 0.55) / 0.35));
      m.figura.material.color.setScalar(brilhoFiguras * (0.08 + 0.92 * perto) * (m.ganho ?? 1));
    }
  }
}
