// Editor de mapas: desenha paredes, portas, salas, móveis, luzes, câmeras e passagens sobre a imagem da planta
// e grava o resultado como mapas/<id>.json (formato em GUIA_DE_MAPAS.md). Todas as posições são pixels da imagem.
import { paredesDe } from '../mundo/interiores/formato.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// ───── Tipos de item ─────
// forma: 'seg' (dois pontos), 'ret' (retângulo) ou 'pto' (um ponto). props: [chave, rótulo, tipo de campo, opções].
const TIPOS = {
  sel: { nome: 'Selecionar', cor: '#cfcfcf', tecla: 'v' },
  parede: { forma: 'seg', nome: 'Parede', cor: '#efe8d8', tecla: 'w', props: [['esp', 'Espessura (m)', 'num'], ['altura', 'Altura (m); vazio = até o teto', 'num'], ['cor', 'Cor', 'cor'], ['acabamento', 'Acabamento', 'sel', ['', 'mansao', 'tabuas', 'concreto', 'pedra', 'tijolo', 'ruina', 'madeira', 'metal', 'reboco', 'gelo']]] },
  porta: { forma: 'seg', nome: 'Porta', cor: '#ff9a3d', tecla: 'd', props: [['revela', 'Salas que revela (separe por vírgula)', 'txt'], ['sentido', 'Lado para onde abre', 'sel', ['1', '-1']], ['fixa', 'Só enfeite (não abre)', 'bool']] },
  sala: { forma: 'ret', nome: 'Sala oculta', cor: '#5b8cff', tecla: 'r', props: [['nome', 'Nome da sala', 'txt']] },
  movel: { forma: 'pto', nome: 'Móvel', cor: '#7fd0ff', tecla: 'm' },
  luz: { forma: 'pto', nome: 'Luz', cor: '#ffd84a', tecla: 'l', props: [['cor', 'Cor', 'cor'], ['forca', 'Força (0,1 a 0,2)', 'num'], ['raio', 'Raio da mancha (m)', 'num'], ['altura', 'Altura (m)', 'num']] },
  camera: { forma: 'seg', nome: 'Câmera', cor: '#ff6ad5', tecla: 'c', props: [['nome', 'Nome', 'txt'], ['altura', 'Altura (m)', 'num']] },
  chegada: { forma: 'seg', nome: 'Chegada', cor: '#6aff8a', tecla: 'h' },
  passagem: { forma: 'pto', nome: 'Passagem', cor: '#ffcf8a', tecla: 'p', props: [['nome', 'Nome', 'txt'], ['anim', 'Animação', 'sel', ['corte', 'porta', 'porta-dupla', 'som']], ['destinoTipo', 'Leva para', 'sel', ['mapa', 'local']], ['destinoId', 'Id do mapa ou do local', 'txt', 'listaMapas'], ['altura', 'Altura do marcador (m)', 'num']] },
  grade: { forma: 'seg', nome: 'Grade', cor: '#9aa0a8', tecla: 'g' },
  barreira: { forma: 'seg', nome: 'Barreira', cor: '#4fd6ff', tecla: 'b' },
  moldura: { forma: 'ret', nome: 'Moldura', cor: '#ffffff', tecla: 'o' },
  medir: { forma: 'seg', nome: 'Medir escala', cor: '#b08cff', tecla: 'e' },
};
const ROTULOS = { w: 'Largura (m)', d: 'Profundidade (m)', l: 'Comprimento (m)', h: 'Altura (m)', r: 'Raio (m)', alt: 'Erguer do chão (m)', cor: 'Cor', tampo: 'Cor do tampo', pes: 'Cor dos pés' };
// Móveis do kit: pegada (largura, profundidade em metros) para desenhar, e opções editáveis.
const MOVEIS = {
  mesa: { pegada: (o) => [o.w ?? 1, o.d ?? 1], op: ['w', 'd', 'h', 'cor'], padrao: { w: 1.2, d: 0.8 } },
  mesaRedonda: { pegada: (o) => [2 * (o.r ?? 0.6), 2 * (o.r ?? 0.6)], op: ['r', 'h', 'cor'], redondo: true },
  cadeira: { pegada: () => [0.45, 0.45], op: ['cor'] },
  banqueta: { pegada: () => [0.36, 0.36], op: ['cor', 'h'], redondo: true },
  sofa: { pegada: (o) => [o.w ?? 0.85, 0.82], op: ['w', 'cor'] },
  cama: { pegada: (o) => [o.w ?? 0.95, o.l ?? 2], op: ['w', 'l', 'cor'] },
  balcao: { pegada: (o) => [o.w ?? 2, o.d ?? 0.6], op: ['w', 'd', 'h', 'cor', 'tampo'] },
  estante: { pegada: (o) => [o.w ?? 2, o.d ?? 0.35], op: ['w', 'h', 'd', 'cor'] },
  caixote: { pegada: (o) => [o.w ?? 0.8, o.d ?? 0.6], op: ['w', 'h', 'd', 'cor'] },
  caixa: { pegada: (o) => [o.w ?? 1, o.d ?? 1], op: ['w', 'h', 'd', 'cor', 'alt'] },
  cilindro: { pegada: (o) => [2 * (o.r ?? 0.5), 2 * (o.r ?? 0.5)], op: ['r', 'h', 'cor', 'alt'], redondo: true },
  barril: { pegada: () => [0.6, 0.6], op: ['cor'], redondo: true },
  maca: { pegada: () => [0.86, 2] }, banheira: { pegada: () => [1.75, 0.8], op: ['cor'] }, vaso: { pegada: () => [0.4, 0.6] }, pia: { pegada: () => [0.5, 0.4] },
  sinuca: { pegada: () => [1.56, 2.76] }, jukebox: { pegada: () => [0.85, 0.55] }, lareira: { pegada: (o) => [o.w ?? 2, 0.7], op: ['w'] },
  rackArmas: { pegada: (o) => [o.w ?? 2, 0.15], op: ['w', 'h'] }, alcapao: { pegada: (o) => [o.w ?? 1.5, o.d ?? 1.6], op: ['w', 'd', 'cor'] },
  vela: { pegada: () => [0.12, 0.12], redondo: true }, castical: { pegada: () => [0.25, 0.25], redondo: true },
};

// ───── Estado ─────
const E = { d: novoMapa(), itens: [], sel: null, ferramenta: 'sel', tipoMovel: 'mesa', zoom: 1, ox: 0, oy: 0, img: null, hist: [], arrasto: null, previa: null, espaco: false };
function novoMapa() { return { id: '', nome: '', imagem: '', larguraPx: 0, alturaPx: 0, escala: 0.02 }; }

const tela = $('#tela'), g = tela.getContext('2d');
let sujo = true;
const pedirDesenho = () => { sujo = true; };
const estado = (txt, tipo = '') => { const e = $('#estado'); e.textContent = txt; e.className = tipo; };

// ───── Conversão arquivo ↔ itens ─────
function carregar(d) {
  E.d = d; E.itens = []; E.sel = null; E.hist = [];
  const seg = (k, [x1, y1, x2, y2], o = {}) => E.itens.push({ k, a: [x1, y1], b: [x2, y2], o });
  for (const o of paredesDe(d)) { const { p, ...resto } = o; seg('parede', p, resto); } // paredes por faixa viram linha + espessura
  for (const p of d.portas ?? []) seg('porta', p.p, { revela: (p.revela ?? []).join(', '), sentido: String(p.sentido ?? 1), fixa: !!p.fixa });
  for (const s of d.grades ?? []) seg('grade', s);
  for (const s of d.barreiras ?? []) seg('barreira', s);
  for (const [nome, rets] of Object.entries(d.salas ?? {})) for (const r of rets) seg('sala', r, { nome });
  if (d.moldura) seg('moldura', d.moldura);
  for (const m of d.moveis ?? []) { const { x, y, ...o } = m; E.itens.push({ k: 'movel', p: [x, y], o }); }
  for (const l of d.luzes ?? []) { const { x, y, ...o } = l; E.itens.push({ k: 'luz', p: [x, y], o }); }
  for (const c of d.cameras ?? []) E.itens.push({ k: 'camera', a: [...c.de], b: [...c.para], o: { nome: c.nome ?? 'Câmera', ...(c.altura != null ? { altura: c.altura } : {}) } });
  if (d.chegada) E.itens.push({ k: 'chegada', a: [...d.chegada.de], b: [...d.chegada.para], o: {} });
  for (const p of d.passagens ?? []) {
    const dst = p.destino ?? {};
    E.itens.push({ k: 'passagem', p: [p.x, p.y], o: { nome: p.nome ?? 'Passagem', anim: p.anim ?? 'corte', destinoTipo: dst.mapa ? 'mapa' : 'local', destinoId: dst.mapa ?? dst.local ?? 'cidade', ...(p.altura != null ? { altura: p.altura } : {}), _extra: Object.fromEntries(Object.entries(dst).filter(([k]) => k !== 'mapa' && k !== 'local')) } });
  }
  preencherCampos();
  carregarImagem(d.imagem);
}
const arred = (v) => Math.round(v * 10) / 10;
const limpar = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !k.startsWith('_') && v !== '' && v != null));
function montar() {
  const d = { ...E.d };
  for (const k of ['paredes', 'portas', 'grades', 'barreiras', 'salas', 'moldura', 'moveis', 'luzes', 'cameras', 'chegada', 'passagens']) delete d[k];
  const de = (k) => E.itens.filter((i) => i.k === k);
  const p4 = (i) => [arred(i.a[0]), arred(i.a[1]), arred(i.b[0]), arred(i.b[1])];
  const paredes = de('parede').map((i) => { const o = limpar(i.o); return Object.keys(o).length ? { p: p4(i), ...o, ...(o.esp != null ? { esp: Number(o.esp) } : {}), ...(o.altura != null ? { altura: Number(o.altura) } : {}) } : p4(i); });
  if (paredes.length) d.paredes = paredes;
  const portas = de('porta').map((i) => ({ p: p4(i), revela: String(i.o.revela ?? '').split(',').map((s) => s.trim()).filter(Boolean), ...(Number(i.o.sentido ?? 1) !== 1 ? { sentido: Number(i.o.sentido) } : {}), ...(i.o.fixa ? { fixa: true } : {}) }));
  if (portas.length) d.portas = portas;
  if (de('grade').length) d.grades = de('grade').map(p4);
  if (de('barreira').length) d.barreiras = de('barreira').map(p4);
  const salas = {};
  for (const i of de('sala')) (salas[i.o.nome || 'sala'] ??= []).push([Math.min(i.a[0], i.b[0]), Math.min(i.a[1], i.b[1]), Math.max(i.a[0], i.b[0]), Math.max(i.a[1], i.b[1])].map(arred));
  if (Object.keys(salas).length) d.salas = salas;
  const mol = de('moldura')[0];
  if (mol) d.moldura = [Math.min(mol.a[0], mol.b[0]), Math.min(mol.a[1], mol.b[1]), Math.max(mol.a[0], mol.b[0]), Math.max(mol.a[1], mol.b[1])].map(arred);
  const numeros = (o) => Object.fromEntries(Object.entries(limpar(o)).map(([k, v]) => [k, typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) && k !== 'cor' && k !== 'tampo' && k !== 'pes' ? Number(v) : v]));
  if (de('movel').length) d.moveis = de('movel').map((i) => ({ tipo: i.o.tipo, x: arred(i.p[0]), y: arred(i.p[1]), ...numeros(i.o) }));
  if (de('luz').length) d.luzes = de('luz').map((i) => ({ x: arred(i.p[0]), y: arred(i.p[1]), ...numeros(i.o) }));
  if (de('camera').length) d.cameras = de('camera').map((i) => ({ nome: i.o.nome || 'Câmera', de: i.a.map(arred), para: i.b.map(arred), ...(i.o.altura ? { altura: Number(i.o.altura) } : {}) }));
  const ch = de('chegada')[0];
  if (ch) d.chegada = { de: ch.a.map(arred), para: ch.b.map(arred) };
  if (de('passagem').length) d.passagens = de('passagem').map((i) => ({ x: arred(i.p[0]), y: arred(i.p[1]), ...(i.o.altura ? { altura: Number(i.o.altura) } : {}), nome: i.o.nome || 'Passagem', anim: i.o.anim || 'corte', destino: { [i.o.destinoTipo === 'local' ? 'local' : 'mapa']: i.o.destinoId || 'cidade', ...(i.o._extra ?? {}) } }));
  return d;
}

// ───── Campos do mapa ─────
const CAMPOS = [['#cId', 'id'], ['#cNome', 'nome'], ['#cLocal', 'local'], ['#cImagem', 'imagem'], ['#cImagemNoite', 'imagemNoite'], ['#cAcabamento', 'acabamento']];
function preencherCampos() {
  const d = E.d;
  for (const [s, k] of CAMPOS) $(s).value = d[k] ?? '';
  $('#cCorParede').value = d.corParede ?? '#4b4e52';
  $('#cEscala').value = d.escala ?? '';
  $('#cEspParede').value = d.espParede ?? 0.22;
  $('#cTeto').checked = !!d.teto; $('#cCorTeto').value = d.teto?.cor ?? '#2b1f16'; $('#cVigas').checked = !!d.teto?.vigas;
}
function lerCampos() {
  const d = E.d;
  for (const [s, k] of CAMPOS) { const v = $(s).value.trim(); if (v) d[k] = v; else delete d[k]; }
  d.escala = Number($('#cEscala').value) || d.escala;
  const esp = Number($('#cEspParede').value); if (esp && esp !== 0.22) d.espParede = esp; else delete d.espParede;
  if ($('#cTeto').checked) d.teto = { cor: $('#cCorTeto').value, ...($('#cVigas').checked ? { vigas: true } : {}), ...(d.teto?.area ? { area: d.teto.area } : {}) }; else delete d.teto;
}
// A cor da parede só entra no arquivo se a pessoa mexer nela (com acabamento, ela tinge a textura).
$('#cCorParede').addEventListener('change', (e) => { guardar(); E.d.corParede = e.target.value; pedirDesenho(); });
for (const s of ['#cId', '#cNome', '#cLocal', '#cImagemNoite', '#cAcabamento', '#cEscala', '#cEspParede', '#cTeto', '#cCorTeto', '#cVigas']) $(s).addEventListener('change', () => { lerCampos(); pedirDesenho(); });
$('#cImagem').addEventListener('change', () => { lerCampos(); carregarImagem(E.d.imagem); });

function carregarImagem(url, enquadrar = true) {
  E.img = null; $('#vazio').hidden = !!url;
  if (!url) { pedirDesenho(); return; }
  const im = new Image();
  im.onload = () => { E.img = im; E.d.larguraPx = im.naturalWidth; E.d.alturaPx = im.naturalHeight; if (enquadrar) ajustarVista(); pedirDesenho(); };
  im.onerror = () => estado(`Não consegui abrir a imagem "${url}".`, 'erro');
  im.src = url;
}
function ajustarVista() {
  const r = tela.getBoundingClientRect(), w = E.d.larguraPx || 1000, h = E.d.alturaPx || 600;
  E.zoom = Math.min(r.width / w, r.height / h) * 0.94;
  E.ox = (r.width - w * E.zoom) / 2; E.oy = (r.height - h * E.zoom) / 2;
}

// Envio da imagem: grava em assets/interiores/ pelo servidor local; sem servidor, só mostra na tela.
$('#arqImagem').addEventListener('change', async (ev) => {
  const arq = ev.target.files[0];
  if (!arq) return;
  const nome = arq.name.normalize('NFD').replace(/[^\w.-]+/g, '_').replace(/^_+/, '') || 'planta.png';
  let caminho = 'assets/interiores/' + nome;
  try {
    const r = await fetch('/api/imagem?nome=' + encodeURIComponent(nome), { method: 'POST', body: arq });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro ?? 'falha');
    caminho = j.caminho;
    estado(`Imagem gravada em ${caminho}.`, 'ok');
    E.d.imagem = caminho; $('#cImagem').value = caminho; carregarImagem(caminho);
  } catch {
    E.d.imagem = caminho; $('#cImagem').value = caminho; $('#vazio').hidden = true;
    const im = new Image();
    im.onload = () => { E.img = im; E.d.larguraPx = im.naturalWidth; E.d.alturaPx = im.naturalHeight; ajustarVista(); pedirDesenho(); };
    im.src = URL.createObjectURL(arq);
    estado(`Sem servidor local: copie o arquivo "${nome}" para a pasta assets/interiores/ antes de abrir o mapa em 3D.`, 'erro');
  }
});

// ───── Geometria ─────
const paraTela = ([x, y]) => [x * E.zoom + E.ox, y * E.zoom + E.oy];
const paraPlanta = (sx, sy) => [(sx - E.ox) / E.zoom, (sy - E.oy) / E.zoom];
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], c = dx * dx + dy * dy;
  const t = c ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / c)) : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}
const pegada = (i) => { const m = MOVEIS[i.o.tipo] ?? MOVEIS.caixa; const [w, d] = m.pegada(i.o); return [w / E.d.escala, d / E.d.escala, m]; };
// Encaixa nas pontas de paredes, portas e grades já desenhadas.
function encaixar(p, ignorar) {
  const lim = 9 / E.zoom; let melhor = null, md = lim;
  for (const i of E.itens) {
    if (i === ignorar || !['parede', 'porta', 'grade'].includes(i.k)) continue;
    for (const q of [i.a, i.b]) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < md) { md = d; melhor = q; } }
  }
  return melhor ? [...melhor] : p;
}
// Deixa o segmento reto (horizontal ou vertical) quando está quase reto.
function alinhar(a, b, livre) {
  if (livre) return b;
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  if (dx < dy * 0.09) return [a[0], b[1]];
  if (dy < dx * 0.09) return [b[0], a[1]];
  return b;
}
function acertar(p) {
  const lim = 8 / E.zoom;
  // Alças do item selecionado primeiro.
  if (E.sel && E.sel.a) for (const parte of ['a', 'b']) if (Math.hypot(E.sel[parte][0] - p[0], E.sel[parte][1] - p[1]) < lim) return { item: E.sel, parte };
  let achado = null;
  for (let n = E.itens.length - 1; n >= 0 && !achado; n--) {
    const i = E.itens[n], f = TIPOS[i.k].forma;
    if (f === 'pto') {
      if (i.k === 'movel') { const [w, d] = pegada(i); if (Math.hypot(i.p[0] - p[0], i.p[1] - p[1]) < Math.max(w, d) / 2 + lim * 0.5) achado = { item: i, parte: 'corpo' }; }
      else if (Math.hypot(i.p[0] - p[0], i.p[1] - p[1]) < lim * 1.5) achado = { item: i, parte: 'corpo' };
    } else if (f === 'seg') { if (distSeg(p, i.a, i.b) < lim) achado = { item: i, parte: 'corpo' }; }
  }
  if (achado) return achado;
  // Retângulos (salas, moldura) por último, para não tampar o que está dentro: vale a borda.
  for (let n = E.itens.length - 1; n >= 0; n--) {
    const i = E.itens[n];
    if (TIPOS[i.k].forma !== 'ret') continue;
    const [x0, y0, x1, y1] = [Math.min(i.a[0], i.b[0]), Math.min(i.a[1], i.b[1]), Math.max(i.a[0], i.b[0]), Math.max(i.a[1], i.b[1])];
    const dentro = p[0] > x0 - lim && p[0] < x1 + lim && p[1] > y0 - lim && p[1] < y1 + lim;
    const borda = Math.min(Math.abs(p[0] - x0), Math.abs(p[0] - x1), Math.abs(p[1] - y0), Math.abs(p[1] - y1)) < lim;
    if (dentro && (borda || i.k === 'sala')) return { item: i, parte: 'corpo' };
  }
  return null;
}

// ───── Histórico ─────
function guardar() { E.hist.push(JSON.stringify({ itens: E.itens, d: E.d })); if (E.hist.length > 80) E.hist.shift(); }
function desfazer() {
  const h = E.hist.pop();
  if (!h) return;
  const o = JSON.parse(h); E.itens = o.itens; E.d = o.d; E.sel = null; preencherCampos(); desenharProps(); pedirDesenho();
}

// ───── Ferramentas ─────
const barraF = $('#ferramentas');
for (const [k, t] of Object.entries(TIPOS)) {
  const b = el('button'); b.dataset.k = k; b.title = `${t.nome} (${t.tecla.toUpperCase()})`;
  const cor = el('i'); cor.style.background = t.cor;
  b.append(cor, el('span', null, t.nome));
  b.addEventListener('click', () => usar(k));
  barraF.append(b);
}
function usar(k) {
  E.ferramenta = k; E.previa = null;
  for (const b of barraF.children) b.classList.toggle('ativo', b.dataset.k === k);
  $('#secMovel').hidden = k !== 'movel';
  tela.style.cursor = k === 'sel' ? 'default' : 'crosshair';
  pedirDesenho();
}
const selMovel = $('#selMovel');
for (const nome of Object.keys(MOVEIS)) { const o = el('option', null, nome); o.value = nome; selMovel.append(o); }
selMovel.value = E.tipoMovel;
selMovel.addEventListener('change', () => { E.tipoMovel = selMovel.value; });

// ───── Propriedades do item selecionado ─────
function selecionar(i) { E.sel = i; desenharProps(); pedirDesenho(); }
function desenharProps() {
  const sec = $('#secSel'), i = E.sel;
  sec.hidden = !i;
  if (!i) return;
  const t = TIPOS[i.k];
  $('#selTitulo').textContent = i.k === 'movel' ? `Móvel: ${i.o.tipo}` : t.nome;
  let props = t.props ?? [];
  if (i.k === 'movel') props = [['giro', 'Giro (graus)', 'num'], ...(MOVEIS[i.o.tipo]?.op ?? []).map((k) => [k, ROTULOS[k] ?? k, k === 'cor' || k === 'tampo' || k === 'pes' ? 'cor' : 'num'])];
  const caixa = $('#props'); caixa.replaceChildren();
  for (const [chave, rotulo, tipo, opcoes] of props) {
    const linha = el('label', tipo === 'bool' ? 'marca' : 'linha');
    let campo;
    if (tipo === 'sel') { campo = el('select'); for (const v of opcoes) { const o = el('option', null, v === '' ? '(o do mapa)' : v); o.value = v; campo.append(o); } campo.value = String(i.o[chave] ?? opcoes[0]); }
    else if (tipo === 'bool') { campo = el('input'); campo.type = 'checkbox'; campo.checked = !!i.o[chave]; }
    else { campo = el('input'); campo.type = tipo === 'num' ? 'number' : tipo === 'cor' ? 'color' : 'text'; if (tipo === 'num') campo.step = 'any'; if (tipo === 'txt' && opcoes) campo.setAttribute('list', opcoes); campo.value = i.o[chave] ?? (tipo === 'cor' ? '#5a4630' : ''); }
    campo.addEventListener('change', () => {
      guardar();
      const v = tipo === 'bool' ? campo.checked : tipo === 'num' ? (campo.value === '' ? '' : Number(campo.value)) : campo.value;
      if (v === '' || v === false) delete i.o[chave]; else i.o[chave] = v;
      pedirDesenho();
    });
    if (tipo === 'bool') linha.append(campo, rotulo); else linha.append(rotulo, campo);
    caixa.append(linha);
  }
}
$('#btnApagar').addEventListener('click', apagar);
function apagar() { if (!E.sel) return; guardar(); E.itens = E.itens.filter((i) => i !== E.sel); selecionar(null); }

// ───── Mouse ─────
const posicao = (e) => { const r = tela.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
tela.addEventListener('contextmenu', (e) => e.preventDefault());
tela.addEventListener('pointerdown', (e) => {
  const [sx, sy] = posicao(e), p = paraPlanta(sx, sy);
  try { tela.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
  if (e.button !== 0 || E.espaco) { E.arrasto = { tipo: 'vista', sx, sy, ox: E.ox, oy: E.oy }; return; }
  const k = E.ferramenta;
  if (k === 'sel') {
    const h = acertar(p);
    selecionar(h?.item ?? null);
    if (h) { guardar(); E.arrasto = { tipo: 'mover', parte: h.parte, ini: p, base: JSON.parse(JSON.stringify(h.item)), mexeu: false }; }
    else E.arrasto = { tipo: 'vista', sx, sy, ox: E.ox, oy: E.oy };
    return;
  }
  if (!E.img) { estado('Escolha ou envie a imagem da planta primeiro.', 'erro'); return; }
  if (TIPOS[k].forma === 'pto') {
    guardar();
    const o = k === 'movel' ? { tipo: E.tipoMovel, giro: 0, ...(MOVEIS[E.tipoMovel].padrao ?? {}) } : k === 'passagem' ? { nome: 'Passagem', anim: 'corte', destinoTipo: 'local', destinoId: 'cidade' } : {};
    const item = { k, p: p.map(arred), o };
    E.itens.push(item); selecionar(item);
    return;
  }
  const a = ['parede', 'porta', 'grade', 'barreira'].includes(k) ? encaixar(p) : p;
  E.arrasto = { tipo: 'criar', k, a };
  E.previa = { k, a, b: a };
});
tela.addEventListener('pointermove', (e) => {
  const [sx, sy] = posicao(e), p = paraPlanta(sx, sy), ar = E.arrasto;
  if (!ar) return;
  if (ar.tipo === 'vista') { E.ox = ar.ox + sx - ar.sx; E.oy = ar.oy + sy - ar.sy; }
  else if (ar.tipo === 'criar') {
    let b = p;
    if (['parede', 'porta', 'grade', 'barreira'].includes(ar.k)) b = alinhar(ar.a, encaixar(p), e.shiftKey);
    else if (ar.k === 'medir') b = alinhar(ar.a, p, e.shiftKey);
    E.previa.b = b;
  } else if (ar.tipo === 'mover') {
    const i = E.sel, dx = p[0] - ar.ini[0], dy = p[1] - ar.ini[1];
    ar.mexeu = true;
    if (i.p) i.p = [ar.base.p[0] + dx, ar.base.p[1] + dy];
    else if (ar.parte === 'corpo') { i.a = [ar.base.a[0] + dx, ar.base.a[1] + dy]; i.b = [ar.base.b[0] + dx, ar.base.b[1] + dy]; }
    else {
      const fixo = ar.parte === 'a' ? 'b' : 'a', reto = ['parede', 'porta', 'grade', 'barreira'].includes(i.k);
      i[ar.parte] = reto ? alinhar(i[fixo], encaixar(p, i), e.shiftKey) : p;
    }
  }
  pedirDesenho();
});
tela.addEventListener('pointerup', () => {
  const ar = E.arrasto; E.arrasto = null;
  if (!ar) return;
  if (ar.tipo === 'mover' && !ar.mexeu) E.hist.pop(); // clique sem arrastar não conta como alteração
  if (ar.tipo === 'criar') {
    const { a, b } = E.previa; E.previa = null;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) { pedirDesenho(); return; }
    if (ar.k === 'medir') { E.medida = Math.hypot(b[0] - a[0], b[1] - a[1]); $('#medPx').textContent = E.medida.toFixed(1); $('#medida').hidden = false; E.previaMedida = { a, b }; pedirDesenho(); return; }
    guardar();
    if (ar.k === 'chegada' || ar.k === 'moldura') E.itens = E.itens.filter((i) => i.k !== ar.k); // só existe uma
    const o = ar.k === 'sala' ? { nome: 'sala' + (E.itens.filter((i) => i.k === 'sala').length + 1) } : ar.k === 'porta' ? { revela: '', sentido: '1' } : ar.k === 'camera' ? { nome: 'Câmera ' + (E.itens.filter((i) => i.k === 'camera').length + 1) } : {};
    const item = { k: ar.k, a: a.map(arred), b: b.map(arred), o };
    E.itens.push(item); selecionar(item);
  }
  pedirDesenho();
});
tela.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [sx, sy] = posicao(e), p = paraPlanta(sx, sy);
  E.zoom = Math.min(12, Math.max(0.08, E.zoom * Math.exp(-e.deltaY * 0.0015)));
  E.ox = sx - p[0] * E.zoom; E.oy = sy - p[1] * E.zoom;
  pedirDesenho();
}, { passive: false });
$('#btnAplicarEscala').addEventListener('click', () => {
  const m = Number($('#medM').value);
  if (!m || !E.medida) return;
  guardar();
  E.d.escala = Math.round((m / E.medida) * 100000) / 100000;
  $('#cEscala').value = E.d.escala; $('#medida').hidden = true; E.previaMedida = null;
  estado(`Escala definida: ${E.d.escala} m por pixel (a planta tem ${(E.d.larguraPx * E.d.escala).toFixed(1)} m de largura).`, 'ok');
  pedirDesenho();
});

// ───── Teclado ─────
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.target.matches('input, select')) { E.espaco = true; e.preventDefault(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(); return; }
  if (e.target.matches('input, select') || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  const f = Object.entries(TIPOS).find(([, t]) => t.tecla === k);
  if (f) { usar(f[0]); return; }
  const i = E.sel;
  if (!i) return;
  if (k === 'delete' || k === 'backspace') { apagar(); return; }
  const passo = e.shiftKey ? 10 : 1, mov = { arrowleft: [-passo, 0], arrowright: [passo, 0], arrowup: [0, -passo], arrowdown: [0, passo] }[k];
  if (mov) { e.preventDefault(); guardar(); for (const parte of ['p', 'a', 'b']) if (i[parte]) i[parte] = [i[parte][0] + mov[0], i[parte][1] + mov[1]]; pedirDesenho(); }
  else if ((k === '[' || k === ']') && i.k === 'movel') { guardar(); i.o.giro = ((Number(i.o.giro) || 0) + (k === ']' ? -1 : 1) * (e.shiftKey ? 90 : 15) + 360) % 360; desenharProps(); pedirDesenho(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') E.espaco = false; });

// ───── Desenho ─────
function seta(a, b, cor, rotulo) {
  const [ax, ay] = paraTela(a), [bx, by] = paraTela(b), ang = Math.atan2(by - ay, bx - ax);
  g.strokeStyle = g.fillStyle = cor; g.lineWidth = 2;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 11 * Math.cos(ang - 0.4), by - 11 * Math.sin(ang - 0.4)); g.lineTo(bx - 11 * Math.cos(ang + 0.4), by - 11 * Math.sin(ang + 0.4)); g.fill();
  g.beginPath(); g.arc(ax, ay, 5, 0, 6.3); g.fill();
  if (rotulo) texto(rotulo, ax + 8, ay - 8, cor);
}
function texto(t, x, y, cor = '#fff') { g.font = '11px system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(t, x, y); g.fillStyle = cor; g.fillText(t, x, y); }
function desenharItem(i, selecionado, fantasma = false) {
  const t = TIPOS[i.k], z = E.zoom, esc = E.d.escala || 0.02;
  g.globalAlpha = fantasma ? 0.6 : 1; g.setLineDash([]);
  if (t.forma === 'seg') {
    const [ax, ay] = paraTela(i.a), [bx, by] = paraTela(i.b);
    if (i.k === 'camera') seta(i.a, i.b, t.cor, i.o.nome);
    else if (i.k === 'chegada') seta(i.a, i.b, t.cor, 'Chegada (a pé)');
    else {
      g.strokeStyle = selecionado ? '#fff' : t.cor; g.lineCap = 'butt';
      g.lineWidth = i.k === 'parede' ? Math.max(2, ((Number(i.o.esp) || E.d.espParede || 0.22) / esc) * z) : i.k === 'porta' ? Math.max(4, (0.09 / esc) * z) : 2.5;
      if (i.k === 'grade') g.setLineDash([3, 4]); if (i.k === 'barreira') g.setLineDash([8, 5]); if (i.k === 'medir') g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
      if (i.k === 'porta') texto(i.o.fixa ? 'porta fixa' : i.o.revela ? '→ ' + i.o.revela : 'porta', (ax + bx) / 2 + 6, (ay + by) / 2 - 6, t.cor);
      if (i.k === 'medir' || fantasma) texto(`${Math.hypot(i.b[0] - i.a[0], i.b[1] - i.a[1]).toFixed(0)} px = ${(Math.hypot(i.b[0] - i.a[0], i.b[1] - i.a[1]) * esc).toFixed(2)} m`, (ax + bx) / 2 + 6, (ay + by) / 2 + 14, '#fff');
    }
  } else if (t.forma === 'ret') {
    const [ax, ay] = paraTela(i.a), [bx, by] = paraTela(i.b), x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
    if (i.k === 'sala') { g.fillStyle = selecionado ? 'rgba(91,140,255,0.34)' : 'rgba(91,140,255,0.2)'; g.fillRect(x, y, w, h); }
    g.strokeStyle = selecionado ? '#fff' : t.cor; g.lineWidth = 1.5; g.setLineDash(i.k === 'moldura' ? [10, 6] : []); g.strokeRect(x, y, w, h); g.setLineDash([]);
    texto(i.k === 'sala' ? `sala oculta: ${i.o.nome ?? ''}` : 'moldura', x + 5, y + 14, t.cor);
  } else {
    const [x, y] = paraTela(i.p);
    if (i.k === 'movel') {
      const [w, d, m] = pegada(i);
      g.save(); g.translate(x, y); g.rotate((-(Number(i.o.giro) || 0) * Math.PI) / 180);
      g.fillStyle = selecionado ? 'rgba(255,255,255,0.4)' : 'rgba(127,208,255,0.3)'; g.strokeStyle = selecionado ? '#fff' : t.cor; g.lineWidth = 1.5;
      g.beginPath();
      if (m.redondo) g.ellipse(0, 0, (w * z) / 2, (d * z) / 2, 0, 0, 6.3); else g.rect((-w * z) / 2, (-d * z) / 2, w * z, d * z);
      g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, (d * z) / 2 + 5); g.stroke(); // risco apontando para a frente da peça
      g.restore();
      if (z > 0.5 || selecionado) texto(i.o.tipo, x + 5, y - 5, t.cor);
    } else if (i.k === 'luz') {
      g.strokeStyle = 'rgba(255,216,74,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, (((Number(i.o.raio) || E.d.luzPadrao?.raio || 5) * 0.75) / esc) * z, 0, 6.3); g.stroke();
      g.fillStyle = selecionado ? '#fff' : i.o.cor || E.d.luzPadrao?.cor || t.cor; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill();
    } else {
      g.fillStyle = selecionado ? '#fff' : t.cor; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.fill();
      texto(`${i.o.nome ?? ''} → ${i.o.destinoId ?? ''}`, x + 11, y + 4, t.cor);
    }
  }
  if (selecionado && i.a) for (const q of [i.a, i.b]) { const [x, y] = paraTela(q); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.fillRect(x - 4, y - 4, 8, 8); g.strokeRect(x - 4, y - 4, 8, 8); }
  g.globalAlpha = 1;
}
const ORDEM = ['moldura', 'sala', 'luz', 'movel', 'barreira', 'grade', 'parede', 'porta', 'camera', 'chegada', 'passagem'];
function desenhar() {
  const r = tela.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (tela.width !== Math.round(r.width * dpr) || tela.height !== Math.round(r.height * dpr)) { tela.width = Math.round(r.width * dpr); tela.height = Math.round(r.height * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  if (E.img) { g.imageSmoothingEnabled = E.zoom < 3; g.drawImage(E.img, E.ox, E.oy, E.d.larguraPx * E.zoom, E.d.alturaPx * E.zoom); }
  for (const k of ORDEM) for (const i of E.itens) if (i.k === k && i !== E.sel) desenharItem(i, false);
  if (E.sel) desenharItem(E.sel, true);
  if (E.previa) desenharItem({ ...E.previa, o: {} }, false, true);
  if (E.previaMedida) desenharItem({ k: 'medir', ...E.previaMedida, o: {} }, false);
}
(function laco() { if (sujo) { sujo = false; desenhar(); } requestAnimationFrame(laco); })();
window.addEventListener('resize', pedirDesenho);

// ───── Salvar, baixar, ver ─────
function validar(d) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(d.id ?? '')) return 'Dê um id ao mapa: letras minúsculas, números, _ e -, sem espaços.';
  if (!d.imagem) return 'Escolha ou envie a imagem da planta.';
  if (!d.larguraPx || !d.alturaPx) return 'A imagem da planta ainda não carregou.';
  if (!(d.escala > 0)) return 'Defina a escala (use a ferramenta "Medir escala").';
  const salas = new Set(E.itens.filter((i) => i.k === 'sala').map((i) => i.o.nome));
  const reveladas = new Set(E.itens.filter((i) => i.k === 'porta').flatMap((i) => String(i.o.revela ?? '').split(',').map((s) => s.trim())));
  const presas = [...salas].filter((s) => !reveladas.has(s));
  if (presas.length) return `Sala oculta sem porta que a revele: ${presas.join(', ')}. Ligue uma porta a ela ou apague a sala.`;
  return null;
}
function baixar(d) {
  const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2) + '\n'], { type: 'application/json' })); a.download = d.id + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function salvar() {
  lerCampos();
  const d = montar(), erro = validar(d);
  if (erro) { estado(erro, 'erro'); return false; }
  try {
    const r = await fetch('/api/mapa', { method: 'POST', body: JSON.stringify(d) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro ?? 'falha');
    estado(`Salvo em ${j.arquivo} (${E.itens.length} itens).`, 'ok');
    await listarMapas(d.id);
    return true;
  } catch {
    baixar(d);
    estado('Sem servidor local para gravar: o arquivo foi baixado. Ponha-o na pasta mapas/ e acrescente o nome dele em mapas/indice.json.', 'erro');
    return false;
  }
}
$('#btnSalvar').addEventListener('click', salvar);
$('#btnDesfazer').addEventListener('click', desfazer);
$('#btnBaixar').addEventListener('click', () => { lerCampos(); const d = montar(), erro = validar(d); if (erro) estado(erro, 'erro'); else baixar(d); });
$('#btnVer').addEventListener('click', async () => { if (await salvar()) window.open(`index.html?mapa=${encodeURIComponent(E.d.id)}&ang=0`, 'previa-3d'); });

// ───── Lista de mapas ─────
const selMapa = $('#selMapa');
let mapas = {};
async function listarMapas(escolhido) {
  mapas = {};
  try {
    const nomes = (await (await fetch('mapas/indice.json', { cache: 'no-store' })).json()).mapas ?? [];
    for (const n of nomes) { try { const d = await (await fetch('mapas/' + n, { cache: 'no-store' })).json(); if (d.id) mapas[d.id] = d; } catch { /* arquivo com defeito: fica fora da lista */ } }
  } catch { /* sem índice ainda */ }
  selMapa.replaceChildren();
  const novo = el('option', null, '— novo mapa —'); novo.value = ''; selMapa.append(novo);
  for (const d of Object.values(mapas)) { const o = el('option', null, `${d.nome ?? d.id} (${d.id})`); o.value = d.id; selMapa.append(o); }
  $('#listaMapas').replaceChildren(...Object.keys(mapas).map((id) => { const o = el('option'); o.value = id; return o; }));
  selMapa.value = escolhido && mapas[escolhido] ? escolhido : '';
}
selMapa.addEventListener('change', () => {
  if (selMapa.value) { carregar(JSON.parse(JSON.stringify(mapas[selMapa.value]))); estado(`Mapa "${selMapa.value}" aberto.`); }
  else { carregar(novoMapa()); estado('Mapa novo: envie a imagem da planta, meça a escala e comece pelas paredes.'); }
  desenharProps();
});

usar('sel');
await listarMapas();
const pedido = new URLSearchParams(location.search).get('mapa');
if (pedido && mapas[pedido]) { selMapa.value = pedido; carregar(JSON.parse(JSON.stringify(mapas[pedido]))); estado(`Mapa "${pedido}" aberto.`); }
else { carregar(novoMapa()); estado('Escolha um mapa na lista ou comece um novo enviando a imagem da planta.'); }
window.editor = { E, montar, carregar, salvar, usar };
