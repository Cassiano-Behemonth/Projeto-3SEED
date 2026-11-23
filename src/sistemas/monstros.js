// Criaturas como figuras em pé: o vídeo do monstro num painel vertical que gira para encarar a câmera.
import * as THREE from 'three';
import { brilho } from '../util/texturas.js';
import { volumeDeFolha } from '../mundo/volume_folha.js';

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
    // Seleção em área (Ctrl + arrastar): as criaturas e objetos dentro do retângulo passam a andar juntos.
    this.grupoSel = new Set();
    this.caixa = null;
    this.caixaEl = document.createElement('div');
    this.caixaEl.style.cssText = 'position:fixed;display:none;border:1px dashed #e0b050;background:rgba(224,176,80,.13);pointer-events:none;z-index:30';
    document.body.append(this.caixaEl);
    this.armado = null; // criatura escolhida no painel, esperando o clique no mapa (ver armar)
    // Em captura, para decidir antes dos controles de câmera.
    canvas.addEventListener('pointerdown', (e) => this._descer(e), { capture: true });
    // O arrasto é aplicado uma vez por quadro (com a colisão, cada evento custa ~3 ms e o mouse manda vários por quadro: travava tudo)
    window.addEventListener('pointermove', (e) => { if (this.arrasto) this._pend = e; else this._mover(e); });
    window.addEventListener('pointerup', (e) => { this._aplicarPendente(); this._fecharCaixa(e); this._soltar(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.desarmar(); this.limparGrupo(); } });
    // Com um objeto ou personagem selecionado, a rolagem do mouse o gira em vez de aproximar a câmera:
    // para cima vira para a esquerda, para baixo para a direita. Shift + rolagem aproxima a câmera como sempre.
    canvas.addEventListener('wheel', (e) => this._roda(e), { capture: true, passive: false });
  }
  _roda(e) {
    const m = this.selecionado;
    if (!m || this.bloqueado || this.armado || e.shiftKey || m.mapa !== this.mapa) return;
    if (!(m.volume || (m.vistas && !m.fixo))) return; // figuras de pose fixa só espelham: a rolagem segue aproximando
    e.preventDefault(); e.stopImmediatePropagation();
    this.girar(m, -e.deltaY * (e.deltaMode === 1 ? 0.035 : 0.0022));
  }

  // Personagem com frente e costas (imagens paradas) e, se tiver, uma lanterna que ilumina de verdade.
  // Figura de pose fixa (def.fixo, com def.quadros): uma imagem por pose, que não muda com o lado de onde a câmera olha;
  // o mestre escolhe a pose e "Virar" a espelha.
  _invocarPersonagem(def, x, z, y = null) {
    const vistas = {};
    for (const [nome, q] of Object.entries(def.vistas ?? def.quadros)) {
      const tex = this.carregador.load(q.arquivo);
      tex.colorSpace = THREE.SRGBColorSpace;
      vistas[nome] = { ...q, tex, aspecto: q.w / q.h };
    }
    const inicial = def.fixo ? (def.poses?.[0]?.[0] ?? Object.keys(vistas)[0]) : 'costas';
    const figura = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: vistas[inicial].tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    const sombra = new THREE.Mesh(this.geoChao, new THREE.MeshBasicMaterial({ map: this.texSombra, transparent: true, opacity: 0.6, depthWrite: false }));
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb3261e, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    sombra.renderOrder = 3; anel.renderOrder = 4; anel.visible = false;
    const grupo = new THREE.Group();
    grupo.add(sombra, anel, figura);
    // Nasce olhando para onde a câmera olha (de costas para ela).
    const dir = new THREE.Vector3().subVectors(this.controles.target, this.camera.position);
    const m = { def, grupo, figura, sombra, anel, video: null, tex: null, altura: def.altura, aspecto: 0.38, mapa: this.mapa, vistas, vista: inicial, espelho: false, fixo: !!def.fixo, pose: def.fixo ? inicial : 'parado', andandoAte: 0, rumo: Math.atan2(dir.x, dir.z), ganho: def.ganho ?? 1 };
    m.aspecto = vistas[inicial].aspecto;
    if (def.lanterna || def.lanternaFrente) {
      // lanternaFrente (os players): feixe de lanterna que aponta para a frente do boneco e vira com ele (ver atualizar).
      m.luz = def.lanternaFrente ? new THREE.SpotLight(0xffe0ac, 0, 10, 0.5, 0.75, 1.5) : new THREE.PointLight(0xffb45e, 0, 10, 1.6);
      if (def.lanternaFrente) { this.cena.add(m.luz.target); m.direcaoLuz = new THREE.Vector3(0, 0, 1); }
      m.luz.castShadow = this.mapa !== 'cidade'; // na cidade a sombra custaria caro demais
      m.luz.shadow.mapSize.set(512, 512);
      m.luz.shadow.bias = -0.004;
      m.luz.shadow.autoUpdate = false; // a sombra da lanterna só é refeita quando precisa (ver atualizar)
      m.chama = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texBrilho, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      m.acesa = !def.lanternaFrente; // com lanternaFrente (o feixe), nasce apagada; com lanterna (a luz em volta), acesa
      this.cena.add(m.luz, m.chama);
    }
    figura.userData.monstro = m;
    this._escala(m);
    grupo.position.set(x, y ?? this._chao(x, z), z);
    this.cena.add(grupo);
    m.uid = ++this.contador;
    this.lista.push(m);
    this.selecionar(m);
    return m;
  }
  // Objeto em 3D que o mestre arrasta e gira (carro, armadilha): def.volume = { comp, larg, alt, atlas, F, S, B, T }.
  // O volume é esculpido pelas silhuetas das vistas da folha (ver volume_folha.js). A frente do objeto aponta para +z quando
  // rumo = 0. "alt" é a altura real em metros; a altura da criatura (m.altura) escala o conjunto todo.
  _invocarObjeto(def, x, z, y = null) {
    const v = def.volume, C = v.comp, W = v.larg, H = v.alt;
    const mat = new THREE.MeshStandardMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.12 });
    const malha = new THREE.Mesh(new THREE.BufferGeometry(), mat); malha.castShadow = malha.receiveShadow = true; malha.visible = false;
    volumeDeFolha(v.atlas, { F: v.F, S: v.S, B: v.B, T: v.T, W, H, D: C, fatias: v.fatias, redondo: v.redondo, plano: v.plano, cruzado: v.cruzado })
      .then(({ geometria, textura }) => { malha.geometry = geometria; mat.map = mat.emissiveMap = textura; mat.needsUpdate = true; malha.visible = true; })
      .catch((e) => console.warn(e.message));
    const corpo = new THREE.Group();
    const sombra = new THREE.Mesh(this.geoChao, new THREE.MeshBasicMaterial({ map: this.texSombra, transparent: true, opacity: 0.55, depthWrite: false }));
    sombra.scale.set(W * 1.3, 1, C * 1.15); sombra.position.y = 0.03; sombra.renderOrder = 3;
    corpo.add(malha, sombra);
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb3261e, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    anel.renderOrder = 4; anel.visible = false;
    const grupo = new THREE.Group();
    grupo.add(anel, corpo);
    const dir = new THREE.Vector3().subVectors(this.controles.target, this.camera.position);
    const m = { def, grupo, figura: corpo, sombra, anel, video: null, tex: null, volume: v, altura: def.altura ?? H, aspecto: 1, mapa: this.mapa, rumo: Math.atan2(dir.x, dir.z), pose: '' };
    malha.userData.monstro = m;
    this._escala(m);
    corpo.rotation.y = m.rumo;
    grupo.position.set(x, y ?? this._chao(x, z), z);
    this.cena.add(grupo);
    m.uid = ++this.contador;
    this.lista.push(m);
    this.selecionar(m);
    return m;
  }
  // Figura de pose fixa: virar é espelhar (olhar para o outro lado). Objeto em 3D: gira no chão.
  girar(m, angulo) { if (m?.volume) { m.rumo += angulo; this.aoMudar(); return; } if (!m?.vistas) return; if (m.fixo) { m.espelho = !m.espelho; this.aoMudar(); } else m.rumo += angulo; }
  definirPose(m, pose) { if (m?.vistas && ((pose === 'parado' && !m.fixo) || m.vistas[pose])) { m.pose = pose; this.aoMudar(); } }
  alternarLanterna(m) {
    if (!m?.luz) return;
    m.acesa = !m.acesa;
    this.somLanterna.currentTime = 0; this.somLanterna.play().catch(() => {});
    this.aoMudar();
  }

  // Lanternas do grupo marcado com Ctrl: todas acendem ou todas apagam (o novo estado é o contrário do que a maioria tem agora).
  lanternasDoGrupo() { return [...this.grupoSel].filter((m) => m.luz && m.mapa === this.mapa); }
  alternarLanternasGrupo() {
    const alvo = this.lanternasDoGrupo();
    if (!alvo.length) return false;
    const acesas = alvo.filter((m) => m.acesa).length, novo = acesas * 2 <= alvo.length;   // metade ou mais apagadas: acende tudo
    for (const m of alvo) m.acesa = novo;
    this.somLanterna.currentTime = 0; this.somLanterna.play().catch(() => {});
    this.aoMudar();
    return true;
  }

  invocar(def, x, z, y = null) {
    if (def.volume) return this._invocarObjeto(def, x, z, y);
    if (def.vistas || def.quadros) return this._invocarPersonagem(def, x, z, y);
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
    grupo.position.set(x, y ?? this._chao(x, z), z);
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
      this.contador = Math.max(this.contador, c.u); // criaturas restauradas não repetem o número das próximas
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
      if (m.volume) m.rumo = c.r;
      if (m.vistas) { m.rumo = c.r; m.pose = c.p || (m.fixo ? m.pose : 'parado'); if (m.fixo) m.espelho = !!c.e; }
      if (m.luz) m.acesa = c.l;
      m.ocupado = !!c.oc; m.ocupantes = Array.isArray(c.oc) ? c.oc : null; // veículo com gente dentro (e quem)
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
    if (m.volume) { // objeto em 3D: escala o conjunto pela altura (alt = altura real do modelo)
      const v = m.volume; m.figura.scale.setScalar(m.altura / v.alt);
      m.anel.scale.setScalar(Math.max(v.comp, v.larg) * (m.altura / v.alt) * 1.15); m.anel.position.y = 0.06;
      return;
    }
    const larg = m.altura * m.aspecto;
    if (!m.vistas) m.figura.scale.set(larg, m.altura, 1); // personagens ajustam a figura a cada quadro (ver atualizar)
    m.sombra.scale.set(larg * 0.95, 1, Math.max(larg * 0.45, m.altura * 0.25));
    m.sombra.position.y = 0.04;
    m.anel.scale.setScalar(Math.max(larg, 1.2) * 1.1);
    m.anel.position.y = 0.06;
    if (m.luz) { m.luz.distance = m.altura * 8; m.luz.shadow.camera.near = m.altura * 0.04; m.luz.shadow.camera.far = m.altura * 8; m.chama.scale.setScalar(m.altura * (m.def.lanternaFrente ? 0.14 : 0.42)); }
  }
  definirAltura(m, altura) { m.altura = altura; this._escala(m); }

  alturaDoChao(x, z, ref) { return this._chao(x, z, ref); }

  // Altura do chão (calçada, telhado, degrau) no ponto x,z.
  // ref: altura em que a criatura está. O que fica mais de uma pessoa acima dela (vela, verga, marquise) não é chão.
  _chao(x, z, ref = null) {
    this.raio.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
    this.raio.far = 500;
    const toque = this.raio.intersectObjects(this.mundo.solidos, true).find((t) => t.face && t.face.normal.y > 0.3 && !t.object.isInstancedMesh && !t.object.material.transparent && !t.object.userData.teto && !t.object.userData.oculto && (ref == null || t.point.y <= ref + 2.1));
    this.raio.far = Infinity;
    return toque ? toque.point.y : 0;
  }

  selecionar(m) {
    if (this.selecionado) this.selecionado.anel.visible = false;
    this.selecionado = m;
    if (m) m.anel.visible = true;
    for (const g of this.grupoSel) g.anel.visible = true;
    this.aoMudar();
  }
  // ───── Seleção em área ─────
  limparGrupo() {
    for (const g of this.grupoSel) if (g !== this.selecionado) g.anel.visible = false;
    this.grupoSel.clear();
  }
  _abrirCaixa(e) {
    this.caixa = { x0: e.clientX, y0: e.clientY };
    this.controles.enabled = false;
    this._mostrarCaixa(e);
  }
  _mostrarCaixa(e) {
    const c = this.caixa, x = Math.min(c.x0, e.clientX), y = Math.min(c.y0, e.clientY);
    Object.assign(this.caixaEl.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - c.x0) + 'px', height: Math.abs(e.clientY - c.y0) + 'px' });
  }
  _fecharCaixa(e) {
    if (!this.caixa) return;
    const c = this.caixa; this.caixa = null; this.caixaEl.style.display = 'none'; this.controles.enabled = true;
    const x0 = Math.min(c.x0, e.clientX), x1 = Math.max(c.x0, e.clientX), y0 = Math.min(c.y0, e.clientY), y1 = Math.max(c.y0, e.clientY);
    this.limparGrupo();
    if (x1 - x0 < 6 && y1 - y0 < 6) { this.aoMudar(); return; }
    const r = this.canvas.getBoundingClientRect(), v = new THREE.Vector3();
    for (const m of this.lista) {
      if (m.mapa !== this.mapa) continue;
      v.copy(m.grupo.position); v.y += m.altura * 0.4; v.project(this.camera);
      if (v.z > 1) continue; // atrás da câmera
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) { this.grupoSel.add(m); m.anel.visible = true; }
    }
    this.aoMudar();
  }
  remover(m) {
    if (!m) return;
    if (m.video) { m.video.pause(); m.video.removeAttribute('src'); m.video.load(); m.tex.dispose(); }
    if (m.luz) { this.cena.remove(m.luz, m.chama); if (m.luz.target) this.cena.remove(m.luz.target); m.luz.dispose(); }
    if (m.volume) m.figura.traverse((o) => { o.material?.dispose(); o.geometry?.dispose(); });
    else m.figura.material.dispose();
    this.cena.remove(m.grupo);
    this.lista = this.lista.filter((x) => x !== m);
    if (this.selecionado === m) this.selecionado = null;
    this.grupoSel.delete(m);
    this.aoMudar();
  }

  // Escolhe uma criatura para pôr no mapa: o próximo clique (botão esquerdo, sem arrastar) diz onde ela nasce.
  // aoColocar(def, { x, y, z }) cria de fato. Shift no clique mantém armado, para pôr várias; Esc ou clicar fora do mapa cancela.
  armar(def, aoColocar) { this.armado = { def, aoColocar }; this.canvas.style.cursor = 'crosshair'; this.aoMudar(); }
  desarmar() { if (!this.armado) return; this.armado = null; this.canvas.style.cursor = ''; this.aoMudar(); }
  // Ponto do mapa sob o cursor: o primeiro chão (face voltada para cima) que o raio da câmera encontra, na altura em que
  // ele está (piso de uma cabine, telhado, calçada). Sem chão, cai no plano do zero.
  _pontoClicado(e) {
    this._apontar(e);
    const toque = this.raio.intersectObjects(this.mundo.solidos, true).find((t) => t.face && t.face.normal.y > 0.3 && !t.object.isInstancedMesh && !t.object.material.transparent && !t.object.userData.teto && !t.object.userData.oculto);
    if (toque) return { x: toque.point.x, y: toque.point.y, z: toque.point.z };
    const p = new THREE.Vector3();
    this.plano.constant = 0;
    return this.raio.ray.intersectPlane(this.plano, p) ? { x: p.x, y: 0, z: p.z } : null;
  }
  _apontar(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.mouse, this.camera);
  }
  _descer(e) {
    if (this.armado && !this.bloqueado && e.button === 0) {
      const ponto = this._pontoClicado(e), { def, aoColocar } = this.armado;
      if (e.shiftKey && ponto) { aoColocar(def, ponto); } else this.desarmar();
      if (!e.shiftKey && ponto) aoColocar(def, ponto);
      // O clique que acaba de pôr a criatura não deve também abrir a porta que estiver embaixo dele.
      const engolir = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', engolir, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', engolir, { capture: true }), 400);
      e.stopPropagation(); e.preventDefault();
      return;
    }
    if (!this.bloqueado && e.button === 0 && e.ctrlKey && !this.armado) { this._abrirCaixa(e); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (this.bloqueado || e.button !== 0 || !this.lista.length) return;
    this._apontar(e);
    const toque = this.raio.intersectObjects(this.lista.filter((m) => m.mapa === this.mapa).map((m) => m.figura), true).filter((h) => h.object.userData.monstro)[0];
    if (!toque) { if (!e.shiftKey) { this.limparGrupo(); if (this.selecionado) this.selecionar(null); } return; }
    const m = toque.object.userData.monstro;
    if (this.grupoSel.size && !this.grupoSel.has(m)) this.limparGrupo(); // clicou em outro: o grupo se desfaz
    this.selecionar(m);
    this.plano.constant = -m.grupo.position.y;
    const p = new THREE.Vector3();
    this.raio.ray.intersectPlane(this.plano, p);
    this.arrasto = { m, dx: m.grupo.position.x - p.x, dz: m.grupo.position.z - p.z, grupo: this.grupoSel.has(m) && this.grupoSel.size > 1 ? [...this.grupoSel].filter((g) => g !== m) : [] };
    this.controles.enabled = false;
    e.stopPropagation();
  }
  _mover(e) {
    if (this.caixa) { this._mostrarCaixa(e); return; }
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
    // O resto do grupo anda o mesmo tanto (o chão de cada um é refeito ao soltar).
    for (const o of this.arrasto.grupo) {
      const nx = o.grupo.position.x + mx, nz = o.grupo.position.z + mz, r2 = this.restricao?.(o, nx, nz);
      // Se a colisão prenderia quem não está sob o mouse (uma árvore, uma cerca, ou já nascido encostado nela), ele segue o grupo
      // mesmo assim: o mestre está movendo o grupo inteiro, e um só ficando para trás é pior do que atravessar uma peça.
      const queria = Math.hypot(mx, mz);
      if (r2 && Math.hypot(r2.x - o.grupo.position.x, r2.z - o.grupo.position.z) >= queria * 0.5) o.grupo.position.set(r2.x, r2.y, r2.z);
      else { o.grupo.position.x = nx; o.grupo.position.z = nz; }
    }
    if (m.vistas && !m.fixo && Math.hypot(mx, mz) > m.altura * 0.012) { m.rumo = Math.atan2(mx, mz); m.andandoAte = this.t + 0.22; }
    // Figura de pose fixa com "poseAndar": afastando-se da câmera mostra as costas; vindo ou de lado, a pose de andar (virada para o lado do giro).
    const pa = m.fixo && m.def.poseAndar, mv = Math.hypot(mx, mz);
    if (pa && pa.diagonais) {
      // A direção vem de vários movimentos seguidos (média que esquece o passado aos poucos), e a pose só muda de faixa quando o ângulo
      // passa da divisa com folga (histerese): assim ela não pisca quando o mouse treme perto da divisa.
      const A = this.arrasto;
      // O ângulo é medido na TELA (para onde o boneco anda aos olhos do mestre), não no chão: com a perspectiva, um arrasto em
      // diagonal na tela é quase todo "para o fundo" no chão e a pose nunca saía de costas.
      const proj = (x, z) => { const v = new THREE.Vector3(x, m.grupo.position.y, z).project(this.camera); return [v.x * this.camera.aspect, v.y]; };
      const p1 = proj(m.grupo.position.x, m.grupo.position.z), p0 = proj(m.grupo.position.x - mx, m.grupo.position.z - mz);
      const ex = p1[0] - p0[0], ey = p1[1] - p0[1];
      A.sx = (A.sx ?? 0) * 0.88 + ex; A.sy = (A.sy ?? 0) * 0.88 + ey;   // (dx e dz do arrasto são o deslocamento do clique: não mexer)
      const sm = Math.hypot(A.sx, A.sy);
      if (sm > 0.012) {   // movimento pequeno demais (tremida do mouse, ou longe no fundo): mantém a pose
        const ang = Math.atan2(Math.abs(A.sx), A.sy) * 180 / Math.PI;   // 0 = sobe na tela (indo para longe), 90 = de lado, 180 = desce (vindo para a câmera)
        const lado = A.sx / sm;
        // faixas: 0 costas, 1 diagonal de costas, 2 diagonal de frente, 3 parado (de frente reto); cada divisa ganha 10° de folga para quem já está na faixa
        const lim = [22, 68, 155];
        const atual = A.faixa ?? (ang < lim[0] ? 0 : ang < lim[1] ? 1 : ang < lim[2] ? 2 : 3);
        let f = atual;
        while (f > 0 && ang < lim[f - 1] - 10) f--;
        while (f < 3 && ang > lim[f] + 10) f++;
        A.faixa = f;
        if (Math.abs(lado) > 0.12 || A.lado === undefined) A.lado = lado >= 0 ? 'D' : 'E';   // só troca de lado com um lado claro
        m.pose = f === 0 ? pa.costas : f === 1 ? 'diagCostas' + A.lado : f === 2 ? 'diagFrente' + A.lado : pa.parado;
      }
    } else if (pa && mv > m.altura * 0.012) {
      const c = this.camera.position, fx = m.grupo.position.x - c.x, fz = m.grupo.position.z - c.z, fn = Math.hypot(fx, fz) || 1;
      const afasta = (mx * fx + mz * fz) / (mv * fn), lado = (mx * -fz + mz * fx) / (mv * fn);
      if (afasta > 0.4 && m.vistas[pa.costas]) m.pose = pa.costas;
      else { m.pose = pa.frente; if (pa.frente !== pa.parado && Math.abs(lado) > 0.15) m.espelho = lado < 0; }
    }
      // O resto do grupo ganha a mesma pose de andar (sem isto só o boneco sob o mouse virava de costas ou de lado).
    if (mv > m.altura * 0.012 || this.arrasto.faixa !== undefined) for (const o of this.arrasto.grupo) {
      const po = o.fixo && o.def.poseAndar;
      if (!po) continue;
      if (po.diagonais && this.arrasto.faixa !== undefined) {
        const f = this.arrasto.faixa, l = this.arrasto.lado ?? 'D';
        o.pose = f === 0 ? po.costas : f === 1 ? 'diagCostas' + l : f === 2 ? 'diagFrente' + l : po.parado;
      } else if (mv > m.altura * 0.012) {
        const c = this.camera.position, fx = o.grupo.position.x - c.x, fz = o.grupo.position.z - c.z, fn = Math.hypot(fx, fz) || 1;
        const afasta = (mx * fx + mz * fz) / (mv * fn), lado = (mx * -fz + mz * fx) / (mv * fn);
        if (afasta > 0.4 && o.vistas[po.costas]) o.pose = po.costas;
        else { o.pose = po.frente; if (po.frente !== po.parado && Math.abs(lado) > 0.15) o.espelho = lado < 0; }
      }
    }
  }
  _soltar() {
    if (!this.arrasto) return;
    const m = this.arrasto.m;
    if (m.fixo && m.def.poseAndar && m.pose === m.def.poseAndar.frente) m.pose = m.def.poseAndar.parado; // parou vindo de frente: fica em pé
    else if (m.fixo && m.def.poseAndar?.diagonais && m.pose.startsWith('diagFrente')) m.pose = m.def.poseAndar.parado;
    for (const o of this.arrasto.grupo) {
      const po = o.fixo && o.def.poseAndar;
      if (po && (o.pose === po.frente || o.pose.startsWith('diagFrente'))) o.pose = po.parado;   // parou vindo de frente: fica em pé
      o.grupo.position.y = this._chao(o.grupo.position.x, o.grupo.position.z);
    }
    if (!this.arrasto.fisica) m.grupo.position.y = this._chao(m.grupo.position.x, m.grupo.position.z);
    this.arrasto = null;
    this.controles.enabled = true;
  }

  _aplicarPendente() { const e = this._pend; this._pend = null; if (e && this.arrasto) this._mover(e); }
  atualizar(brilhoFiguras, t = 0) {
    this.t = t;
    this._aplicarPendente();
    const c = this.camera.position;
    for (const m of this.lista) {
      const p = m.grupo.position;
      if (m.volume) { m.figura.rotation.y = m.rumo; continue; } // objeto em 3D: não encara a câmera
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
        const nome = m.fixo || m.pose !== 'parado' ? m.pose : ['frente', 'tqFrente', 'perfil', 'tqCostas', 'costas'][faixa];
        const q = m.vistas[nome];
        // As vistas de lado olham para a direita; espelha quando ele deve olhar para a esquerda da tela.
        // A figura de pose fixa só espelha quando o mestre manda ("Virar").
        const lateral = nome !== 'frente' && nome !== 'costas' && nome !== 'erguer' && nome !== 'examinar';
        const espelho = m.fixo ? m.espelho : lateral && esquerda > 0;
        if (m.vista !== nome) { m.vista = nome; m.figura.material.map = q.tex; m.aspecto = q.aspecto; }
        const respira = q.respira === false ? 1 : 1 + 0.011 * Math.sin(t * 1.7 + m.rumo); // respiração: sobe e desce devagar, a partir dos pés
        const alt = m.altura * q.alt * respira, larg = alt * q.aspecto;
        m.figura.scale.set(espelho ? -larg : larg, alt, 1);
        m.figura.position.y = m.altura * balanco;
        if (m.luz && m.def.lanternaFrente) {
          // Feixe para a frente: o boneco encara a câmera (e olha um pouco para o lado da tela em que a pose olha); de costas, o feixe vai para longe dela.
          // O lado da tela para onde cada pose olha vem da prancha (as poses olham para a direita; espelhar inverte).
          const viraTela = { parado: 0.2, agachado: 0.9, investigando: 1.1, luta: 1.0, observando: 0.9, interagindo: 0.9 }[nome] ?? 0.4;
          const dx = -tx, dz = -tz;                       // da câmera para o boneco
          let fx, fz;
          const diag = nome.startsWith('diag');
          if (diag) {
            // Poses inclinadas: o feixe vai a 45° da câmera, para o lado em que o boneco anda (D = direita da tela, E = esquerda), para longe dela nas de costas.
            const rx = -dz, rz = dx, lado = nome.endsWith('D') ? 1 : -1, c45 = Math.SQRT1_2;
            const base = nome.startsWith('diagCostas') ? 1 : -1;      // 1 = para longe da câmera, -1 = para ela
            fx = dx * base * c45 + rx * lado * c45; fz = dz * base * c45 + rz * lado * c45;
          } else if (nome === 'costas') { fx = dx; fz = dz; }
          else {
            const rx = -dz, rz = dx, s = (espelho ? -1 : 1) * Math.sin(viraTela), k = Math.cos(viraTela);   // direita da tela
            fx = tx * k + rx * s; fz = tz * k + rz * s;
          }
          const fn = Math.hypot(fx, fz) || 1; fx /= fn; fz /= fn;
          m.direcaoLuz.set(fx, 0, fz);
          const altLuz = p.y + alt * (nome === 'agachado' ? 0.42 : 0.6);
          const lx = p.x + fx * m.altura * 0.16, lz = p.z + fz * m.altura * 0.16;
          const moveu = Math.abs(m.luz.position.x - lx) + Math.abs(m.luz.position.z - lz) + Math.abs(m.luz.position.y - altLuz) > m.altura * 0.004;
          m.quadro = (m.quadro ?? 0) + 1;
          m.luz.position.set(lx, altLuz, lz);
          m.luz.target.position.set(lx + fx * m.altura * 1.5, p.y, lz + fz * m.altura * 1.5);   // mira o chão à frente (lanterna na mão, inclinada para baixo)
          m.luz.target.updateMatrixWorld();
          if (moveu || m.quadro % 6 === 0) m.luz.shadow.needsUpdate = true;
          m.chama.position.set(lx, altLuz, lz);
          const tremula = 0.96 + 0.03 * Math.sin(t * 9.1);
          m.luz.intensity = m.acesa ? 22 * m.altura ** 1.7 * tremula : 0;
          m.chama.material.opacity = m.acesa ? 0.45 : 0;
        } else if (m.luz) {
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
