// Confere as criaturas, os personagens e os objetos da campanha (src/campanha.js): o que faria uma figura não aparecer,
// sair esticada ou o painel quebrar. Usado por conferir.html (e, por ela, por ferramentas/validar_campanha.py).
// Devolve { erros, avisos }: erro é o que quebra; aviso é provável engano.

const CAMPOS = new Set(['id', 'nome', 'grupo', 'altura', 'real', 'ganho', 'lanterna', 'lanternaFrente', 'arquivo', 'quadros', 'vistas', 'poses', 'fixo', 'poseAndar', 'volume', 'leva']);
const CAMPOS_VOLUME = new Set(['comp', 'larg', 'alt', 'atlas', 'F', 'S', 'B', 'T', 'fatias', 'redondo', 'plano', 'cruzado']);
const CAMPOS_QUADRO = new Set(['arquivo', 'w', 'h', 'alt', 'respira', 'lu', 'lv']);   // lu, lv: onde fica a lanterna no quadro
const CAMPOS_ANDAR = new Set(['frente', 'costas', 'parado', 'diagonais']);
const VISTAS_GIRO = ['frente', 'tqFrente', 'perfil', 'tqCostas', 'costas'];
const DIAGONAIS = ['diagFrenteD', 'diagFrenteE', 'diagCostasD', 'diagCostasE'];

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const existe = (url) => fetch(url, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false);
const tamanhoImagem = (url) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = url; });

// base: o caminho até a raiz do projeto, visto da página que chama (conferir.html está na raiz: '').
export async function conferirCampanha({ PERSONAGENS = [], MONSTROS = [] } = {}, { base = '', mapas = [] } = {}) {
  const erros = [], avisos = [];
  const todos = [...PERSONAGENS.map((d) => ['PERSONAGENS', d]), ...MONSTROS.map((d) => ['MONSTROS', d])];
  const ids = new Map(), grupos = new Set();
  for (const [, d] of todos) if (d && typeof d.grupo === 'string') grupos.add(d.grupo);
  const imagens = new Map();   // cada imagem é lida uma vez só
  const imagem = (arq) => { if (!imagens.has(arq)) imagens.set(arq, tamanhoImagem(base + arq)); return imagens.get(arq); };

  for (const [lista, d] of todos) {
    if (!d || typeof d !== 'object') { erros.push(`${lista}: há um item que não é um objeto { id, nome, ... }`); continue; }
    const quem = `"${d.id ?? d.nome ?? '?'}"`;
    if (typeof d.id !== 'string' || !d.id) { erros.push(`${lista}: criatura sem "id" (${d.nome ?? 'sem nome'})`); continue; }
    if (!/^[a-zA-Z0-9_-]+$/.test(d.id)) avisos.push(`${quem}: o id deve ter só letras, números, _ e - (sem espaço nem acento)`);
    if (ids.has(d.id)) erros.push(`${quem}: há duas criaturas com esse id (em ${ids.get(d.id)} e em ${lista}); só uma funciona`);
    ids.set(d.id, lista);
    if (!d.nome) avisos.push(`${quem}: sem "nome", o botão do painel fica vazio`);
    for (const k of Object.keys(d)) if (!CAMPOS.has(k)) avisos.push(`${quem}: campo desconhecido "${k}" (não faz nada; será erro de digitação?)`);
    for (const k of ['altura', 'real']) {
      if (d[k] === undefined) continue;
      if (!num(d[k]) || d[k] <= 0) erros.push(`${quem}: "${k}" deve ser um número de metros maior que zero`);
      else if (d[k] > 40) avisos.push(`${quem}: "${k}" = ${d[k]} m parece demais`);
    }
    if (d.real === undefined && d.altura === undefined) avisos.push(`${quem}: sem "real" nem "altura", a figura nasce com o tamanho padrão`);
    if (d.ganho !== undefined && (!num(d.ganho) || d.ganho <= 0)) erros.push(`${quem}: "ganho" deve ser um número maior que zero (1 = como está)`);
    if (d.grupo !== undefined && typeof d.grupo !== 'string') erros.push(`${quem}: "grupo" deve ser um texto (o título da seção no painel)`);
    const tipos = ['arquivo', 'quadros', 'vistas', 'volume'].filter((k) => d[k] !== undefined);
    if (!tipos.length) { erros.push(`${quem}: falta o que mostrar: "arquivo" (vídeo), "quadros" ou "vistas" (imagens) ou "volume" (objeto 3D)`); continue; }
    if (tipos.length > 1 && !(tipos.length === 2 && tipos.includes('quadros') && tipos.includes('vistas'))) avisos.push(`${quem}: tem ${tipos.join(' e ')}; o programa usa só um (volume, depois vistas ou quadros, depois o vídeo)`);

    // Vídeo
    if (d.arquivo !== undefined && !d.volume && !d.vistas && !d.quadros) {
      if (typeof d.arquivo !== 'string') erros.push(`${quem}: "arquivo" deve ser o nome do vídeo em assets/monstros/`);
      else {
        if (!(await existe(`${base}assets/monstros/${encodeURIComponent(d.arquivo)}`))) erros.push(`${quem}: o vídeo assets/monstros/${d.arquivo} não existe`);
        if (!/\.webm$/i.test(d.arquivo)) avisos.push(`${quem}: "${d.arquivo}" não é WebM; sem transparência, o fundo do vídeo aparece em volta da criatura (veja a seção 7 do README)`);
      }
    }

    // Figuras (quadros ou vistas)
    const tabela = d.volume ? null : (d.vistas ?? d.quadros);
    if (tabela !== null && tabela !== undefined) {
      if (typeof tabela !== 'object' || Array.isArray(tabela) || !Object.keys(tabela).length) erros.push(`${quem}: "${d.vistas ? 'vistas' : 'quadros'}" deve ser { pose: { arquivo, w, h, alt }, ... }`);
      else {
        for (const [pose, q] of Object.entries(tabela)) {
          const onde = `${quem}, pose "${pose}"`;
          if (!q || typeof q !== 'object') { erros.push(`${onde}: deve ser { arquivo, w, h, alt }`); continue; }
          for (const k of Object.keys(q)) if (!CAMPOS_QUADRO.has(k)) avisos.push(`${onde}: campo desconhecido "${k}"`);
          if (!num(q.alt) || q.alt <= 0) erros.push(`${onde}: falta "alt" (a altura desta pose em relação à primeira; 1 para a primeira); sem ele a figura some`);
          if (!num(q.w) || !num(q.h) || q.w <= 0 || q.h <= 0) erros.push(`${onde}: "w" e "h" devem ser a largura e a altura da imagem em pixels`);
          for (const k of ['lu', 'lv']) if (q[k] !== undefined && (!num(q[k]) || q[k] < 0 || q[k] > 1)) avisos.push(`${onde}: "${k}" é uma fração do quadro, de 0 a 1`);
          if ((d.lanterna || d.lanternaFrente) && (q.lu === undefined) !== (q.lv === undefined)) avisos.push(`${onde}: tem só um de "lu" e "lv"; a lanterna precisa dos dois`);
          if (typeof q.arquivo !== 'string') { erros.push(`${onde}: falta "arquivo" (o caminho da imagem)`); continue; }
          const t = await imagem(q.arquivo);
          if (!t) erros.push(`${onde}: a imagem ${q.arquivo} não existe ou não abre`);
          else if (num(q.w) && num(q.h) && (Math.abs(t[0] - q.w) > 2 || Math.abs(t[1] - q.h) > 2)) avisos.push(`${onde}: a imagem tem ${t[0]} x ${t[1]} px e o quadro diz ${q.w} x ${q.h}; a figura sai esticada (copie as medidas que figuras.py imprime)`);
        }
        if (d.vistas && !d.fixo) {
          const faltam = VISTAS_GIRO.filter((k) => !tabela[k]);
          if (faltam.length) erros.push(`${quem}: personagem que vira com a câmera precisa das vistas ${VISTAS_GIRO.join(', ')}; faltam ${faltam.join(', ')} (ou ponha "fixo: true")`);
        }
        if (d.poses !== undefined) {
          if (!Array.isArray(d.poses)) erros.push(`${quem}: "poses" deve ser uma lista de pares: [['parado', 'Parado'], ...]`);
          else for (const p of d.poses) {
            if (!Array.isArray(p) || typeof p[0] !== 'string') { erros.push(`${quem}: cada item de "poses" é um par ['nome', 'Rótulo']`); continue; }
            if (!tabela[p[0]] && !(p[0] === 'parado' && d.vistas && !d.fixo)) erros.push(`${quem}: a pose "${p[0]}" está em "poses" mas não há quadro com esse nome`);
          }
        }
        if (d.poseAndar !== undefined) {
          const pa = d.poseAndar;
          if (!pa || typeof pa !== 'object') erros.push(`${quem}: "poseAndar" deve ser { frente, costas, parado }`);
          else {
            for (const k of Object.keys(pa)) if (!CAMPOS_ANDAR.has(k)) avisos.push(`${quem}: "poseAndar" tem o campo desconhecido "${k}"`);
            for (const k of ['frente', 'costas', 'parado']) if (pa[k] !== undefined && !tabela[pa[k]]) erros.push(`${quem}: "poseAndar.${k}" é "${pa[k]}", mas não há quadro com esse nome`);
            if (pa.diagonais) { const f = DIAGONAIS.filter((k) => !tabela[k]); if (f.length) erros.push(`${quem}: "poseAndar.diagonais" pede os quadros ${DIAGONAIS.join(', ')}; faltam ${f.join(', ')}`); }
          }
        }
        if (!d.fixo && d.quadros && !d.vistas) avisos.push(`${quem}: tem "quadros" sem "fixo: true"; quadros são poses fixas (ponha "fixo: true"), vistas são as que viram com a câmera`);
      }
    }

    // Objeto 3D
    if (d.volume !== undefined) {
      const v = d.volume;
      if (!v || typeof v !== 'object') erros.push(`${quem}: "volume" deve ser { comp, larg, alt, atlas, F, S, B, T }`);
      else {
        for (const k of Object.keys(v)) if (!CAMPOS_VOLUME.has(k)) avisos.push(`${quem}: "volume" tem o campo desconhecido "${k}"`);
        for (const k of ['comp', 'larg', 'alt']) if (!num(v[k]) || v[k] <= 0) erros.push(`${quem}: "volume.${k}" deve ser um número de metros maior que zero`);
        if (v.redondo !== undefined && (!num(v.redondo) || v.redondo < 0 || v.redondo > 1)) avisos.push(`${quem}: "volume.redondo" vai de 0 (cantos retos) a 1`);
        const t = typeof v.atlas === 'string' ? await imagem(v.atlas) : null;
        if (typeof v.atlas !== 'string') erros.push(`${quem}: falta "volume.atlas" (a imagem que objeto.py grava)`);
        else if (!t) erros.push(`${quem}: o atlas ${v.atlas} não existe ou não abre`);
        for (const k of ['F', 'S', 'B', 'T']) {
          const r = v[k];
          if (!(Array.isArray(r) && r.length === 4 && r.every(num) && r[2] > r[0] && r[3] > r[1])) { erros.push(`${quem}: "volume.${k}" deve ser [x0, y0, x1, y1] (copie o que objeto.py imprime)`); continue; }
          if (t && (r[0] < 0 || r[1] < 0 || r[2] > t[0] || r[3] > t[1])) erros.push(`${quem}: "volume.${k}" ${JSON.stringify(r)} sai do atlas (${t[0]} x ${t[1]} px)`);
        }
        if (Array.isArray(v.S) && Array.isArray(v.T) && v.S.length === 4 && v.T.length === 4) {
          const ws = v.S[2] - v.S[0], wt = v.T[2] - v.T[0];
          if (Math.abs(ws - wt) > 0.02 * ws) avisos.push(`${quem}: a vista de cima (T) tem ${wt} px de comprimento e a lateral (S) ${ws}; o objeto sai torto (monte o atlas com objeto.py)`);
        }
      }
    }
  }

  // Veículos: quem eles levam existe?
  for (const [, d] of todos) {
    if (!d || d.leva === undefined) continue;
    const quem = `"${d.id}"`;
    if (Array.isArray(d.leva)) { for (const id of d.leva) if (!ids.has(id)) erros.push(`${quem}: "leva" cita "${id}", que não existe`); }
    else if (typeof d.leva === 'string') { if (!grupos.has(d.leva)) erros.push(`${quem}: "leva" é "${d.leva}", mas nenhuma criatura tem esse "grupo"`); }
    else erros.push(`${quem}: "leva" deve ser uma lista de ids ou o nome de um grupo`);
  }
  // Mapas que limitam o painel ("criaturas"): os ids existem?
  for (const m of mapas) for (const id of m.criaturas ?? []) if (!ids.has(id)) avisos.push(`mapa "${m.id}": "criaturas" cita "${id}", que não existe na campanha`);
  return { erros, avisos, total: todos.length };
}
