// Mapas descritos em arquivo (JSON), em vez de código. O formato está explicado em GUIA_DE_MAPAS.md.
// Todas as posições são em pixels da imagem da planta; "escala" diz quantos metros vale um pixel.
import * as THREE from 'three';
import { Planta } from './planta.js';
import * as K from './kit.js';
import * as KX from './kit_externo.js';
import { paredesDe, contornoDe, alturaDoPiso } from './formato.js';
import { registrarTextura } from './acabamentos.js';

// Móveis que um mapa pode usar no campo "moveis" (o nome é o "tipo").
export const KIT = {
  cama: K.cama, vaso: K.vaso, pia: K.pia, mesa: K.mesa, mesaRedonda: K.mesaRedonda, cadeira: K.cadeira, banqueta: K.banqueta,
  sofa: K.sofa, balcao: K.balcao, estante: K.estante, sinuca: K.sinuca, jukebox: K.jukebox, caixote: K.caixote, maca: K.maca,
  rackArmas: K.rackArmas, vela: K.vela, barril: K.barril, lareira: K.lareira, banheira: K.banheira, castical: K.castical,
  alcapao: K.alcapao, caixa: K.caixa, cilindro: K.cilindro, sarcofago: K.sarcofago, ossario: K.ossario,
  mastro: KX.mastro, canhao: KX.canhao, timao: KX.timao, gurupes: KX.gurupes, bote: KX.bote,
  rocha: KX.rocha, pedra: KX.pedra, arvore: KX.arvore, pinheiro: KX.pinheiro, palmeira: KX.palmeira, arbusto: KX.arbusto,
  casa: KX.casa, torreAndares: KX.torreAndares, torii: KX.torii, ponte: KX.ponte, poste: KX.poste, tenda: KX.tenda, fogueira: KX.fogueira, barracaDesmontada: KX.barracaDesmontada, cerca: KX.cerca,
  portao: KX.portao, radar: KX.radar, chafariz: KX.chafariz, banco: KX.banco, transformador: KX.transformador, portico: KX.portico, cabo: KX.cabo,
  container: KX.container, domo: KX.domo, parabolica: KX.parabolica, torreTrelica: KX.torreTrelica, veiculo: KX.veiculo, guindaste: KX.guindaste,
};
// Árvores: vão em lotes e colidem pelo tronco (ver Planta.arvore).
const MATA = new Set(['arvore', 'pinheiro', 'palmeira']);

// Devolve a função que constrói o interior a partir dos dados.
export function criarDeDados(d) {
  return (c) => {
    // Texturas do próprio mapa (quadros de um atlas), usadas como acabamento pelo nome.
    for (const [nome, t] of Object.entries(d.texturas ?? {})) if (t?.imagem) registrarTextura(nome, t);
    const P = new Planta(c.M, { imagem: d.imagem, imagemNoite: d.imagemNoite ?? null, larguraPx: d.larguraPx, alturaPx: d.alturaPx, escala: d.escala, parede: d.acabamento ?? null, topo: d.corTopo ?? (d.ceuAberto ? 'parede' : '#0b0b0c'), alturaMax: d.teto ? undefined : 14 });
    P.luar = d.luar ?? 1; // noite mais escura: as fachadas pintadas também brilham menos
    if (d.brilho > 0) P.brilho = d.brilho;
    if (d.imagemPredios) P.imagemPredios = d.imagemPredios;
    if (d.moldura) P.moldura(...d.moldura);
    if (d.corEntorno) P.entorno(d.corEntorno);
    if (d.teto) P.teto(new THREE.Color(d.teto.cor ?? '#2b1f16').getHex(), { vigas: !!d.teto.vigas, area: Array.isArray(d.teto.area) && d.teto.area.length === 4 ? d.teto.area : null });
    // Parede: [x1, y1, x2, y2] ou { p: [...], esp, cor, acabamento }.
    // Pisos elevados (convés, cais, palco). O que estiver dentro do contorno sobe junto: paredes, móveis, luzes, câmeras.
    const piso = (x, y) => alturaDoPiso(d, x, y);
    const quemBalanca = (d.plataformas ?? []).find((pl) => pl.balanco && contornoDe(pl));
    if (quemBalanca) P.definirBalanco(contornoDe(quemBalanca));
    if (d.agua) P.agua(d.agua);
    if (d.clima === 'neve' || d.clima === 'petalas') P.clima(d.clima);
    for (const pl of d.plataformas ?? []) P.plataforma(contornoDe(pl), pl.altura, { cor: pl.cor ?? '#4a3524', afunila: pl.afunila ?? 1, mureta: pl.mureta ?? 0, corMureta: pl.corMureta ?? null, espMureta: pl.espMureta ?? 0.16, encosta: !!pl.encosta, ...(pl.fundo ? { fundo: pl.fundo } : {}) });
    for (const pr of d.predios ?? []) if (Array.isArray(pr.area) && pr.area.length === 4) {
      const fachada = pr.fachada ?? 0, estilo = pr.acabamento ?? d.acabamentoPredios ?? null;
      P.predio(pr.area, pr.altura ?? 3, { telhado: pr.telhado ?? 'duas-aguas', ht: pr.ht ?? null, cor: pr.cor ?? (estilo ? '#ffffff' : '#6b5a48'), janelas: pr.janelas !== false, porta: pr.porta !== false, estilo, beiral: pr.beiral ?? 0.25, fachada, frente: pr.frente ?? 'pintada', silhueta: pr.silhueta ?? null, fatorAltura: pr.fatorAltura ?? 0.72, corTelhado: pr.corTelhado ?? null, estiloTelhado: pr.telhadoAcabamento ?? null, base: piso((pr.area[0] + pr.area[2]) / 2, (pr.area[1] + pr.area[3]) / 2 + fachada) });
    }
    for (const q of d.decalques ?? []) P.decalque(q);
    for (const pz of d.pisos ?? []) { const c = contornoDe(pz); if (c) { const cx = c.reduce((s, p) => s + p[0], 0) / c.length, cy = c.reduce((s, p) => s + p[1], 0) / c.length; P.piso(c, pz.acabamento, piso(cx, cy) + (pz.alt ?? 0.03)); } }
    // Peça de um desafio ("desafio": nome; "fase": "antes" ou, sem ela, "depois"): vai para um grupo que aparece ou
    // some quando o mestre marca o desafio como feito (uma cabana para montar, uma fogueira para acender).
    const emDesafio = (o, base, fn) => (o.desafio ? P.desafio(String(o.desafio), o.fase === 'antes' ? 'antes' : 'depois', o.x, o.y, base, fn) : fn());
    for (const f of d.folhas ?? []) { const base = piso(f.x, f.y) + (f.sobre ?? 0); emDesafio(f, base, () => P.folha({ ...f, base })); }
    for (const o of paredesDe(d)) {
      const base = piso((o.p[0] + o.p[2]) / 2, (o.p[1] + o.p[3]) / 2);
      P.parede(...o.p, { esp: o.esp ?? d.espParede ?? 0.22, cor: o.cor ?? d.corParede, altura: o.altura ?? d.alturaParede ?? null, base, balanco: P.noBalanco((o.p[0] + o.p[2]) / 2, (o.p[1] + o.p[3]) / 2), ...(o.acabamento !== undefined ? { estilo: o.acabamento } : {}) });
    }
    for (const b of d.barreiras ?? []) P.barreira(...b);
    // Grade de ferro: barras de um ponto a outro, que também barram a passagem.
    for (const [x1, y1, x2, y2] of d.grades ?? []) {
      const n = Math.max(1, Math.round((Math.hypot(x2 - x1, y2 - y1) * d.escala) / 0.16));
      for (let i = 0; i <= n; i++) P.b.cilindro(c.M.metal, 0.025, 0.025, 2.3, P.X(x1 + ((x2 - x1) * i) / n), 0, P.Z(y1 + ((y2 - y1) * i) / n), { seg: 6, cor: '#1c1a18' });
      for (const y of [0.25, 2.1]) P.b.tubo(c.M.metal, [P.X(x1), y, P.Z(y1)], [P.X(x2), y, P.Z(y2)], 0.03, 0.03, { seg: 6, cor: '#1c1a18' });
      P.barreira(x1, y1, x2, y2);
    }
    for (const [id, rets] of Object.entries(d.salas ?? {})) P.sala(id, rets);
    for (const p of d.portas ?? []) P.porta(...p.p, { revela: p.revela ?? [], sentido: p.sentido ?? 1, fixa: !!p.fixa, altura: p.altura ?? d.alturaParede ?? null, corVerga: d.corParede ?? null, textura: p.textura ?? null, alturaFolha: p.alturaFolha ?? null });
    for (const m of d.moveis ?? []) {
      const fn = KIT[m.tipo];
      if (!fn) { console.warn(`Mapa "${d.id}": móvel de tipo desconhecido "${m.tipo}"`); continue; }
      // "sobre" ergue a peça (uma antena no telhado de um prédio); soma-se à altura da plataforma onde ela está.
      const { tipo, x, y, giro, sobre, desafio, fase, ...op } = m;
      const base = piso(x, y) + (sobre ?? 0);
      // Árvores no chão vão em lotes, fora do raio do chão (ver Planta.arvore); no balanço do navio, ficam como móvel.
      // Num desafio, tudo vai como móvel, para entrar no grupo dele.
      emDesafio(m, base, () => {
        if (MATA.has(tipo) && !P.noBalanco(x, y) && !desafio) P.arvore(fn, x, y, giro ?? 0, { ...op, rng: c.rng }, base);
        else if (tipo === 'cerca' && !desafio) P.decor(fn, x, y, giro ?? 0, { ...op, rng: c.rng }, base, { comprimento: op.w ?? 10, esp: 0.3 });
        else P.m(fn, x, y, giro ?? 0, { ...op, rng: c.rng }, base);
      });
    }
    // "luzPadrao" dá os valores comuns; cada luz pode trocar os seus.
    const lp = { cor: '#ffc98a', forca: 0.15, raio: 5, altura: 2, ...(d.luzPadrao ?? {}) };
    for (const l of d.luzes ?? []) {
      const base = piso(l.x, l.y), luz = c.luz(P.X(l.x), base + (l.altura ?? lp.altura), P.Z(l.y), new THREE.Color(l.cor ?? lp.cor).getHex(), l.forca ?? lp.forca, l.raio ?? lp.raio);
      if (l.desafio) P.desafioLuz(String(l.desafio), l.fase === 'antes' ? 'antes' : 'depois', l.x, l.y, base, luz);
    }
    const r = P.construir();
    // Ordem e verbo dos desafios: os listados em "desafios" vêm primeiro, na ordem dada, com a "acao" de cada um
    // ("montar", "acender"...); os outros vêm depois, na ordem em que aparecem, com "montar".
    const defs = new Map((d.desafios ?? []).map((x, i) => [String(x.nome), { i, acao: x.acao ?? 'montar' }]));
    for (const x of r.desafios) { x.acao = defs.get(x.nome)?.acao ?? 'montar'; x.ordem = defs.get(x.nome)?.i ?? 1e6; }
    r.desafios.sort((a, b) => a.ordem - b.ordem);
    return r;
  };
}

// Câmeras, chegada, passagens e limites, calculados a partir dos dados (em metros, relativos ao centro da planta).
export function metaDeDados(d) {
  const E = d.escala, X = (px) => (px - d.larguraPx / 2) * E, Z = (py) => (py - d.alturaPx / 2) * E;
  const larg = d.larguraPx * E, prof = d.alturaPx * E;
  const aPe = (de, para) => {
    const dx = X(para[0]) - X(de[0]), dz = Z(para[1]) - Z(de[1]), n = Math.hypot(dx, dz) || 1;
    const ch = alturaDoPiso(d, de[0], de[1]);
    return { pos: [X(de[0]), ch + 1.75, Z(de[1])], alvo: [X(de[0]) + (dx / n) * 0.7, ch + 1.68, Z(de[1]) + (dz / n) * 0.7] };
  };
  const cameras = [
    // Alta o bastante para a planta inteira caber na tela.
    { nome: 'Planta', pos: [0, Math.max(larg * 0.7, prof * 1.4), prof * 0.36], alvo: [0, 0, prof * 0.02] },
    ...(d.cameras ?? []).map((cm) => ({ nome: cm.nome, pos: [X(cm.de[0]), alturaDoPiso(d, cm.de[0], cm.de[1]) + (cm.altura ?? 1.9), Z(cm.de[1])], alvo: [X(cm.para[0]), alturaDoPiso(d, cm.para[0], cm.para[1]) + (cm.alturaAlvo ?? 1.2), Z(cm.para[1])] })),
  ];
  const hotspots = (d.passagens ?? []).map((p) => {
    const dst = p.destino ?? {};
    return {
      pos: [X(p.x), alturaDoPiso(d, p.x, p.y) + (p.altura ?? 1.2), Z(p.y)], nome: p.nome ?? 'Passagem', anim: p.anim ?? 'corte',
      destino: dst.mapa ? { interior: dst.mapa, ...(dst.vista ? { vista: dst.vista } : {}), ...(dst.camera != null ? { camera: dst.camera } : {}) } : { local: dst.local ?? 'cidade', camera: dst.camera ?? 0 },
    };
  });
  return { cameras, hotspots, chegada: d.chegada ? aPe(d.chegada.de, d.chegada.para) : cameras[1] ?? cameras[0], limites: [larg / 2 + 2, prof / 2 + 2], aberto: !!d.ceuAberto, hora: d.hora ?? null, luar: d.luar ?? 1, lua: d.lua ?? null };
}
