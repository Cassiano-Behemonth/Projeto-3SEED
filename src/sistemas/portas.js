// Portas dentro dos interiores: começam fechadas, abrem com um clique e revelam a sala atrás delas.
import * as THREE from 'three';

export class Portas {
  constructor(camera, canvas, mundo) {
    this.camera = camera; this.canvas = canvas; this.mundo = mundo;
    this.raio = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.som = new Audio('assets/sons/porta.mp3');
    this.aoMudar = () => {};
    this.bloqueado = false; // na segunda tela ninguém clica em porta
    let inicio = null;
    canvas.addEventListener('pointerdown', (e) => { inicio = e.button === 0 ? [e.clientX, e.clientY] : null; });
    canvas.addEventListener('pointerup', (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 5) return;
      this._clicar(e);
    });
  }
  _atual() { return this.mundo.interiores[this.mundo.mapaAtual]; }

  _clicar(e) {
    const it = this._atual();
    if (this.bloqueado || !it?.portas?.length) return;
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.mouse, this.camera);
    const alvos = it.portas.filter((p) => !p.fixa).map((p) => p.folha);
    // A porta só vale se nada sólido estiver na frente dela (parede, sala ainda oculta).
    const toque = this.raio.intersectObjects([...alvos, ...this._tampas(it)], false)[0];
    if (!toque || !toque.object.userData.porta) return;
    this.alternar(toque.object.userData.porta);
  }
  _tampas(it) { return Object.values(it.salas).filter((s) => !s.revelada).flatMap((s) => s.malhas); }

  alternar(p, abrir = !p.aberta) {
    p.aberta = abrir;
    this.som.currentTime = 0; this.som.play().catch(() => {});
    if (abrir) for (const id of p.revela) this.revelar(this._atual(), id, true);
    this.aoMudar();
  }
  revelar(it, id, sim) {
    const s = it.salas[id];
    if (!s) return;
    s.revelada = sim;
    for (const m of s.malhas) m.visible = true;
  }
  // Atalho do mestre: mostra ou esconde todas as salas (e abre/fecha as portas) do interior atual.
  tudo(sim) {
    const it = this._atual();
    if (!it) return;
    for (const id of Object.keys(it.salas)) this.revelar(it, id, sim);
    for (const p of it.portas) if (!p.fixa) p.aberta = sim;
    this.aoMudar();
  }
  temOcultas() { const it = this._atual(); return !!it && Object.values(it.salas).some((s) => !s.revelada); }
  temSalas() { const it = this._atual(); return !!it && Object.keys(it.salas).length > 0; }

  atualizar(dt) {
    for (const it of Object.values(this.mundo.interiores)) {
      for (const p of it.portas) {
        const alvo = p.aberta ? 1 : 0;
        if (p.k !== alvo) { p.k += Math.sign(alvo - p.k) * Math.min(Math.abs(alvo - p.k), dt / 0.7); p.pivo.rotation.y = p.ry + p.sentido * p.k * 1.7; }
      }
      for (const s of Object.values(it.salas)) {
        const alvo = s.revelada ? 0 : 1;
        if (s.op === alvo) continue;
        s.op += Math.sign(alvo - s.op) * Math.min(Math.abs(alvo - s.op), dt / 0.6);
        for (const m of s.malhas) { m.material.opacity = s.op; m.visible = s.op > 0.01; }
      }
    }
  }
}
