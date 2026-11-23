// Interface do mestre: locais, ângulos de câmera, passagens (portas), dia/noite, névoa, rótulos e criaturas.
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function iniciarUI({ SO_MAPA = null, LOCAIS, MONSTROS, PERSONAGENS, INTERIORES, AMPLIACAO, HOTSPOTS_CIDADE, cameras, ambiente, monstros, camera, controles, nevoa, mundo, transicao, portas, fisica = null, desafios = null }) {
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
      if (temDesafios()) {
        const b = el('button', 'chip' + (painelD.classList.contains('aberto') ? ' ativo' : ''), 'Desafios');
        b.title = 'O que os jogadores montam ou acendem neste mapa (cabanas, fogueira)';
        b.addEventListener('click', alternarDesafios);
        chips.push(b);
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
  // Mapa dos jogadores: o ângulo "Planta" (o primeiro) de um mapa com "imagemPlanta" mostra essa imagem, desenhada para eles.
  const mapaEl = $('#mapaJogadores');
  function mostrarPlanta(sim) {
    const url = dentro?.dados?.imagemPlanta;
    if (sim && url && mapaEl.querySelector('img').getAttribute('src') !== url) mapaEl.querySelector('img').src = url;
    mapaEl.classList.toggle('visivel', !!sim && !!url);
  }
  function verInterior(i, imediato = false) {
    const cs = dentro.cameras;
    angulo = ((i % cs.length) + cs.length) % cs.length;
    mostrarPlanta(angulo === 0);
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
      filtrarCriaturas();
      if (painelD.classList.contains('aberto')) desenharDesafios();
      // Sem câmera definida, chega-se a pé (altura dos olhos), no ponto de entrada daquele andar.
      const vista = d.vista ?? (d.camera == null ? it.chegada : null);
      if (vista) { angulo = -1; cameras.irJa(noMundo(it, vista.pos), noMundo(it, vista.alvo)); desenharAngulos(); }
      else verInterior(d.camera ?? 0, true);
    } else {
      if (!temCidade) { console.warn('Passagem para a cidade, mas não há cidade (campanha ausente).'); return; }
      dentro = null;
      definirMapa('cidade');
      filtrarCriaturas();
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
    const k = dentro ? AMPLIACAO : 1;
    const dir = new THREE.Vector3().subVectors(controles.target, camera.position).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const p = controles.target;
    // Os olhos ficam 1,75 m acima do chão que está embaixo do ponto observado: num morro ou num convés o chão não
    // está no zero (contando do zero, a câmera ia parar dentro do morro).
    const it = dentro ? mundo.interiores[dentro.id] : null;
    const chao = it?.aberto && fisica ? fisica._altura(it, p.x, p.z, p.y) : 0, olho = 1.75 * k;
    cameras.voarPara([p.x - dir.x * 0.75 * k, chao + olho, p.z - dir.z * 0.75 * k], [p.x + dir.x * 0.75 * k, chao + olho * 0.96, p.z + dir.z * 0.75 * k], 1.1);
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
  const deslClima = $('#clima');
  let arrastandoClima = false;
  deslClima.addEventListener('pointerdown', () => { arrastandoClima = true; });
  window.addEventListener('pointerup', () => { arrastandoClima = false; });
  const sincronizar = () => {
    btnTempo.textContent = ambiente.noite ? 'Noite' : 'Dia'; btnTempo.classList.toggle('ativo', ambiente.noite);
    if (!arrastandoClima) deslClima.value = ambiente.clima;
  };
  deslClima.addEventListener('input', () => { let v = Number(deslClima.value); if (Math.abs(v - 0.5) < 0.03) v = 0.5; ambiente.definirClima(v); }); // ímã no fim de tarde
  setInterval(sincronizar, 300); // acompanha a transição da tecla N
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
    const verD = painelD.classList.contains('aberto') && temDesafios();
    for (const { d, e } of rotulosD) projetar(noMundo(dentro, [d.pos[0], d.pos[1] + 3.4, d.pos[2]]), e, () => verD && !ocupado);
  }

  // ───── Criaturas ─────
  const painel = $('#painelMonstros'), btnM = $('#btnMonstros');
  btnM.addEventListener('click', () => {
    painel.classList.toggle('aberto'); btnM.classList.toggle('ativo', painel.classList.contains('aberto'));
    if (painel.classList.contains('aberto')) avisarPainel('monstros');
  });
  const lista = $('#listaMonstros');
  const botoesCriatura = [];
  // Criaturas com "grupo" ficam numa seção própria, fechada, no fim da lista (uma por grupo): assim não se põe uma sem
  // querer, e a lista principal fica curta.
  const grupos = new Map();
  for (const def of [...PERSONAGENS, ...MONSTROS]) {
    const b = el('button', 'monstro' + (def.vistas ? ' personagem' : ''), def.nome);
    // O botão não põe a criatura: ele a escolhe, e o clique seguinte no mapa diz onde ela nasce (Shift mantém escolhida; Esc cancela).
    b.addEventListener('click', () => { if (monstros.armado?.def === def) monstros.desarmar(); else monstros.armar(def, invocar); });
    if (def.grupo) {
      if (!grupos.has(def.grupo)) { const g = el('details', 'grupoCriaturas'); g.append(el('summary', '', `${def.grupo} (abrir para escolher)`)); grupos.set(def.grupo, g); }
      grupos.get(def.grupo).append(b);
    } else lista.append(b);
    botoesCriatura.push([def, b]);
  }
  for (const g of grupos.values()) lista.append(g);
  if (!botoesCriatura.length) lista.append(el('p', 'vazio', 'Nenhuma criatura ainda. Elas entram por src/campanha.js: veja "Como acrescentar cada coisa" no README.'));
  // Um mapa pode dizer quais criaturas aparecem no painel enquanto ele está aberto ("criaturas": [ids]); sem isso, todas.
  function filtrarCriaturas() {
    const ids = dentro?.dados?.criaturas;
    for (const [def, b] of botoesCriatura) b.hidden = Array.isArray(ids) && !ids.includes(def.id);
    for (const g of grupos.values()) g.hidden = [...g.querySelectorAll('button')].every((b) => b.hidden);
  }
  function enquadrar(m) {
    const p = m.grupo.position;
    const dir = new THREE.Vector3().subVectors(camera.position, controles.target).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const d = m.altura * 3.4 + 5;
    cameras.voarPara([p.x + dir.x * d, p.y + m.altura * 0.75 + 1, p.z + dir.z * d], [p.x, p.y + m.altura * 0.55, p.z], 1.4);
  }
  function invocar(def, ponto = null) {
    // Onde o mestre clicou: nasce ali, na altura do chão que ele viu (piso de uma cabine, telhado, degrau).
    if (ponto) {
      const m = monstros.invocar(def, ponto.x, ponto.z, ponto.y);
      if (dentro) monstros.definirAltura(m, (def.real ?? 1.9) * AMPLIACAO); // proporção humana dentro dos interiores
      return;
    }
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
    for (const [def, b] of botoesCriatura) b.classList.toggle('ativo', monstros.armado?.def === def);
    $('#dicaColocar').hidden = !monstros.armado;
    // Com um grupo marcado (Ctrl) e ninguém escolhido, o painel mostra o primeiro do grupo: é dele que saem os botões do grupo (lanternas).
    const m = monstros.selecionado ?? [...monstros.grupoSel][0] ?? null;
    sel.hidden = !m;
    $('#contagem').textContent = monstros.lista.length ? `${monstros.lista.length} em cena` : '';
    if (!m) return;
    $('#nomeSel').textContent = monstros.grupoSel.size > 1 ? `Grupo (${monstros.grupoSel.size})` : m.def.nome;
    $('#linhaPersonagem').hidden = !(m.vistas || m.volume);
    $('#linhaPose').hidden = !m.def.poses;
    if (m.def.poses) {
      const sp = $('#selPose');
      if (sp.dataset.de !== m.def.id) { sp.dataset.de = m.def.id; sp.replaceChildren(...m.def.poses.map(([v, r]) => { const o = el('option', null, r); o.value = v; return o; })); }
      sp.value = m.pose;
    }
    $('#btnEmbarcar').hidden = !m.def.leva;
    if (m.def.leva) $('#btnEmbarcar').textContent = m.ocupado ? 'Desembarcar' : 'Embarcar';
    const gl = monstros.lanternasDoGrupo();
    $('#btnLanterna').hidden = !m.luz && !gl.length;
    if (gl.length > 1) { const n = gl.filter((x) => x.acesa).length; $('#btnLanterna').textContent = n === gl.length ? 'Lanternas do grupo: acesas' : n === 0 ? 'Lanternas do grupo: apagadas' : `Lanternas do grupo: ${n} acesas`; }
    else if (m.luz) $('#btnLanterna').textContent = m.acesa ? 'Lanterna: acesa' : 'Lanterna: apagada';
    altura.value = m.altura; $('#alturaTxt').textContent = `${m.altura.toFixed(1)} m`;
  }
  monstros.aoMudar = desenharSelecao;
  altura.addEventListener('input', () => { const m = monstros.selecionado; if (!m) return; monstros.definirAltura(m, Number(altura.value)); $('#alturaTxt').textContent = `${m.altura.toFixed(1)} m`; });
  $('#btnEnquadrar').addEventListener('click', () => monstros.selecionado && enquadrar(monstros.selecionado));
  $('#btnOmbro').addEventListener('click', () => monstros.selecionado && ombro(monstros.selecionado));
  $('#btnVirarE').addEventListener('click', () => monstros.girar(monstros.selecionado, 0.4));
  $('#btnVirarD').addEventListener('click', () => monstros.girar(monstros.selecionado, -0.4));
  // Veículo (um objeto com "leva": lista de ids, ou o nome de um "grupo"): "Embarcar" tira do mapa as figuras que ele leva;
  // "Desembarcar" as põe de volta, em fila ao lado dele. Ele lembra quem embarcou; sem essa lembrança, desembarcam todas.
  const levadas = (def) => [...PERSONAGENS, ...MONSTROS].filter((d) => (Array.isArray(def.leva) ? def.leva.includes(d.id) : d.grupo === def.leva));
  function alternarEmbarque(veiculo) {
    if (!veiculo?.def.leva) return;
    const defs = levadas(veiculo.def), ids = new Set(defs.map((d) => d.id));
    if (!veiculo.ocupado) {
      const dentroDele = [];
      for (const m of [...monstros.lista]) if (m.mapa === veiculo.mapa && ids.has(m.def.id)) { dentroDele.push(m.def.id); monstros.remover(m); }
      veiculo.ocupado = true; veiculo.ocupantes = dentroDele;
    } else {
      const sair = veiculo.ocupantes?.length ? veiculo.ocupantes.map((id) => defs.find((d) => d.id === id)).filter(Boolean) : defs;
      veiculo.ocupado = false; veiculo.ocupantes = null;
      const r = veiculo.rumo ?? 0, p = veiculo.grupo.position, k = veiculo.volume ? veiculo.altura / veiculo.volume.alt : 1;
      const lado = [Math.cos(r), -Math.sin(r)], frente = [Math.sin(r), Math.cos(r)], n = sair.length;
      sair.forEach((def, i) => {
        const d = ((veiculo.volume?.larg ?? 2) * k) / 2 + 3, f = (i - (n - 1) / 2) * 3.0;
        const x = p.x + lado[0] * d + frente[0] * f, z = p.z + lado[1] * d + frente[1] * f;
        const m = monstros.invocar(def, x, z, monstros._chao(x, z));
        if (dentro) monstros.definirAltura(m, (def.real ?? 1.9) * AMPLIACAO);
      });
      monstros.selecionar(veiculo);
    }
    monstros.aoMudar();
  }
  $('#btnEmbarcar').addEventListener('click', () => alternarEmbarque(monstros.selecionado));
  $('#btnLanterna').addEventListener('click', () => { if (monstros.lanternasDoGrupo().length > 1) monstros.alternarLanternasGrupo(); else monstros.alternarLanterna(monstros.selecionado); });
  $('#selPose').addEventListener('change', (e) => { monstros.definirPose(monstros.selecionado, e.target.value); e.target.blur(); });
  // Lanterna pela tecla L: a do personagem selecionado ou, sem seleção, a de todos os personagens deste mapa.
  const lanternas = () => { if (monstros.lanternasDoGrupo().length > 1) { monstros.alternarLanternasGrupo(); return; } const s = monstros.selecionado; const alvo = s?.luz ? [s] : monstros.lista.filter((m) => m.luz && m.mapa === mundo.mapaAtual); alvo.forEach((m) => monstros.alternarLanterna(m)); };
  $('#btnRemover').addEventListener('click', () => monstros.remover(monstros.selecionado));
  $('#btnLimpar').addEventListener('click', () => { [...monstros.lista].forEach((m) => monstros.remover(m)); });
  desenharSelecao();

  // ───── Desafios (cabanas para montar, fogueira para acender; ver sistemas/desafios.js) ─────
  const painelD = $('#painelDesafios'), listaD = $('#listaDesafios');
  const DESFAZ = { montar: 'desmontar', acender: 'apagar', abrir: 'fechar', consertar: 'quebrar', erguer: 'derrubar' };
  let rotulosD = [];
  function temDesafios() { return !!(dentro && desafios?.lista(dentro.id).length); }
  function desenharDesafios() {
    for (const r of rotulosD) r.e.remove();
    rotulosD = [];
    if (!temDesafios()) { painelD.classList.remove('aberto'); return; }
    const linhas = [];
    for (const d of desafios.lista(dentro.id)) {
      const b = el('button', d.feito ? 'ativo' : '', d.feito ? (DESFAZ[d.acao] ?? 'desfazer') : d.acao);
      b.addEventListener('click', () => desafios.marcar(dentro.id, d.nome, !d.feito));
      linhas.push(el('span', 'desafio-nome' + (d.feito ? ' feito' : ''), (d.feito ? '✓ ' : '') + d.nome), b);
      // O nome em cima do lugar, para o mestre saber qual é qual (a segunda tela não mostra rótulos).
      const e = el('span', 'rotulo desafio', d.nome);
      camada.append(e);
      rotulosD.push({ d, e });
    }
    listaD.replaceChildren(...linhas);
  }
  function alternarDesafios() {
    const abre = !painelD.classList.contains('aberto');
    painelD.classList.toggle('aberto', abre);
    if (abre) { desenharDesafios(); avisarPainel('desafios'); }
    desenharAngulos();
  }
  if (desafios) desafios.aoMudar = () => { if (painelD.classList.contains('aberto')) desenharDesafios(); };
  $('#btnFazerTudo').addEventListener('click', () => dentro && desafios?.todos(dentro.id, true));
  $('#btnRecomecar').addEventListener('click', () => dentro && desafios?.todos(dentro.id, false));

  // Um painel do lado direito de cada vez (criaturas, desafios, fundo do projetor): quem abre avisa, os outros fecham.
  function avisarPainel(nome) { document.dispatchEvent(new CustomEvent('painel-aberto', { detail: nome })); }
  document.addEventListener('painel-aberto', (e) => {
    if (e.detail !== 'monstros' && painel.classList.contains('aberto')) { painel.classList.remove('aberto'); btnM.classList.remove('ativo'); }
    if (e.detail !== 'desafios' && painelD.classList.contains('aberto')) { painelD.classList.remove('aberto'); desenharAngulos(); }
  });

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
    plantaVisivel: () => mapaEl.classList.contains('visivel'),
    mostrarPlanta: (sim, url) => { if (url && mapaEl.querySelector('img').getAttribute('src') !== url) mapaEl.querySelector('img').src = url; mapaEl.classList.toggle('visivel', !!sim); },
    // Entrada direta (sem animação), usada pelo endereço ?interior=...
    entrar: (id, i) => { const it = INTERIORES.find((x) => x.id === id); if (it) aplicarDestino({ interior: id, camera: i }); },
    interiorAtual: () => dentro,
  };
}
