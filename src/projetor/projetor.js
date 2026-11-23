// Janela do projetor (projetor.html): só o vídeo de fundo, sem som e sem interface.
// O menu "Fundo" da janela do mestre (src/projetor/menu.js) escolhe o vídeo pelo BroadcastChannel.
// Na troca, o vídeo novo aparece aos poucos por cima do antigo, sem tela preta no meio.
// O primeiro da lista é o fundo de base e repete sempre. Os outros passam uma vez e voltam sozinhos para ele,
// a não ser que o mestre marque "repete": aí repetem, misturando o fim com o começo (a névoa não dá pulo na volta).
// "velocidade" (1 = normal, 0,6 = mais lento) muda o ritmo do vídeo. "repetirDe" (segundos, em fundos.json) faz o começo passar só na primeira vez: as voltas recomeçam dali.

const PASTA = 'assets/videos/';
const TROCA = 1.5; // segundos de mistura ao trocar de vídeo e ao voltar para o fundo de base
const VOLTA = 1.0; // segundos de mistura no ponto em que o vídeo recomeça
const PREPARO = 1.5; // quanto antes da mistura o vídeo seguinte começa a carregar

const aviso = document.getElementById('aviso');
const canal = new BroadcastChannel('3seed-projetor');
let fundos = [], urls = null, atual = -1, corrente = null, pedido = 0, z = 0;
const avisar = (extra) => canal.postMessage({ projetor: atual, ...extra });

// Até os vídeos carregarem, guarda o último pedido do mestre (o primeiro vem no endereço: ?fundo=N&repetir=0,1,...).
const endereco = new URLSearchParams(location.search);
let inicial = Number(endereco.get('fundo') ?? 0) || 0;
let repetir = (endereco.get('repetir') ?? '').split(',').map((x) => x === '1');
canal.onmessage = (ev) => {
  const d = ev.data ?? {};
  if (Array.isArray(d.repetir)) repetir = d.repetir.map(Boolean); // vale na hora, até para o vídeo que está passando
  if (Number.isInteger(d.fundo)) { if (urls) trocar(d.fundo); else inicial = d.fundo; }
  if (d.pedir) avisar();
};
addEventListener('pagehide', () => canal.postMessage({ projetor: null }));

function descartar(v) {
  v.pause(); v.removeAttribute('src'); v.load(); v.remove();
}

// Cria o vídeo i, invisível, já parado no segundo `inicio`.
async function preparar(i, inicio) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.defaultPlaybackRate = v.playbackRate = fundos[i].velocidade ?? 1; // "velocidade" em fundos.json: 0,5 = metade (mais lento)
  v.src = urls[i];
  document.body.append(v);
  try {
    await new Promise((ok, erro) => { v.addEventListener('loadeddata', ok, { once: true }); v.addEventListener('error', erro, { once: true }); });
    if (inicio > 0) { v.currentTime = inicio; await new Promise((ok) => v.addEventListener('seeked', ok, { once: true })); }
  } catch (e) { descartar(v); throw e; }
  return v;
}

// Põe o vídeo v por cima de tudo e o faz aparecer em `dur` segundos; os de baixo saem quando ele cobre a tela.
// Com "comecaParado" (alguém entra em cena logo no começo do vídeo), o primeiro quadro aparece parado e o vídeo
// só anda quando já cobre a tela: assim o bicho não entra transparente. As voltas por "repetirDe" andam sempre.
async function mostrar(v, i, dur) {
  const embaixo = [...document.querySelectorAll('video')].filter((x) => x !== v && x.style.zIndex);
  const parado = !!fundos[i].comecaParado && v.currentTime < 0.05;
  v.style.zIndex = ++z;
  const antes = corrente;
  corrente = { v, i, preparando: null, para: -1, saindo: false };
  if (antes?.preparando && !antes.saindo) antes.preparando.then(descartar, () => {}); // o seguinte que não vai mais entrar
  if (!parado) await v.play().catch(() => {});
  await v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 1000, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
  if (parado && v.isConnected) await v.play().catch(() => {});
  for (const x of embaixo) if (x.isConnected) descartar(x);
}

async function trocar(i) {
  if (!urls || !fundos[i] || i === atual) return;
  atual = i; avisar();
  const meu = ++pedido;
  const v = await preparar(i, 0).catch((e) => { console.warn('Vídeo não abriu:', fundos[i].arquivo, e); return null; });
  if (!v) return;
  if (meu !== pedido) { descartar(v); return; } // outro pedido chegou enquanto este carregava
  mostrar(v, i, TROCA);
}

// Perto do fim do vídeo da vez, prepara o seguinte e o mistura por cima: o mesmo vídeo de novo (base ou "repete"
// marcado) ou o fundo de base. A escolha é feita no último instante, para valer o quadradinho como está agora.
function vigiar() {
  requestAnimationFrame(vigiar);
  const c = corrente;
  if (!c || c.saindo || !c.v.duration) return;
  const d = c.v.duration, resta = d - c.v.currentTime;
  const fica = c.i === 0 || !!repetir[c.i];
  const prox = fica ? c.i : 0;
  const mistura = Math.min(fica ? VOLTA : TROCA, d / 4);
  if (resta < mistura + PREPARO && c.para !== prox) {
    c.preparando?.then(descartar, () => {});
    c.preparando = preparar(prox, fica ? Math.min(fundos[c.i].repetirDe ?? 0, d - 2 * mistura) : 0);
    c.para = prox;
  }
  if (resta <= mistura || c.v.ended) {
    c.saindo = true;
    if (prox !== c.i) { atual = prox; avisar(); }
    c.preparando.then(
      (nv) => (corrente === c ? mostrar(nv, prox, mistura) : descartar(nv)),
      () => { if (corrente !== c) return; c.v.currentTime = 0; c.v.play(); c.preparando = null; c.para = -1; c.saindo = false; }, // sem o seguinte pronto: recomeça seco
    );
  }
}

// Tela cheia com dois cliques ou F; o cursor some quando o mouse fica parado.
const telaCheia = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
addEventListener('dblclick', telaCheia);
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f') telaCheia(); });
document.addEventListener('fullscreenchange', () => document.body.classList.toggle('cheia', !!document.fullscreenElement));
let parado = 0;
const mexeu = () => { document.body.classList.remove('ocioso'); clearTimeout(parado); parado = setTimeout(() => document.body.classList.add('ocioso'), 1500); };
addEventListener('mousemove', mexeu);
mexeu();

// Impede a tela de apagar no meio da sessão (o pedido cai quando a janela some; refaz ao voltar).
let trava = null;
const travar = () => { if (document.visibilityState === 'visible' && !trava) navigator.wakeLock?.request('screen').then((t) => { trava = t; t.addEventListener('release', () => { trava = null; }); }).catch(() => {}); };
document.addEventListener('visibilitychange', travar);
travar();

let pronto = false;
try {
  const resp = await fetch(PASTA + 'fundos.json');
  if (!resp.ok) throw new Error('sem ' + PASTA + 'fundos.json');
  fundos = (await resp.json()).fundos ?? [];
  if (!fundos.length) throw new Error('lista vazia');
  // Os vídeos vão inteiros para a memória: a troca começa na hora e o salto para "repetirDe" funciona
  // mesmo com o servidor simples (servidor.py), que não entrega pedaços de arquivo.
  urls = await Promise.all(fundos.map(async (f) => {
    const r = await fetch(PASTA + f.arquivo);
    if (!r.ok) throw new Error('não achei ' + PASTA + f.arquivo);
    return URL.createObjectURL(await r.blob());
  }));
  pronto = true;
} catch (e) {
  // sem vídeos (ou sem a lista): a página fica só com a explicação, sem erro solto
  aviso.textContent = 'Os vídeos de fundo não abriram (' + e.message + '). Veja "Vídeo de fundo no projetor" no README.';
}
if (pronto) {
  aviso.innerHTML = 'Arraste esta janela para o projetor e dê <b>dois cliques</b> nela (ou aperte <b>F</b>) para a tela cheia.';
  setInterval(avisar, 2000);
  requestAnimationFrame(vigiar);
  trocar(fundos[inicial] ? inicial : 0);
  avisar({ novo: 1 }); // o mestre responde com os quadradinhos marcados
}
