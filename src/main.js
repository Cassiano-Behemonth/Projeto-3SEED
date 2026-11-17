import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { definirAnisotropia } from './util/texturas.js';
import { criarMundo } from './mundo/mundo.js';
import { Ambiente } from './sistemas/ambiente.js';
import { Cameras } from './sistemas/cameras.js';
import { Monstros } from './sistemas/monstros.js';
import { Nevoa } from './sistemas/nevoa.js';
import { INTERIORES, AMPLIACAO, carregarMapasEmArquivo } from './mundo/interiores/index.js';
import { Transicao } from './sistemas/transicao.js';
import { Portas } from './sistemas/portas.js';
import { Fisica } from './sistemas/fisica.js';
import { iniciarUI } from './ui.js';
import { alturaDoPiso } from './mundo/interiores/formato.js';

// ?tela=1 abre a "segunda tela": só a cena, sem interface nem controles, espelhando a janela do mestre.
const TELA = new URLSearchParams(location.search).get('tela') === '1';
if (TELA) {
  document.body.classList.add('sem-ui', 'tela');
  // Os sons tocam só na janela do mestre (senão sairiam duplicados).
  window.Audio = class extends Audio { play() { return Promise.resolve(); } };
}
const canal = 'BroadcastChannel' in window ? new BroadcastChannel('marca-do-pecado-mapa-3d') : null;

const canvas = document.getElementById('cena');
const renderizador = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// Resolução de desenho: começa em até 1,25x e se ajusta sozinha para manter a fluidez (ver "qualidade" abaixo).
const PR_MAX = Math.min(window.devicePixelRatio, 1.25);
let PR = PR_MAX;
renderizador.setPixelRatio(PR);
renderizador.setSize(window.innerWidth, window.innerHeight);
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
renderizador.toneMapping = THREE.ACESFilmicToneMapping;
definirAnisotropia(Math.min(8, renderizador.capabilities.getMaxAnisotropy()));

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 7000);

const carregando = document.getElementById('carregando');
THREE.DefaultLoadingManager.onProgress = (_u, feitos, total) => { carregando.querySelector('span').textContent = `Carregando texturas ${feitos}/${total}`; };
THREE.DefaultLoadingManager.onLoad = () => carregando.classList.add('some');

// A campanha (cidade, locais, criaturas) é opcional: sem src/campanha.js, o programa é só a semente e abre nos mapas.
// ?mapa=id&so=1 (é como a página inicial abre um mapa): só esse mapa, sem a campanha nem os outros mapas.
const SO_MAPA = new URLSearchParams(location.search).get('so') === '1' ? new URLSearchParams(location.search).get('mapa') : null;
const campanha = SO_MAPA ? null : await import('./campanha.js').catch((e) => { if (!/Failed to fetch|Importing a module script failed|404/.test(String(e))) console.warn('Campanha não carregada:', e); return null; });
const LOCAIS = campanha?.LOCAIS ?? [], MONSTROS = campanha?.MONSTROS ?? [], PERSONAGENS = campanha?.PERSONAGENS ?? [], HOTSPOTS_CIDADE = campanha?.HOTSPOTS_CIDADE ?? [];
if (campanha?.INTERIORES) INTERIORES.push(...campanha.INTERIORES);
if (campanha?.NOME) { document.title = campanha.NOME + ' — Mapa 3D'; const t = document.getElementById('titulo'); if (t) t.textContent = campanha.NOME; }
await carregarMapasEmArquivo(SO_MAPA); // os mapas em arquivo entram no registro antes de o mundo ser montado
const mundo = criarMundo(cena, campanha);

// Os monstros registram o clique antes dos controles, para o arrasto ter prioridade sobre a câmera.
const monstros = new Monstros(cena, camera, canvas, null, mundo);
const controles = new MapControls(camera, canvas);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.screenSpacePanning = false;
controles.maxPolarAngle = Math.PI / 2 - 0.02;
controles.minDistance = 0.5; // deixa a câmera chegar bem perto e entrar nos cômodos
controles.maxDistance = 1500;
controles.zoomToCursor = true;
monstros.controles = controles;

const ambiente = new Ambiente(cena, renderizador, mundo);
const cameras = new Cameras(camera, controles);
const nevoa = new Nevoa(cena);
const transicao = new Transicao();
const portas = new Portas(camera, canvas, mundo);
const fisica = new Fisica(mundo, AMPLIACAO);
monstros.restricao = (m, x, z) => fisica.criatura(m, x, z);
const camAnterior = new THREE.Vector3();

// Pós-processamento: brilho nas luzes, vinheta e grão leves.
// Em tela de alta densidade a própria resolução já suaviza as bordas: 2 amostras bastam (4 custam o dobro).
const alvoRT = new THREE.WebGLRenderTarget(window.innerWidth * PR, window.innerHeight * PR, { type: THREE.HalfFloatType, samples: window.devicePixelRatio > 1.2 ? 2 : 4 });
const compositor = new EffectComposer(renderizador, alvoRT);
compositor.addPass(new RenderPass(cena, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.75, 0.9);
compositor.addPass(bloom);
const acabamento = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tempo: { value: 0 }, vinheta: { value: 1 }, grao: { value: 0.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float tempo, vinheta, grao; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + tempo) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= 1.0 - vinheta * 0.55 * smoothstep(0.32, 0.9, length(vUv - 0.5));
      float r = h(vUv * vec2(1731.0, 977.0)) - 0.5;
      c.rgb = c.rgb * (1.0 + r * grao * 2.0) + r * grao * 0.015;
      gl_FragColor = c; }`,
});
compositor.addPass(acabamento);
compositor.addPass(new OutputPass());

const ui = iniciarUI({ SO_MAPA, LOCAIS, MONSTROS, PERSONAGENS, INTERIORES, AMPLIACAO, HOTSPOTS_CIDADE, cameras, ambiente, monstros, camera, controles, nevoa, mundo, transicao, portas });

const relogio = new THREE.Clock();

// ───── Segunda tela ─────
// A janela do mestre publica um retrato do estado a cada quadro; a tela aplica o retrato e não aceita entrada.
const veuEl = document.getElementById('veu');
function retrato() {
  const ints = {};
  for (const [id, x] of Object.entries(mundo.interiores)) {
    ints[id] = { p: x.portas.map((p) => (p.aberta ? 1 : 0)).join(''), s: Object.values(x.salas).map((sl) => (sl.revelada ? 1 : 0)).join(''), h: x.paredes.scale.y };
  }
  return {
    mapa: mundo.mapaAtual, cam: [...camera.position.toArray(), ...controles.target.toArray()], fov: camera.fov,
    noite: ambiente.noite, tarde: ambiente.tarde > 0.5, luzes: ambiente.luzes, nevoa: nevoa.alvo, neblina: ambiente.neblinaMult,
    ints, veu: ui.veuFechado(), trans: transicao.ativa ? { e: transicao.estilo, t: transicao.t } : null,
    cri: monstros.lista.map((m) => ({ u: m.uid, d: m.def.id, x: m.grupo.position.x, y: m.grupo.position.y, z: m.grupo.position.z, a: m.altura, r: m.rumo ?? 0, p: m.pose ?? '', l: m.acesa ?? false, m: m.mapa })),
  };
}
const DEFS = Object.fromEntries([...MONSTROS, ...PERSONAGENS].map((d) => [d.id, d]));
let recebeu = false, telaViva = 0;
function aplicarRetrato(e) {
  if (e.mapa !== mundo.mapaAtual) ui.definirMapa(e.mapa);
  camera.position.fromArray(e.cam, 0); controles.target.fromArray(e.cam, 3); camera.lookAt(controles.target); camera.fov = e.fov;
  if (ambiente.noite !== e.noite) ambiente.definir(e.noite, !recebeu);
  // O fim de tarde também vem do mestre: a tecla N o desliga lá, e sem isto a segunda tela ficava com o pôr do sol
  // por cima da noite (nos mapas que abrem em "entardecer").
  if (e.tarde !== undefined && (ambiente.tarde > 0.5) !== e.tarde) ambiente.definirTarde(e.tarde);
  ambiente.luzes = e.luzes;
  if (nevoa.alvo !== e.nevoa) nevoa.definir(e.nevoa);
  if (ambiente.neblinaMult !== e.neblina) ambiente.definirNeblina(e.neblina);
  for (const [id, r] of Object.entries(e.ints)) {
    const x = mundo.interiores[id];
    if (!x) continue;
    x.portas.forEach((p, i) => { p.aberta = r.p[i] === '1'; });
    Object.values(x.salas).forEach((sl, i) => { const v = r.s[i] === '1'; if (sl.revelada !== v) { sl.revelada = v; for (const m of sl.malhas) m.visible = true; } });
    x.paredes.scale.y = r.h;
  }
  veuEl.classList.toggle('fechado', e.veu);
  if (e.trans) {
    if (!transicao.ativa || transicao.estilo !== e.trans.e) { transicao._montar(e.trans.e); transicao.estilo = e.trans.e; transicao.ativa = true; }
    transicao.t = e.trans.t;
  } else transicao.ativa = false;
  monstros.espelhar(e.cri, DEFS);
  if (!recebeu) { recebeu = true; document.getElementById('espera')?.remove(); }
}
if (TELA) {
  ui.bloquear(); monstros.bloqueado = true; portas.bloqueado = true; controles.enabled = false;
  const aviso = document.createElement('div');
  aviso.id = 'espera'; aviso.textContent = 'Aguardando a janela do mestre…';
  document.body.append(aviso);
  if (canal) {
    canal.onmessage = (ev) => { if (ev.data?.cam) aplicarRetrato(ev.data); };
    // Avisa a janela do mestre de que há uma tela aberta (ela só publica enquanto ouvir este aviso).
    const ola = () => canal.postMessage({ ola: 1 });
    ola(); setInterval(ola, 1000);
  }
} else if (canal) {
  canal.onmessage = (ev) => { if (ev.data?.ola) telaViva = relogio.elapsedTime + 3; };
}

// Estado inicial (pode vir da URL: ?local=igreja&ang=1&dia=1&ui=0).
const params = new URLSearchParams(location.search);
ambiente.definir(params.get('dia') !== '1', true);
ui.sincronizar();
if (!ui.temCidade) document.getElementById('ajuda-locais')?.remove();
if (ui.temCidade) ui.irPara(params.get('local') ?? 'cidade', Number(params.get('ang') ?? 0), true);
// ?mapa=id abre direto num interior; sem a cidade, o programa abre no primeiro mapa da lista
const mapaInicial = params.get('mapa') ?? params.get('interior') ?? (ui.temCidade ? null : (INTERIORES.find((x) => !x.local) ?? INTERIORES[0])?.id);
if (mapaInicial) ui.entrar(mapaInicial, params.get('ang') ? Number(params.get('ang')) : undefined);
if (params.get('nevoa')) ui.mudarNevoa(Number(params.get('nevoa')));
if (params.get('ui') === '0') document.body.classList.add('sem-ui');
// Modo de foto (?foto=1), usado por ferramentas/foto.py: sem interface nem tela de carregamento, e com a câmera
// onde se pedir. de=x,y e para=x,y são pixels da planta; altura é em metros acima do piso naquele ponto.
if (params.get('foto') === '1') {
  // &hud=1 mantém a interface do mestre na foto (para documentação); sem ele, a foto sai como a tela dos jogadores.
  const comHud = params.get('hud') === '1';
  if (!comHud) document.body.classList.add('sem-ui');
  carregando.style.display = 'none';
  for (const sel of comHud ? ['#veu'] : ['#veu', '#rotulos']) { const e = document.querySelector(sel); if (e) e.style.display = 'none'; }
  const it = ui.interiorAtual(), d = it?.dados;
  // --dia / --noite pedidos na foto vencem a hora do mapa (sem isso, o "entardecer" continuava por cima, como a tecla N faz)
  if (params.get('dia') || params.get('noite')) ambiente.definirTarde(false);
  ambiente.definir(params.get('dia') || params.get('noite') ? params.get('noite') === '1' : ambiente.noite, true); // sem esperar a transição
  if (params.get('revelar') === '1') portas.tudo(true);
  const par = (k) => (params.get(k) ?? '').split(',').map(Number);
  const de = par('de'), para = par('para');
  if (d && de.length === 2 && para.length === 2 && ![...de, ...para].some(Number.isNaN)) {
    const X = (px) => (px - d.larguraPx / 2) * d.escala, Z = (py) => (py - d.alturaPx / 2) * d.escala, k = AMPLIACAO, [ox, oy, oz] = it.origem;
    const h = Number(params.get('altura') ?? 1.75);
    cameras.irJa([ox + X(de[0]) * k, oy + (alturaDoPiso(d, de[0], de[1]) + h) * k, oz + Z(de[1]) * k], [ox + X(para[0]) * k, oy + (alturaDoPiso(d, para[0], para[1]) + 1.2) * k, oz + Z(para[1]) * k]);
  }
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderizador.setSize(w, h);
  compositor.setSize(w * PR, h * PR);
  qualidade.teto = PR_MAX; // janela mudou de tamanho: pode tentar de novo a resolução cheia
});

// Câmera pelo teclado: WASD ou setas movem, Q/E giram, Shift acelera.
const teclas = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, textarea, select') || e.metaKey || e.ctrlKey) return;
  // Espaço sobe a câmera: não pode rolar a página nem "clicar" no botão que estiver com o foco.
  if (e.code === 'Space') { e.preventDefault(); document.activeElement?.blur?.(); }
  teclas.add(e.code);
});
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());
const _frente = new THREE.Vector3(), _lado = new THREE.Vector3(), _desl = new THREE.Vector3(), _eixoY = new THREE.Vector3(0, 1, 0);
// O movimento tem inércia: acelera e freia aos poucos em vez de andar aos trancos.
const mov = { f: 0, l: 0, g: 0, s: 0 };
function moverPeloTeclado(dt) {
  const t = (...cs) => (cs.some((c) => teclas.has(c)) ? 1 : 0);
  const dentro = !!ui.interiorAtual(), corre = teclas.has('ShiftLeft') || teclas.has('ShiftRight') ? 1.9 : 1;
  const dist = camera.position.distanceTo(controles.target);
  const vmax = Math.min(420, Math.max(dentro ? 3.8 * AMPLIACAO : 6, dist * 0.9)) * corre;
  const suave = Math.min(1, dt * 9);
  mov.f += ((t('KeyW', 'ArrowUp') - t('KeyS', 'ArrowDown')) * vmax - mov.f) * suave;
  mov.l += ((t('KeyD', 'ArrowRight') - t('KeyA', 'ArrowLeft')) * vmax - mov.l) * suave;
  mov.g += ((t('KeyE') - t('KeyQ')) * 2.3 - mov.g) * Math.min(1, dt * 11);
  // Espaço sobe a câmera; Shift + Espaço desce. O ponto observado acompanha, então a vista não muda de inclinação.
  const desce = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
  mov.s += (t('Space') * (desce ? -1 : 1) * vmax * 0.7 - mov.s) * suave;
  if (cameras.voo) { mov.f = mov.l = mov.g = mov.s = 0; return; }
  if (Math.abs(mov.s) > 0.002) {
    const dy = Math.max(1.2 - camera.position.y, Math.min(mov.s * dt, (dentro ? 60 * AMPLIACAO : 900) - camera.position.y));
    camera.position.y += dy; controles.target.y = Math.max(0, controles.target.y + dy);
  }
  if (Math.abs(mov.f) + Math.abs(mov.l) + Math.abs(mov.g) < 0.002) return;
  _frente.subVectors(controles.target, camera.position).setY(0);
  if (_frente.lengthSq() < 1e-6) camera.getWorldDirection(_frente).setY(0);
  _frente.normalize();
  _lado.crossVectors(_frente, _eixoY);
  _desl.copy(_frente).multiplyScalar(mov.f * dt).addScaledVector(_lado, mov.l * dt);
  camera.position.add(_desl); controles.target.add(_desl);
  if (Math.abs(mov.g) > 0.002) {
    if (dentro) {
      // Dentro de um interior a câmera gira no próprio lugar (olha em volta), sem sair da sala.
      _desl.subVectors(controles.target, camera.position).applyAxisAngle(_eixoY, -mov.g * dt);
      controles.target.copy(camera.position).add(_desl);
    } else {
      _desl.subVectors(camera.position, controles.target).applyAxisAngle(_eixoY, -mov.g * dt);
      camera.position.copy(controles.target).add(_desl);
    }
  }
}

// Dentro dos interiores, arrastar com o botão direito também olha em volta a partir de onde a câmera está
// (na cidade continua orbitando em torno do ponto observado).
let olhando = null;
const _esf = new THREE.Spherical();
canvas.addEventListener('pointerdown', (e) => {
  if (TELA || e.button !== 2 || !ui.interiorAtual() || cameras.voo) return;
  olhando = [e.clientX, e.clientY];
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!olhando) return;
  const dx = e.clientX - olhando[0], dy = e.clientY - olhando[1];
  olhando = [e.clientX, e.clientY];
  _esf.setFromVector3(_desl.subVectors(controles.target, camera.position));
  _esf.theta += dx * 0.0058; // mesmo sentido do giro na cidade: arrastar para a direita vira a vista para a esquerda
  // Do horizonte até quase reto para baixo (não há teto para olhar).
  _esf.phi = Math.min(Math.PI - 0.12, Math.max(Math.PI / 2 + 0.03, _esf.phi + dy * 0.0058));
  controles.target.copy(camera.position).add(_desl.setFromSpherical(_esf));
});
const soltarOlhar = () => { olhando = null; };
canvas.addEventListener('pointerup', soltarOlhar);
canvas.addEventListener('pointercancel', soltarOlhar);

// ───── Qualidade adaptativa ─────
// Mede a fluidez e baixa a resolução de desenho quando cai abaixo de ~48 quadros por segundo;
// sobe de volta, devagar, quando há folga. Duas janelas abertas dividem a placa de vídeo, então cada uma se ajusta.
const qualidade = { pr: PR, teto: PR_MAX, quadros: 0, tempo: 0, folga: 0, fps: 60 };
function aplicarResolucao(pr) {
  PR = qualidade.pr = pr;
  renderizador.setPixelRatio(pr);
  renderizador.setSize(window.innerWidth, window.innerHeight);
  compositor.setSize(window.innerWidth * pr, window.innerHeight * pr);
}
function regularQualidade(dtReal) {
  if (document.visibilityState !== 'visible' || dtReal > 0.25) { qualidade.quadros = 0; qualidade.tempo = 0; return; } // janela parada não conta
  qualidade.quadros++; qualidade.tempo += dtReal;
  if (qualidade.tempo < 1) return;
  const fps = qualidade.fps = qualidade.quadros / qualidade.tempo;
  qualidade.quadros = 0; qualidade.tempo = 0;
  if (fps < 48 && qualidade.pr > 0.6) {
    qualidade.teto = Math.max(0.6, qualidade.pr - 0.05); // não volta a tentar a resolução que travou
    // O custo cresce com o quadrado da resolução: já salta para perto do valor que deve dar ~55 quadros por segundo.
    aplicarResolucao(Math.max(0.6, qualidade.pr * Math.min(0.92, Math.max(0.55, Math.sqrt(fps / 55)))));
    qualidade.folga = 0;
  } else if (fps > 57 && qualidade.pr < qualidade.teto - 0.01) {
    if (++qualidade.folga >= 5) { aplicarResolucao(Math.min(qualidade.teto, qualidade.pr + 0.08)); qualidade.folga = 0; }
  } else qualidade.folga = 0;
}

function quadro() {
  const dtReal = relogio.getDelta(), dt = Math.min(dtReal, 0.1), t = relogio.elapsedTime;
  regularQualidade(dtReal);
  // Durante a animação de porta, só ela aparece na tela.
  if (canal && !TELA && t < telaViva) canal.postMessage(retrato()); // só publica se houver uma segunda tela ouvindo
  if (transicao.ativa) {
    transicao.atualizar(TELA ? 0 : dt, window.innerWidth / window.innerHeight);
    renderizador.setRenderTarget(null);
    renderizador.render(transicao.cena, transicao.camera);
    requestAnimationFrame(quadro);
    return;
  }
  if (!TELA) {
    cameras.atualizar(dt);
    moverPeloTeclado(dt);
    if (!cameras.voo) controles.update();
  }
  if (camera.position.y < 1.2) camera.position.y = 1.2;
  // Dentro de um interior a câmera fica presa àquele mapa.
  const it = TELA ? null : ui.interiorAtual();
  if (it) {
    const a = controles.target, [ox, , oz] = it.origem, lx = it.limites[0] * AMPLIACAO, lz = it.limites[1] * AMPLIACAO;
    const cx = Math.min(ox + lx, Math.max(ox - lx, a.x)), cz = Math.min(oz + lz, Math.max(oz - lz, a.z));
    if (cx !== a.x || cz !== a.z) { camera.position.x += cx - a.x; camera.position.z += cz - a.z; a.x = cx; a.z = cz; }
  }
  // Colisão da câmera com paredes e portas fechadas (quando ela está abaixo do topo das paredes).
  if (it && !cameras.voo) {
    const r = fisica.camera(camAnterior, camera.position);
    if (r) {
      const dx = r.x - camera.position.x, dz = r.z - camera.position.z;
      camera.position.x = r.x; camera.position.z = r.z; controles.target.x += dx; controles.target.z += dz;
      if (r.dy) { camera.position.y += r.dy; controles.target.y += r.dy; } // acompanha o chão (morro) nos mapas a céu aberto
    }
  }
  camAnterior.copy(camera.position);
  // O teto do interior atual aparece só quando a câmera está abaixo dele.
  for (const [id, x] of Object.entries(mundo.interiores)) if (x.teto) x.teto.visible = id === mundo.mapaAtual && camera.position.y < x.paredes.scale.y * AMPLIACAO - 0.15;
  portas.atualizar(dt);
  const dist = camera.position.distanceTo(controles.target);
  camera.near = Math.min(12, Math.max(0.12, dist * 0.02));
  // A pé (câmera baixa e colada no ponto observado) o campo de visão abre, para a sala caber na tela.
  const aPe = it && dist < 2.2 * AMPLIACAO && camera.position.y < 2.4 * AMPLIACAO;
  if (!TELA) camera.fov += ((aPe ? 62 : 42) - camera.fov) * Math.min(1, dt * 5); // na segunda tela vem do mestre
  camera.updateProjectionMatrix();
  nevoa.atualizar(dt, t, controles.target, ambiente.corNevoa);
  ambiente.atualizar(dt, camera, controles.target, nevoa.atual);
  bloom.strength = ambiente.bloom;
  for (const fn of mundo.animacoes) fn(t, ambiente.f);
  // Num mapa que balança (navio), as criaturas sobem e descem com o convés.
  if (mundo.interiores[mundo.mapaAtual]?.balanco) for (const m of monstros.lista) if (m.mapa === mundo.mapaAtual) m.grupo.position.y = monstros.alturaDoChao(m.grupo.position.x, m.grupo.position.z, m.grupo.position.y);
  monstros.atualizar(ambiente.figuras, t);
  ui.atualizarRotulos();
  acabamento.uniforms.tempo.value = t % 100;
  compositor.render(dt);
  requestAnimationFrame(quadro);
}
quadro();

// Acesso pelo console para depuração.
window.mapa = { THREE, cena, camera, controles, ambiente, cameras, monstros, mundo, renderizador, ui, LOCAIS, nevoa, transicao, portas, fisica, qualidade, aplicarResolucao, publicar: () => canal?.postMessage(retrato()) };
