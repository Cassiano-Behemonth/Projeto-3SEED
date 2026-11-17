// Registro dos interiores. Cada um é um mapa próprio: fica numa origem separada e só aparece quando se entra nele.
// Há dois tipos: os escritos em código (abaixo) e os descritos em arquivo, listados em mapas/indice.json
// (formato em GUIA_DE_MAPAS.md). "local" liga o interior a um local da cidade; sem "local", o mapa aparece na lista "Mapas".
import { criarDeDados, metaDeDados } from './dados.js';

// Ampliação de todos os interiores (piso, paredes, móveis, luzes, câmeras). As criaturas não ampliam,
// então quanto maior este número, mais espaçosos os cômodos ficam em relação a elas e à câmera.
export const AMPLIACAO = 2.2;

// Os interiores escritos em código (os da campanha) entram aqui antes dos mapas em arquivo (ver main.js).
export const INTERIORES = [];

// Lê os mapas em arquivo e os acrescenta ao registro. Um mapa com erro é pulado, com aviso, sem derrubar os outros.
// mapas/indice.json lista os mapas que vêm com o programa; mapas/indice_local.json (opcional, fora do git) lista os seus.
// soEste: carrega só esse mapa e os que se alcançam a partir dele pelas passagens (a página inicial abre um mapa assim).
export async function carregarMapasEmArquivo(soEste = null) {
  let nomes = [];
  for (const indice of ['mapas/indice.json', 'mapas/indice_local.json']) {
    try {
      const r = await fetch(indice, { cache: 'no-store' });
      if (r.ok) nomes.push(...((await r.json()).mapas ?? []));
      else if (indice === 'mapas/indice.json') console.warn('Não foi possível ler mapas/indice.json');
    } catch (e) { if (indice === 'mapas/indice.json') console.warn('Não foi possível ler mapas/indice.json:', e); }
  }
  nomes = [...new Set(nomes)];
  const lidos = new Map();
  const ler = async (nome) => {
    if (!lidos.has(nome)) {
      const resp = await fetch('mapas/' + nome, { cache: 'no-store' });
      if (!resp.ok) throw new Error('arquivo não encontrado em mapas/');
      lidos.set(nome, await resp.json());
    }
    return lidos.get(nome);
  };
  if (soEste) {
    const fila = [soEste], vistos = new Set(), escolhidos = [];
    while (fila.length) {
      const id = fila.shift();
      if (vistos.has(id)) continue;
      vistos.add(id);
      const nome = nomes.find((x) => x.replace(/\.json$/, '') === id) ?? `${id}.json`;
      try { const d = await ler(nome); escolhidos.push(nome); for (const p of d.passagens ?? []) if (p.destino?.mapa) fila.push(p.destino.mapa); }
      catch (e) { console.warn(`Mapa "${id}" não encontrado.`); }
    }
    nomes = escolhidos;
  }
  let n = 0;
  for (const nome of nomes) {
    try {
      const d = await ler(nome);
      for (const campo of ['id', 'imagem', 'larguraPx', 'alturaPx', 'escala']) if (d[campo] == null) throw new Error(`falta o campo "${campo}"`);
      if (INTERIORES.some((x) => x.id === d.id)) throw new Error(`já existe um mapa com o id "${d.id}"`);
      INTERIORES.push({ id: d.id, local: d.local ?? null, nome: d.nome ?? d.id, origem: [n++ * 600, 0, 5200], criar: criarDeDados(d), ...metaDeDados(d), dados: d });
    } catch (e) { console.warn(`Mapa "${nome}" ignorado:`, e.message ?? e); }
  }
}
