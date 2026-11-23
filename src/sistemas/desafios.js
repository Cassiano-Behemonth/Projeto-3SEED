// Desafios dos mapas: uma cabana para montar, uma fogueira para acender. Cada desafio tem as peças de "antes" (a lona
// enrolada, a lenha apagada) e as de "depois" (a barraca montada, o fogo, a luz); o mestre marca como feito e o mapa
// troca uma pela outra. As peças em folha (a barraca) sobem do chão; as luzes acendem aos poucos. Tudo começa por fazer.
// A segunda tela recebe o estado pelo retrato (estado/espelhar) e anima do mesmo jeito.
// O formato (campos "desafio", "fase" e "desafios") está em GUIA_DE_MAPAS.md; a montagem dos grupos, em Planta.desafio.
const SOBE = 1.8; // segundos da barraca subindo (ou descendo)
const LUZ = 1.2; // segundos da luz acendendo (ou apagando)
const RENTE = 0.02; // altura (fração) de uma barraca deitada no chão
const suave = (t) => t * t * (3 - 2 * t);

// Mostra ou esconde grupos de peças. Escondida, a peça também deixa de ser chão (ver Fisica._altura e Monstros._chao).
function mostrar(grupos, v) {
  for (const g of grupos) { g.visible = v; g.traverse((o) => { o.userData.oculto = !v; }); }
}

export class Desafios {
  constructor(mundo) {
    this.mundo = mundo;
    this.subindo = new Map(); // desafio -> animação das folhas
    this.luzes = new Map(); // registro da luz -> animação do fator k
    this.aoMudar = null;
    for (const x of Object.values(mundo.interiores)) for (const d of x.desafios ?? []) { d.feito = false; this._aplicar(d, true); }
  }
  lista(id) { return this.mundo.interiores[id]?.desafios ?? []; }
  marcar(id, nome, feito) {
    const d = this.lista(id).find((x) => x.nome === nome);
    if (!d || d.feito === feito) return;
    d.feito = feito; this._aplicar(d, false); this.aoMudar?.();
  }
  todos(id, feito) { for (const d of this.lista(id)) this.marcar(id, d.nome, feito); }
  // Para a segunda tela: um caractere por desafio, na ordem da lista.
  estado(id) { return this.lista(id).map((d) => (d.feito ? '1' : '0')).join(''); }
  espelhar(id, s) {
    this.lista(id).forEach((d, i) => { const v = s[i] === '1'; if (d.feito !== v) { d.feito = v; this._aplicar(d, false); } });
  }

  _aplicar(d, imediato) {
    const feito = d.feito;
    // Colisão: a barraca montada barra quem anda; desmontada, não.
    for (const m of d.muros.depois) m.inativo = !feito;
    for (const m of d.muros.antes) m.inativo = feito;
    for (const l of d.luzes.depois) this._luz(l, feito ? 1 : 0, imediato);
    for (const l of d.luzes.antes) this._luz(l, feito ? 0 : 1, imediato);
    const folhas = [];
    for (const g of d.depois) g.traverse((o) => { if (o.userData.folha) folhas.push(o); });
    if (imediato || !folhas.length) {
      this.subindo.delete(d);
      mostrar(d.antes, !feito); mostrar(d.depois, feito);
      for (const f of folhas) f.scale.y = 1;
      return;
    }
    // Montar: o material some e a barraca sobe do chão. Desmontar: ela desce e, no fim, o material volta.
    const atual = this.subindo.get(d);
    if (feito) {
      if (!atual) for (const f of folhas) f.scale.y = RENTE;
      mostrar(d.antes, false); mostrar(d.depois, true);
    }
    this.subindo.set(d, {
      folhas, t: 0, de: folhas[0].scale.y, para: feito ? 1 : RENTE,
      fim: feito ? null : () => { mostrar(d.depois, false); mostrar(d.antes, true); for (const f of folhas) f.scale.y = 1; },
    });
  }
  _luz(l, alvo, imediato) {
    if (imediato) { this.luzes.delete(l); l.k = alvo; this.mundo.pocaDe?.(l); return; }
    this.luzes.set(l, { t: 0, de: l.k ?? 1, para: alvo });
  }

  atualizar(dt) {
    for (const [d, a] of this.subindo) {
      a.t = Math.min(1, a.t + dt / SOBE);
      const y = a.de + (a.para - a.de) * suave(a.t);
      for (const f of a.folhas) f.scale.y = y;
      if (a.t >= 1) { this.subindo.delete(d); a.fim?.(); }
    }
    for (const [l, a] of this.luzes) {
      a.t = Math.min(1, a.t + dt / LUZ);
      l.k = a.de + (a.para - a.de) * suave(a.t);
      this.mundo.pocaDe?.(l);
      if (a.t >= 1) this.luzes.delete(l);
    }
  }
}
