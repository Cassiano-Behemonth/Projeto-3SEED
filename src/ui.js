// Interface do mestre: locais, ângulos de câmera, passagens (portas), dia/noite, névoa, rótulos e criaturas.
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function iniciarUI({ SO_MAPA = null, LOCAIS, MONSTROS, PERSONAGENS, INTERIORES, AMPLIACAO, HOTSPOTS_CIDADE, cameras, ambiente, monstros, camera, controles, nevoa, mundo, transicao, portas }) {
  // Sem a campanha (LOCAIS vazio) não há cidade: o programa abre direto nos mapas em arquivo.
  const temCidade = LOCAIS.length > 0;
  let atual = LOCAIS[0] ?? null, angulo = 0, rotulosVisiveis = true, dentro = null, paredesAltas = true, ocupado = false;

  // ───── Locais e ângulos ─────
  const nav = $('#locais');
  const botoesLocal = LOCAIS.map((l, i) => {
    const b = el('button', 'local');
    b.append(el('kbd', null, String(i + 1)), el('span', null, l.nome));
    b.addEventListener('click', () => (dentro ? viajar({ local: l.id, camera: 0 }, 'corte') : irPara(l.id, 0)));
    nav.append(b);
    return b;
  });

  // Mapas avulsos (em arquivo, sem ligação com um local da cidade): entram numa lista própria.
  const avulsos = INTERIORES.filter((x) => !x.local && (!SO_MAPA || x.id === SO_MAPA)); // só este mapa: os outros só pelas portas
  const botoesMapa = avulsos.map((it) => {
    const b = el('button', 'local mapa');
    b.append(el('kbd', null, '▸'), el('span', null, it.nome));
    b.addEventListener('click', () => viajar({ interior: it.id }, 'corte'));
    return b;
  });
  if (avulsos.length) nav.append(el('div', 'separador', 'Mapas'), ...botoesMapa);

  const boxAng = $('#angulos');
  const camerasAtuais = () => (dentro ? dentro.cameras : atual?.cameras ?? []);
  function desenharAngulos() {
    const chips = camerasAtuais().map((c, i) => {
      const b = el('button', 'chip' + (i === angulo ? ' ativo' : ''), c.nome);
      b.addEventListener('click', () => (dentro ? verInterior(i) : irPara(atual.id, i)));
      return b;
    });
    const lz = el('button', 'chip' + (ambiente.luzes ? '' : ' ativo'), ambiente.luzes ? 'Luzes: acesas' : 'Luzes: apagadas');
    lz.title = 'Liga ou desliga as luzes (P)';
    lz.addEventListener('click', alternarLuzes);
    chips.push(lz);
    const pe = el('button', 'chip', 'A pé');
    pe.title = 'Desce a câmera para a altura dos olhos (F)';
    pe.addEventListener('click', aPe);
    chips.push(pe);
    if (dentro) {
      const p = el('button', 'chip', paredesAltas ? 'Paredes: altas' : 'Paredes: baixas');
      p.title = 'Alterna a altura das paredes (T)';
      p.addEventListener('click', alternarParedes);
      chips.push(p);
      if (portas.temSalas()) {
        const ocultas = portas.temOcultas();
        const r = el('button', 'chip', ocultas ? 'Revelar tudo' : 'Ocultar salas');
        r.title = 'Atalho do mestre: mostra ou esconde todas as salas deste andar';
        r.addEventListener('click', () => portas.tudo(ocultas));
        chips.push(r);
      }
      for (const it of INTERIORES.filter((x) => dentro.local && x.local === dentro.local && x !== dentro)) {
        const e = el('button', 'chip porta', it.nome);
        e.addEventListener('click', () => viajar({ interior: it.id }, 'corte'));
        chips.push(e);
      }
      if (temCidade) {
        const s = el('button', 'chip porta', 'Sair');
        s.addEventListener('click', () => viajar({ local: dentro.local ? atual.id : 'cidade', camera: 0 }, 'corte'));
        chips.push(s);
      }
    } else if (atual) {
      for (const it of INTERIORES.filter((x) => x.local === atual.id)) {
        const e = el('button', 'chip porta', 'Entrar: ' + it.nome);
        e.addEventListener('click', () => viajar({ interior: it.id }, 'corte'));
        chips.push(e);
      }
    }
    boxAng.replaceChildren(...chips);
  }
  portas.aoMudar = desenharAngulos;

  function marcarLocal() {
    const avulso = dentro && !dentro.local;
    botoesLocal.forEach((b, i) => b.classList.toggle('ativo', !avulso && LOCAIS[i] === atual));
    botoesMapa.forEach((b, i) => b.classList.toggle('ativo', avulsos[i] === dentro));
    $('#subtitulo').textContent = avulso ? dentro.nome : dentro ? (atual ? atual.nome + ' · ' : '') + dentro.nome : atual?.nome ?? '';
  }
  function irPara(id, ang = 0, imediato = false) {
    if (!temCidade) return;
    const l = LOCAIS.find((x) => x.id === id) ?? LOCAIS[0];
    atual = l; angulo = ((ang % l.cameras.length) + l.cameras.length) % l.cameras.length;
    const c = l.cameras[angulo];
    if (imediato) cameras.irJa(c.pos, c.alvo); else cameras.voarPara(c.pos, c.alvo);
    marcarLocal(); desenharAngulos();
  }
  const noMundo = (it, v) => [v[0] * AMPLIACAO + it.origem[0], v[1] * AMPLIACAO + it.origem[1], v[2] * AMPLIACAO + it.origem[2]];
  function verInterior(i, imediato = false) {
    const cs = dentro.cameras;
    angulo = ((i % cs.length) + cs.length) % cs.length;
    const c = cs[angulo], pos = noMundo(dentro, c.pos), alvo = noMundo(dentro, c.alvo);
    if (imediato) cameras.irJa(pos, alvo); else cameras.voarPara(pos, alvo, 1.3);
    desenharAngulos();
  }

  // ───── Troca de mapa ─────
  // Cada interior é um mapa próprio: ao entrar, a cidade some; ao sair, o interior some.
  function definirMapa(id) {
    mundo.mapaAtual = id;
    const fora = id === 'cidade';
    for (const o of mundo.exterior) o.visible = fora;
    for (const [k, it] of Object.entries(mundo.interiores)) it.grupo.visible = k === id;
    monstros.definirMapa(id);
    const it = fora ? null : INTERIORES.find((x) => x.id === id);
    ambiente.definirInterior(!fora, AMPLIACAO, { aberto: !!it?.aberto, extensao: it ? Math.max(...it.limites) * AMPLIACAO : 0 });
    // Um mapa pode pedir a hora em que abre ("hora": "dia" ou "noite"); depois a tecla N troca como sempre.
    if (it?.hora === 'dia' || it?.hora === 'noite' || it?.hora === 'entardecer') { ambiente.definir(it.hora === 'noite'); queueMicrotask(() => sincronizar()); }
    ambiente.definirTarde(it?.hora === 'entardecer');
    ambiente.definirLuar(it?.luar ?? 1, it?.lua ?? null); // quanto clareia a noite e onde fica a lua (padrão: como sempre)
    nevoa.definirModo(fora ? 'exterior' : 'interior', fora ? 1 : AMPLIACAO);
    // Longe o bastante para a vista de planta caber, mesmo em mapas grandes (uma cidade inteira).
    controles.maxDistance = fora ? 1500 : Math.max(90, it ? Math.max(it.limites[0] * 1.7, it.limites[1] * 3.2) : 0) * AMPLIACAO;
    controles.enableRotate = fora; // nos interiores o giro é feito no lugar (ver main.js)
  }
  function aplicarDestino(d) {
    if (d.interior) {
      const it = INTERIORES.find((x) => x.id === d.interior);
      if (!it) { console.warn(`Passagem para um mapa que não existe: "${d.interior}"`); return; }
      atual = LOCAIS.find((l) => l.id === it.local) ?? atual;
      dentro = it;
      definirMapa(it.id);
      marcarLocal();
      // Sem câmera definida, chega-se a pé (altura dos olhos), no ponto de entrada daquele andar.
      const vista = d.vista ?? (d.camera == null ? it.chegada : null);
      if (vista) { angulo = -1; cameras.irJa(noMundo(it, vista.pos), noMundo(it, vista.alvo)); desenharAngulos(); }
      else verInterior(d.camera ?? 0, true);
    } else {
      if (!temCidade) { console.warn('Passagem para a cidade, mas não há cidade (campanha ausente).'); return; }
      dentro = null;
      definirMapa('cidade');
      irPara(d.local ?? atual.id, d.camera ?? 0, true);
    }
  }
  // anim: 'porta' / 'porta-dupla' / 'porta-madeira' (animação de abrir a porta), 'som' (corte com rangido), 'corte' (só escurece).
  const veu = $('#veu');
  async function viajar(destino, anim = 'corte') {
    if (ocupado) return;
    ocupado = true;
    document.body.classList.add('viajando');
    veu.classList.add('fechado');
    await espera(270);
    if (anim === 'porta' || anim === 'porta-dupla' || anim === 'porta-madeira') {
      const fim = transicao.tocar(anim);
      veu.classList.remove('fechado');
      await fim;
      veu.classList.add('fechado');
      await espera(270);
      transicao.ativa = false;
    } else if (anim === 'som') {
      portas.som.currentTime = 0; portas.som.play().catch(() => {});
      await espera(500);
    }
    aplicarDestino(destino);
    await espera(140);
    veu.classList.remove('fechado');
    document.body.classList.remove('viajando');
    ocupado = false;
  }
  // Desce a câmera para a altura dos olhos no ponto observado, olhando para a frente.
  // Daí em diante WASD anda, Q/E vira e o botão direito olha em volta.
  function aPe() {
    const k = dentro ? AMPLIACAO : 1, olho = 1.75 * k;
    const dir = new THREE.Vector3().subVectors(controles.target, camera.position).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const p = controles.target;
    cameras.voarPara([p.x - dir.x * 0.75 * k, olho, p.z - dir.z * 0.75 * k], [p.x + dir.x * 0.75 * k, olho * 0.96, p.z + dir.z * 0.75 * k], 1.1);
  }
  const somAcende = new Audio('assets/sons/luz_acende.mp3'), somApaga = new Audio('assets/sons/luz_apaga.mp3');
  function alternarLuzes() {
    const acesas = ambiente.alternarLuzes();
    const som = acesas ? somAcende : somApaga;
    somAcende.pause(); somApaga.pause(); // um som não fica por cima do outro
    som.currentTime = 0; som.play().catch(() => {});
    desenharAngulos();
  }
  function alternarParedes() {
    paredesAltas = !paredesAltas;
    for (const it of Object.values(mundo.interiores)) it.paredes.scale.y = paredesAltas ? it.paredes.userData.altura : 0.9;
    desenharAngulos();
  }

  // ───── Dia / noite, névoa, neblina, rótulos ─────
  const btnTempo = $('#btnTempo');
  const sincronizar = () => { btnTempo.textContent = ambiente.noite ? 'Noite' : 'Dia'; btnTempo.classList.toggle('ativo', ambiente.noite); };
  btnTempo.addEventListener('click', () => { ambiente.alternar(); sincronizar(); });
  $('#neblina').addEventListener('input', (e) => ambiente.definirNeblina(Number(e.target.value)));
  const deslNevoa = $('#nevoa');
  const mudarNevoa = (v) => { v = Math.min(1, Math.max(0, v)); deslNevoa.value = v; nevoa.definir(v); };
  deslNevoa.addEventListener('input', () => nevoa.definir(Number(deslNevoa.value)));
  const btnRot = $('#btnRotulos');
  btnRot.addEventListener('click', () => { rotulosVisiveis = !rotulosVisiveis; btnRot.classList.toggle('ativo', rotulosVisiveis); });

  // ───── Rótulos dos locais e passagens (portas) ─────
  const camada = $('#rotulos'), v = new THREE.Vector3();
  const rotulos = LOCAIS.filter((l) => l.rotulo).map((l) => {
    const d = el('button', 'rotulo', l.nome);
    d.addEventListener('click', () => irPara(l.id, 0));
    camada.append(d);
    return { l, d };
  });
  const passagens = [
    ...HOTSPOTS_CIDADE.map((h) => ({ ...h, mapa: 'cidade', alcance: 200 })),
    ...INTERIORES.flatMap((it) => (it.hotspots ?? []).map((h) => ({ ...h, mapa: it.id, pos: noMundo(it, h.pos), alcance: 200 }))),
  ].map((h) => {
    const d = el('button', 'passagem');
    d.append(el('i'), el('span', null, h.nome));
    d.addEventListener('click', () => viajar(h.destino, h.anim));
    camada.append(d);
    return { h, d };
  });
  function projetar(pos, d, visivelBase) {
    const dist = camera.position.distanceTo(v.set(...pos));
    v.project(camera);
    const visivel = visivelBase(dist) && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    d.style.display = visivel ? '' : 'none';
    if (visivel) d.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * window.innerWidth}px, ${((1 - v.y) / 2) * window.innerHeight}px)`;
  }
  function atualizarRotulos() {
    for (const { l, d } of rotulos) projetar(l.rotulo, d, (dist) => rotulosVisiveis && !dentro && camera.position.y > 35 && dist > 90);
    for (const { h, d } of passagens) projetar(h.pos, d, (dist) => rotulosVisiveis && !ocupado && h.mapa === mundo.mapaAtual && dist < h.alcance);
  }

  // ───── Criaturas ─────
  const painel = $('#painelMonstros'), btnM = $('#btnMonstros');
  btnM.addEventListener('click', () => { painel.classList.toggle('aberto'); btnM.classList.toggle('ativo', painel.classList.contains('aberto')); });
  const lista = $('#listaMonstros');
  for (const def of [...PERSONAGENS, ...MONSTROS]) {
    const b = el('button', 'monstro' + (def.vistas ? ' personagem' : ''), def.nome);
    b.addEventListener('click', () => invocar(def));
    lista.append(b);
  }
  function enquadrar(m) {
    const p = m.grupo.position;
    const dir = new THREE.Vector3().subVectors(camera.position, controles.target).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const d = m.altura * 3.4 + 5;
    cameras.voarPara([p.x + dir.x * d, p.y + m.altura * 0.75 + 1, p.z + dir.z * d], [p.x, p.y + m.altura * 0.55, p.z], 1.4);
  }
  function invocar(def) {
    // Procura chão livre entre o ponto observado e a câmera (para não nascer em cima de um telhado).
    const t = controles.target, c = camera.position;
    let x = t.x, z = t.z;
    for (let k = 0; k <= 0.85; k += 0.05) {
      const px = t.x + (c.x - t.x) * k, pz = t.z + (c.z - t.z) * k;
      if (monstros.alturaDoChao(px, pz) < 1.6) { x = px; z = pz; break; }
    }
    const n = monstros.lista.filter((m) => m.mapa === mundo.mapaAtual).length;
    const m = monstros.invocar(def, x + Math.cos(n * 2.4) * Math.min(n, 3) * 3.2, z + Math.sin(n * 2.4) * Math.min(n, 3) * 3.2);
    if (dentro) monstros.definirAltura(m, (def.real ?? 1.9) * AMPLIACAO); // proporção humana dentro dos interiores
    if (camera.position.distanceTo(m.grupo.position) > m.altura * 12) enquadrar(m);
  }
  // Câmera por cima do ombro da criatura selecionada, olhando na direção em que a câmera já apontava.
  function ombro(m) {
    const p = m.grupo.position, a = m.altura;
    const dir = new THREE.Vector3().subVectors(controles.target, camera.position).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const lado = new THREE.Vector3(-dir.z, 0, dir.x); // para a direita de quem olha
    cameras.voarPara(
      [p.x - dir.x * a * 0.48 + lado.x * a * 0.3, p.y + a * 0.95, p.z - dir.z * a * 0.48 + lado.z * a * 0.3],
      [p.x + dir.x * a * 3 + lado.x * a * 0.3, p.y + a * 0.62, p.z + dir.z * a * 3 + lado.z * a * 0.3], 1.2);
  }
  const sel = $('#selecionado'), altura = $('#alturaMonstro');
  function desenharSelecao() {
    const m = monstros.selecionado;
    sel.hidden = !m;
    $('#contagem').textContent = monstros.lista.length ? `${monstros.lista.length} em cena` : '';
    if (!m) return;
    $('#nomeSel').textContent = m.def.nome;
    $('#linhaPersonagem').hidden = !m.vistas;
    $('#linhaPose').hidden = !m.def.poses;
    if (m.def.poses) {
      const sp = $('#selPose');
      if (sp.dataset.de !== m.def.id) { sp.dataset.de = m.def.id; sp.replaceChildren(...m.def.poses.map(([v, r]) => { const o = el('option', null, r); o.value = v; return o; })); }
      sp.value = m.pose;
    }
    $('#btnLanterna').hidden = !m.luz;
    if (m.luz) $('#btnLanterna').textContent = m.acesa ? 'Lanterna: acesa' : 'Lanterna: apagada';
    altura.value = m.altura; $('#alturaTxt').textContent = `${m.altura.toFixed(1)} m`;
  }
  monstros.aoMudar = desenharSelecao;
  altura.addEventListener('input', () => { const m = monstros.selecionado; if (!m) return; monstros.definirAltura(m, Number(altura.value)); $('#alturaTxt').textContent = `${m.altura.toFixed(1)} m`; });
  $('#btnEnquadrar').addEventListener('click', () => monstros.selecionado && enquadrar(monstros.selecionado));
  $('#btnOmbro').addEventListener('click', () => monstros.selecionado && ombro(monstros.selecionado));
  $('#btnVirarE').addEventListener('click', () => monstros.girar(monstros.selecionado, 0.4));
  $('#btnVirarD').addEventListener('click', () => monstros.girar(monstros.selecionado, -0.4));
  $('#btnLanterna').addEventListener('click', () => monstros.alternarLanterna(monstros.selecionado));
  $('#selPose').addEventListener('change', (e) => { monstros.definirPose(monstros.selecionado, e.target.value); e.target.blur(); });
  // Lanterna pela tecla L: a do personagem selecionado ou, sem seleção, a de todos os personagens deste mapa.
  const lanternas = () => { const s = monstros.selecionado; const alvo = s?.luz ? [s] : monstros.lista.filter((m) => m.luz && m.mapa === mundo.mapaAtual); alvo.forEach((m) => monstros.alternarLanterna(m)); };
  $('#btnRemover').addEventListener('click', () => monstros.remover(monstros.selecionado));
  $('#btnLimpar').addEventListener('click', () => { [...monstros.lista].forEach((m) => monstros.remover(m)); });
  desenharSelecao();

  // ───── Atalhos de teclado ─────
  window.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea') || e.metaKey || e.ctrlKey || ocupado) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= String(LOCAIS.length)) { const l = LOCAIS[Number(k) - 1]; if (dentro) viajar({ local: l.id, camera: 0 }, 'corte'); else irPara(l.id, 0); }
    else if (k === 'c') { if (dentro) verInterior(angulo + 1); else if (atual) irPara(atual.id, angulo + 1); }
    else if (k === 'p') alternarLuzes();
    else if (k === 't' && dentro) alternarParedes();
    else if (k === 'f') aPe();
    else if (k === 'o' && monstros.selecionado) ombro(monstros.selecionado);
    else if (k === 'l') lanternas();
    else if (k === 'z') monstros.girar(monstros.selecionado, 0.35);
    else if (k === 'x') monstros.girar(monstros.selecionado, -0.35);
    else if (k === '[') mudarNevoa(nevoa.alvo - 0.1);
    else if (k === ']') mudarNevoa(nevoa.alvo + 0.1);
    else if (k === 'n') btnTempo.click();
    else if (k === 'r') btnRot.click();
    else if (k === 'm') btnM.click();
    else if (k === 'h') document.body.classList.toggle('sem-ui');
    else if ((k === 'delete' || k === 'backspace') && monstros.selecionado) monstros.remover(monstros.selecionado);
  });

  // Segunda tela: abre outra janela, sem interface, que acompanha esta.
  $('#btnTela')?.addEventListener('click', () => window.open(location.pathname + '?tela=1' + (SO_MAPA ? '&so=1&mapa=' + encodeURIComponent(SO_MAPA) : ''), 'tela-3seed', 'popup,width=1280,height=720'));

  return {
    irPara, temCidade, atualizarRotulos, sincronizar, verInterior, mudarNevoa, viajar, definirMapa,
    // Trava toda a entrada (usado pela segunda tela, que só espelha).
    bloquear: () => { ocupado = true; rotulosVisiveis = false; },
    veuFechado: () => veu.classList.contains('fechado'),
    // Entrada direta (sem animação), usada pelo endereço ?interior=...
    entrar: (id, i) => { const it = INTERIORES.find((x) => x.id === id); if (it) aplicarDestino({ interior: id, camera: i }); },
    interiorAtual: () => dentro,
  };
}
