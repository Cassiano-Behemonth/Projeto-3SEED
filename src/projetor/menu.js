// Menu "Fundo" do mestre: escolhe o vídeo que passa na janela do projetor (projetor.html, src/projetor/projetor.js).
// A lista vem de assets/videos/fundos.json; sem esse arquivo, o botão nem aparece.
// O primeiro da lista é o fundo de base e repete sempre. Cada um dos outros tem um quadradinho "repete":
// desmarcado, o vídeo passa uma vez e a janela volta sozinha para o de base; marcado, fica repetindo até a troca.
const $ = (s) => document.querySelector(s);
const GUARDA = '3seed-fundo-repetir'; // os marcados ficam guardados neste navegador, pelo nome do arquivo

function lerMarcados() {
  try { const v = JSON.parse(localStorage.getItem(GUARDA)); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function iniciarMenuFundo() {
  const resp = await fetch('assets/videos/fundos.json').catch(() => null);
  if (!resp?.ok || !('BroadcastChannel' in window)) return;
  const fundos = (await resp.json().catch(() => ({}))).fundos ?? [];
  if (!fundos.length) return;

  const canal = new BroadcastChannel('3seed-projetor');
  const btn = $('#btnFundo'), painel = $('#painelFundo'), estado = $('#estadoProjetor'), abrir = $('#btnAbrirProjetor');
  let escolhido = 0, vivoAte = 0;
  const aberta = () => performance.now() < vivoAte;
  const marcados = new Set(lerMarcados());
  const repetir = () => fundos.map((f) => marcados.has(f.arquivo));
  const enviar = (msg = {}) => canal.postMessage({ ...msg, repetir: repetir() });

  // Com a janela fechada, escolher um fundo abre a janela já nele; aberta, só troca.
  const abrirJanela = () => window.open(`projetor.html?fundo=${escolhido}&repetir=${repetir().map(Number).join(',')}`, 'projetor-3seed', 'popup,width=1280,height=720');
  const lista = $('#listaFundos');
  const cabecalho = document.createElement('span');
  cabecalho.className = 'cabecalho';
  cabecalho.textContent = 'repete';
  lista.replaceChildren(document.createElement('span'), cabecalho);
  const botoes = fundos.map((f, i) => {
    const b = document.createElement('button');
    b.className = 'fundo';
    b.textContent = f.nome;
    b.addEventListener('click', () => {
      escolhido = i;
      if (aberta()) enviar({ fundo: i }); else abrirJanela();
      desenhar();
    });
    let caixa = document.createElement('span'); // o de base não tem quadradinho: repete sempre
    if (i > 0) {
      caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.className = 'repete';
      caixa.checked = marcados.has(f.arquivo);
      caixa.title = `Marcado: "${f.nome}" fica repetindo. Desmarcado: passa uma vez e volta para "${fundos[0].nome}".`;
      caixa.addEventListener('change', () => {
        if (caixa.checked) marcados.add(f.arquivo); else marcados.delete(f.arquivo);
        try { localStorage.setItem(GUARDA, JSON.stringify([...marcados])); } catch { /* sem armazenamento: vale só nesta sessão */ }
        enviar();
        caixa.blur(); // devolve o teclado (WASD etc.) para o mapa
      });
    }
    lista.append(b, caixa);
    return b;
  });
  $('#dicaRepete').textContent = `Desmarcado, o vídeo passa uma vez e volta sozinho para "${fundos[0].nome}". Marcado, fica repetindo até você trocar.`;
  abrir.addEventListener('click', abrirJanela);

  function desenhar() {
    botoes.forEach((b, i) => b.classList.toggle('ativo', i === escolhido));
    estado.textContent = aberta()
      ? 'A janela do projetor está aberta. Clique num fundo para trocar.'
      : 'Clique num fundo para abrir a janela do projetor. Arraste-a para o projetor e dê dois cliques nela para a tela cheia.';
    abrir.hidden = aberta();
  }

  // A janela do projetor avisa a cada 2 s o fundo que está passando; sem aviso por 5 s, conta como fechada.
  canal.onmessage = (ev) => {
    const d = ev.data ?? {};
    if (!('projetor' in d)) return;
    if (d.novo) enviar(); // janela recém-aberta ou recarregada: manda os quadradinhos
    if (d.projetor === null) vivoAte = 0;
    else { vivoAte = performance.now() + 5000; if (d.projetor >= 0) escolhido = d.projetor; }
    desenhar();
  };
  enviar({ pedir: 1 }); // se o mestre recarregou a página, a janela do projetor continua e responde
  setInterval(desenhar, 2500);

  // Um painel do lado direito de cada vez: quem abre avisa ("painel-aberto", ver ui.js) e os outros fecham.
  btn.addEventListener('click', () => {
    const abre = !painel.classList.contains('aberto');
    painel.classList.toggle('aberto', abre);
    btn.classList.toggle('ativo', abre);
    if (abre) document.dispatchEvent(new CustomEvent('painel-aberto', { detail: 'fundo' }));
  });
  document.addEventListener('painel-aberto', (e) => { if (e.detail !== 'fundo') { painel.classList.remove('aberto'); btn.classList.remove('ativo'); } });

  btn.hidden = false;
  desenhar();
}
