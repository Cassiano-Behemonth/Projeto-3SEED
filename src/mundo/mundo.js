// Monta o mundo: os mapas (interiores e lugares a céu aberto) e, se a campanha estiver presente (src/campanha.js),
// a cidade dela. Sem a campanha, o programa é só a semente: abre direto nos mapas em arquivo.
import { semente } from '../util/construtor.js';
import { criarMateriais } from './materiais.js';
import { criarPocasDeLuz } from './pocas.js';
import { INTERIORES, AMPLIACAO } from './interiores/index.js';

export function criarMundo(cena, campanha = null) {
  const rng = semente(20261112);
  const M = criarMateriais(rng);
  // arvores/luzes são coletadas por todos e viram malhas instanciadas no fim.
  const mundo = { M, arvores: [], luzes: [], animacoes: [], opacidadesNoturnas: [], soNoite: [], solidos: [], locais: {} };
  const temCidade = !!campanha?.montarCidade;
  const exterior = temCidade ? campanha.montarCidade(cena, mundo, M, rng) : [];

  // Interiores: ficam longe da cidade, cada um na sua origem; a câmera salta para lá ao entrar.
  mundo.interiores = {};
  for (const it of INTERIORES) {
    const [ox, oy, oz] = it.origem, k = AMPLIACAO;
    const c = {
      M, rng, mundo,
      arvore: () => {},
      // As luzes acompanham a ampliação: mais longe e mais fortes, para iluminar igual.
      luz: (x, y, z, cor = 0xffc98a, forca = 0.15, raio = 5, alcance = 14) => mundo.luzes.push({ x: ox + x * k, y: oy + y * k, z: oz + z * k, cor, forca: forca * k ** 1.7, raio: raio * k, alcance: alcance * k, poca: 0.7, chao: oy + 0.04 }),
      anim: (fn) => mundo.animacoes.push(fn),
    };
    const { grupo, paredes, animar, portas, salas, muros, teto, matPiso, balanco } = it.criar(c);
    if (animar) mundo.animacoes.push(animar);
    grupo.position.set(ox, oy, oz);
    grupo.scale.setScalar(k);
    grupo.name = 'interior-' + it.id;
    cena.add(grupo);
    mundo.solidos.push(grupo);
    grupo.visible = false; // cada interior é um mapa próprio: só aparece quando se está nele
    mundo.interiores[it.id] = { grupo, paredes, portas, salas, muros, teto, matPiso, origem: it.origem, aberto: !!it.aberto, balanco: !!balanco };
  }

  if (campanha?.criarArvores) { const arvores = campanha.criarArvores(mundo, M, rng); cena.add(arvores); exterior.push(arvores); }
  cena.add(criarPocasDeLuz(mundo));
  // Tudo que pertence ao mapa da cidade (some quando se entra num interior).
  mundo.exterior = exterior;
  mundo.mapaAtual = temCidade ? 'cidade' : null;
  return mundo;
}
