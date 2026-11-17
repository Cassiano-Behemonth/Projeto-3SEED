// Céu, sol/lua, neblina e a transição dia/noite.
import * as THREE from 'three';
import { noturnos } from '../mundo/materiais.js';

const DIA = {
  topo: '#4f8ad6', horizonte: '#f1d6ae', neblina: '#d3c2aa', dens: 0.00042,
  sol: '#ffd3a0', solInt: 4.4, solCeu: '#ffe2b0', hemiCeu: '#c4d8f5', hemiChao: '#7a6648', hemiInt: 0.75,
  expo: 1.0, bloom: 0.14, env: 0.55, figuras: 1.0, dir: [-0.62, 0.42, 0.66],
};
const NOITE = {
  topo: '#04070f', horizonte: '#16223a', neblina: '#0e1624', dens: 0.0015,
  sol: '#9db4e6', solInt: 1.15, solCeu: '#b9c6e2', hemiCeu: '#3a4d78', hemiChao: '#10121a', hemiInt: 1.0,
  expo: 1.3, bloom: 0.55, env: 0.14, figuras: 0.62, dir: [0.42, 0.6, 0.68],
};
// Dentro de um interior: sem céu, luz de preenchimento vinda de cima e lâmpadas sempre acesas.
const INTERIOR = {
  topo: '#020203', horizonte: '#030304', neblina: '#050506', dens: 0.004,
  sol: '#dde4f2', solInt: 1.0, hemiCeu: '#8f97a8', hemiChao: '#2a2622', hemiInt: 0.6,
  expo: 1.2, bloom: 0.45, env: 0.12, figuras: 0.85, dir: [0.32, 1, 0.5],
};
// Fim de tarde: sol baixo e alaranjado, céu roxo no alto. Mistura-se por cima do dia ("hora": "entardecer").
const TARDE = {
  topo: '#3a3768', horizonte: '#f0894a', neblina: '#c58a6c', dens: 0.0006, sol: '#ff9650', solInt: 2.7, solCeu: '#ffb070',
  hemiCeu: '#b488a6', hemiChao: '#5a3a30', hemiInt: 0.85, expo: 1.08, bloom: 0.38, env: 0.4, figuras: 0.9, dir: [-0.86, 0.2, 0.46],
};
const N_LUZES = 8;
const DIST_LUA = 5800; // distância da lua à câmera (as estrelas estão a 6200 e a câmera vê até 7000)

// Lua cheia: disco claro com mares escuros e crateras, borda suave.
function texturaLua() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = 120;
  g.translate(128, 128);
  const base = g.createRadialGradient(-30, -30, 10, 0, 0, r);
  base.addColorStop(0, '#fbfcff'); base.addColorStop(0.7, '#e3e8f0'); base.addColorStop(1, '#bcc4d2');
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = base; g.fill();
  g.save(); g.clip();
  // mares: manchas grandes e escuras; crateras: anéis pequenos
  const mares = [[-38, -30, 44], [22, -48, 30], [30, 12, 40], [-18, 36, 30], [-58, 20, 22], [58, -10, 18]];
  for (const [x, y, rr] of mares) { const m = g.createRadialGradient(x, y, 0, x, y, rr); m.addColorStop(0, 'rgba(120,130,150,0.55)'); m.addColorStop(1, 'rgba(120,130,150,0)'); g.fillStyle = m; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  let s = 7;
  const acaso = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const a = acaso() * Math.PI * 2, d = Math.sqrt(acaso()) * r * 0.9, x = Math.cos(a) * d, y = Math.sin(a) * d, rr = 3 + acaso() * 9;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fillStyle = 'rgba(110,118,135,0.35)'; g.fill();
    g.beginPath(); g.arc(x - rr * 0.25, y - rr * 0.25, rr * 0.8, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2; g.stroke();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Halo do luar em volta da lua (somado ao céu).
function texturaHalo() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), m = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  m.addColorStop(0, 'rgba(190,205,235,0.55)'); m.addColorStop(0.25, 'rgba(150,170,215,0.18)'); m.addColorStop(1, 'rgba(120,140,190,0)');
  g.fillStyle = m; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Ambiente {
  constructor(cena, renderizador, mundo) {
    this.cena = cena; this.renderizador = renderizador; this.mundo = mundo;
    this.f = 1; this.alvoF = 1; // 0 = dia, 1 = noite
    this.tarde = 0; // 1 = fim de tarde por cima do dia
    this.neblinaMult = 1; this.nevoa = 0; this.interior = false; this.bloom = 0.6; this.figuras = 0.62;
    this.corNevoa = new THREE.Color(0x4a566e);
    this.luzes = true; this.luzK = 1; // luzes artificiais (lâmpadas, velas, janelas, postes): 1 = acesas, 0 = apagadas
    this._a = new THREE.Color(); this._b = new THREE.Color();

    cena.fog = new THREE.FogExp2(0x0b111c, 0.002);
    this.sol = new THREE.DirectionalLight(0xffffff, 1);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.autoUpdate = false; // refeita só quando o ponto observado muda ou a cada 3 quadros (ver atualizar)
    const sc = this.sol.shadow.camera;
    sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 10; sc.far = 1600;
    this.sol.shadow.bias = -0.0005; this.sol.shadow.normalBias = 0.5;
    cena.add(this.sol, this.sol.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    cena.add(this.hemi);

    // Cúpula do céu (acompanha a câmera) e estrelas.
    this.uCeu = {
      topo: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() },
      solCor: { value: new THREE.Color() }, solDir: { value: new THREE.Vector3(0, 1, 0) },
    };
    this.ceu = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uCeu, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 topo, horizonte, solCor, solDir; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
          vec3 c = mix(horizonte, topo, pow(h, 0.42));
          float s = max(dot(d, solDir), 0.0);
          c += solCor * (pow(s, 1200.0) * 5.0 + pow(s, 14.0) * 0.3);
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    this.ceu.renderOrder = -10; this.ceu.frustumCulled = false;
    cena.add(this.ceu);
    const pos = [];
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.95 + 0.05; v.normalize().multiplyScalar(6200);
      pos.push(v.x, v.y, v.z);
    }
    const ge = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.estrelas = new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, transparent: true, depthTest: true, depthWrite: false, fog: false }));
    this.estrelas.renderOrder = -9; this.estrelas.frustumCulled = false;
    cena.add(this.estrelas);
    // Lua: disco com mares e crateras desenhado num canvas, mais um halo; fica no céu, na direção de onde vem o luar.
    this.lua = new THREE.Group(); this.lua.renderOrder = -9; this.lua.frustumCulled = false;
    // Longe, como as estrelas (a câmera vê até 7000), para árvores e morros ficarem na frente dela.
    const disco = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaLua(), transparent: true, depthTest: true, depthWrite: false, fog: false, opacity: 0 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(), transparent: true, depthTest: true, depthWrite: false, fog: false, opacity: 0, blending: THREE.AdditiveBlending }));
    disco.scale.setScalar(DIST_LUA * 0.075); halo.scale.setScalar(DIST_LUA * 0.36); disco.renderOrder = -8; halo.renderOrder = -9;
    for (const s of [disco, halo]) { s.frustumCulled = false; this.lua.add(s); }
    this.luaDisco = disco; this.luaHalo = halo;
    cena.add(this.lua);
    this.luar = 1; this.dirLua = null; // ver definirLuar

    // Reflexo ambiente (usado pelo vidro da torre) a partir de um céu diurno.
    this._lerp(0);
    const pm = new THREE.PMREMGenerator(renderizador);
    const cenaCeu = new THREE.Scene(); cenaCeu.add(this.ceu.clone());
    cena.environment = pm.fromScene(cenaCeu, 0, 1, 200).texture;
    pm.dispose();

    // Luzes pontuais reaproveitadas: ficam sempre nos pontos de luz mais próximos do que se olha.
    this.pontuais = [];
    for (let i = 0; i < N_LUZES; i++) { const l = new THREE.PointLight(0xffc27a, 0, 48, 1.7); cena.add(l); this.pontuais.push(l); }
    this._quadro = 0;
    this._lerp(this.f);
  }

  alternar() { this.tarde = 0; this.alvoF = this.alvoF > 0.5 ? 0 : 1; return this.alvoF > 0.5; }
  alternarLuzes() { this.luzes = !this.luzes; return this.luzes; }
  definir(noite, imediato = false) { this.alvoF = noite ? 1 : 0; if (imediato) { this.f = this.alvoF; this._lerp(this.f); } }
  get noite() { return this.alvoF > 0.5; }

  _mix(a, b, f) { return this._a.set(a).lerp(this._b.set(b), f); }
  _lerp(f) {
    const n = (k) => DIA[k] + (NOITE[k] - DIA[k]) * f;
    // "luar" do mapa (1 = a noite de sempre): abaixo de 1, luar, céu, névoa e luz ambiente da noite escurecem juntos.
    const L = this.luar ?? 1, nl = (k) => DIA[k] + (NOITE[k] * L - DIA[k]) * f, escNoite = 0.35 + 0.65 * Math.min(1, L);
    const noiteCor = (c) => this._b.set(c).multiplyScalar(escNoite);
    this.uCeu.topo.value.copy(this._a.set(DIA.topo).lerp(noiteCor(NOITE.topo), f));
    this.uCeu.horizonte.value.copy(this._a.set(DIA.horizonte).lerp(noiteCor(NOITE.horizonte), f));
    this.uCeu.solCor.value.copy(this._mix(DIA.solCeu, NOITE.solCeu, f)).multiplyScalar(f > 0.5 ? 0.5 : 1);
    this.cena.fog.color.copy(this._a.set(DIA.neblina).lerp(noiteCor(NOITE.neblina), f));
    this.cena.fog.density = n('dens') * this.neblinaMult;
    this.sol.color.copy(this._mix(DIA.sol, NOITE.sol, f));
    // O sol some no meio da transição para a troca de direção não aparecer.
    this.sol.intensity = nl('solInt') * Math.abs(Math.cos(f * Math.PI)) ** 0.6;
    const d = f < 0.5 ? DIA.dir : this.dirLua ?? NOITE.dir;
    this.dir = (this.dir ?? new THREE.Vector3()).set(d[0], d[1], d[2]).normalize();
    this.uCeu.solDir.value.copy(this.dir);
    this.hemi.color.copy(this._mix(DIA.hemiCeu, NOITE.hemiCeu, f));
    this.hemi.groundColor.copy(this._mix(DIA.hemiChao, NOITE.hemiChao, f));
    this.hemi.intensity = nl('hemiInt');
    this.renderizador.toneMappingExposure = n('expo');
    this.cena.environmentIntensity = n('env');
    this.bloom = n('bloom'); this.figuras = n('figuras');
    this.estrelas.material.opacity = Math.max(0, f * 1.6 - 0.6);
    this.corNevoa.copy(this._mix('#efe6d6', '#4a566e', f));
    if (this.tarde > 0.001 && !(this.interior && !this.aberto)) this._aplicarTarde(this.tarde);
    if (this.interior && !this.aberto) this._aplicarInterior();
    // Névoa forte: o ar inteiro puxa para a cor da névoa (chão, horizonte e céu) e as estrelas somem.
    const nv = this.nevoa;
    if (nv > 0.001) {
      const fechado = this.interior && !this.aberto;
      const cn = this._a.copy(this.corNevoa).multiplyScalar(fechado ? 0.3 : 0.5 + 0.45 * (1 - f));
      this.cena.fog.color.lerp(cn, nv * (fechado ? 0.6 : 0.9));
      if (!fechado) {
        this.uCeu.horizonte.value.lerp(cn, nv * 0.9); this.uCeu.topo.value.lerp(cn, nv * 0.6);
        this.uCeu.solCor.value.multiplyScalar(1 - nv * 0.8);
        this.estrelas.material.opacity *= 1 - Math.min(1, nv * 1.4);
      }
    }
    // Dentro de casa as lâmpadas ficam acesas mesmo de dia.
    const fl = (this.interior && !this.aberto ? 1 : Math.max(f, (this.tarde ?? 0) * 0.8)) * this.luzK;
    this.fLuzes = fl;
    // Com as luzes apagadas, o piso dos interiores quase não se enxerga.
    // Mapas a céu aberto recebem sol de dia; a pintura só precisa "brilhar" um pouco à noite.
    for (const it of Object.values(this.mundo.interiores ?? {})) if (it.matPiso) it.matPiso.emissiveIntensity = it.aberto ? 0.05 + 0.3 * f * Math.min(1, L) : 0.03 + 0.35 * this.luzK;
    // A lua aparece com as estrelas, só onde há céu, e some na névoa forte.
    const vLua = this.interior && !this.aberto ? 0 : Math.max(0, f * 1.6 - 0.6) * (1 - Math.min(1, this.nevoa * 1.2));
    this.luaDisco.material.opacity = vLua; this.luaHalo.material.opacity = vLua * 0.55;
    this.cena.fog.density *= 1 + this.nevoa * (this.interior && !this.aberto ? 2.5 : 5);
    for (const e of noturnos) e.mat.emissiveIntensity = e.dia + (e.noite - e.dia) * fl;
    for (const e of this.mundo.opacidadesNoturnas) { e.mat.opacity = e.max * fl; e.obj.visible = fl > 0.02; }
    for (const o of this.mundo.soNoite) o.visible = f > 0.5;
  }

  _aplicarTarde(k) {
    const T = TARDE, c = this._b;
    this.uCeu.topo.value.lerp(c.set(T.topo), k); this.uCeu.horizonte.value.lerp(c.set(T.horizonte), k); this.uCeu.solCor.value.lerp(c.set(T.solCeu), k);
    this.cena.fog.color.lerp(c.set(T.neblina), k); this.cena.fog.density += (T.dens * this.neblinaMult - this.cena.fog.density) * k;
    this.sol.color.lerp(c.set(T.sol), k); this.sol.intensity += (T.solInt - this.sol.intensity) * k;
    this.dir.lerp(this._dirTarde ??= new THREE.Vector3(...T.dir).normalize(), k).normalize(); this.uCeu.solDir.value.copy(this.dir);
    this.hemi.color.lerp(c.set(T.hemiCeu), k); this.hemi.groundColor.lerp(c.set(T.hemiChao), k); this.hemi.intensity += (T.hemiInt - this.hemi.intensity) * k;
    this.renderizador.toneMappingExposure += (T.expo - this.renderizador.toneMappingExposure) * k; this.cena.environmentIntensity += (T.env - this.cena.environmentIntensity) * k;
    this.bloom += (T.bloom - this.bloom) * k; this.figuras += (T.figuras - this.figuras) * k;
    this.estrelas.material.opacity = Math.max(this.estrelas.material.opacity, 0.15 * k);
  }
  // Liga ou desliga o fim de tarde (só faz sentido de dia).
  definirTarde(sim) { this.tarde = sim ? 1 : 0; this._lerp(this.f); }

  _aplicarInterior() {
    const I = INTERIOR, dia = 1 - this.f;
    this.uCeu.topo.value.set(I.topo); this.uCeu.horizonte.value.set(I.horizonte); this.uCeu.solCor.value.set(0x000000);
    this.cena.fog.color.set(I.neblina); this.cena.fog.density = (I.dens / (this.escalaInterior ?? 1)) * this.neblinaMult;
    const lk = this.luzK;
    this.sol.color.set(I.sol); this.sol.intensity = I.solInt * (0.55 + 0.45 * dia) * (0.12 + 0.88 * lk);
    this.dir.set(...I.dir).normalize();
    this.hemi.color.set(I.hemiCeu); this.hemi.groundColor.set(I.hemiChao); this.hemi.intensity = I.hemiInt * (0.7 + 0.3 * dia) * (0.22 + 0.78 * lk);
    this.renderizador.toneMappingExposure = I.expo; this.cena.environmentIntensity = I.env;
    this.bloom = I.bloom; this.figuras = I.figuras * (0.35 + 0.65 * lk); this.estrelas.material.opacity = 0;
    this.corNevoa.set(0x5c6068);
  }

  definirNeblina(mult) { this.neblinaMult = mult; this._lerp(this.f); }

  // Noite do mapa: luar (1 = a de sempre; 0,2 = bem escura) e onde fica a lua no céu, { azimute, altura } em graus
  // (azimute a partir do norte, que é o alto da planta, no sentido horário). Sem "lua", ela fica de onde vem o luar padrão.
  definirLuar(luar = 1, lua = null) {
    this.luar = Math.max(0.02, Math.min(1.5, Number(luar) || 1));
    if (lua && Number.isFinite(lua.azimute) && Number.isFinite(lua.altura)) {
      const a = (lua.azimute * Math.PI) / 180, h = (Math.max(3, Math.min(85, lua.altura)) * Math.PI) / 180;
      this.dirLua = [Math.cos(h) * Math.sin(a), Math.sin(h), -Math.cos(h) * Math.cos(a)];
    } else this.dirLua = null;
    this._lerp(this.f);
  }

  // Entra/sai do modo interior (troca a iluminação e a escala da sombra).
  // aberto: mapa a céu aberto (navio, cidade, base): usa o céu e o sol da cidade, com dia e noite.
  // extensao: metade do tamanho do mapa, em metros do mundo, para a sombra do sol cobrir tudo.
  definirInterior(sim, escala = 1, { aberto = false, extensao = 0 } = {}) {
    this.interior = sim; this.aberto = sim && aberto; this.escalaInterior = escala;
    const sc = this.sol.shadow.camera, e = sim ? (this.aberto ? Math.min(260, Math.max(34 * escala, extensao)) : 34 * escala) : 300;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.updateProjectionMatrix();
    this.sol.shadow.normalBias = sim ? 0.04 * escala : 0.5;
    this.sol.shadow.bias = sim ? -0.0003 : -0.0005;
    this.extensaoSombra = e;
    this._lerp(this.f);
  }

  atualizar(dt, camera, alvo, nevoa = 0) {
    if (Math.abs(nevoa - this.nevoa) > 0.004) { this.nevoa = nevoa; this._lerp(this.f); }
    const alvoLuz = this.luzes ? 1 : 0;
    if (this.luzK !== alvoLuz) {
      this.luzK += Math.sign(alvoLuz - this.luzK) * Math.min(Math.abs(alvoLuz - this.luzK), dt / 0.3);
      this._lerp(this.f);
    }
    if (this.f !== this.alvoF) {
      const passo = dt / 2.2;
      this.f = this.alvoF > this.f ? Math.min(this.alvoF, this.f + passo) : Math.max(this.alvoF, this.f - passo);
      this._lerp(this.f);
    }
    this.ceu.position.copy(camera.position); this.estrelas.position.copy(camera.position);
    const dl = this.dirLua ?? NOITE.dir;
    this.lua.position.set(dl[0], dl[1], dl[2]).normalize().multiplyScalar(DIST_LUA).add(camera.position);
    // A sombra acompanha o ponto observado (com encaixe para não tremer).
    const g = ((this.extensaoSombra ?? 300) * 2) / 2048 * 8;
    const tx = Math.round(alvo.x / g) * g, tz = Math.round(alvo.z / g) * g;
    if (tx !== this._sx || tz !== this._sz || this._quadro % 3 === 0 || this.f !== this.alvoF) { this._sx = tx; this._sz = tz; this.sol.shadow.needsUpdate = true; }
    this.sol.target.position.set(tx, 0, tz);
    this.sol.position.set(tx + this.dir.x * 700, this.dir.y * 700, tz + this.dir.z * 700);

    if (this._quadro++ % 8 === 0) this._escolherLuzes(alvo, camera);
  }

  _escolherLuzes(alvo, camera) {
    const luzes = this.mundo.luzes;
    const fl = this.fLuzes ?? this.f;
    if (fl < 0.05) { for (const l of this.pontuais) l.intensity = 0; return; }
    // Ponto de referência entre a câmera e o alvo, para priorizar o que está em quadro.
    const rx = alvo.x * 0.7 + camera.position.x * 0.3, rz = alvo.z * 0.7 + camera.position.z * 0.3;
    for (const l of luzes) l._d = (l.x - rx) ** 2 + (l.z - rz) ** 2;
    const perto = [...luzes].sort((a, b) => a._d - b._d).slice(0, N_LUZES);
    this.pontuais.forEach((p, i) => {
      const l = perto[i];
      if (!l) { p.intensity = 0; return; }
      p.position.set(l.x, l.y, l.z); p.color.set(l.cor); p.intensity = 60 * l.forca * fl; p.distance = l.alcance ?? 48;
    });
  }
}
