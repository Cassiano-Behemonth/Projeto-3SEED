// Colisão dentro dos interiores: criaturas e câmera não atravessam paredes nem portas fechadas,
// e criaturas também não atravessam móveis (mas sobem degraus, como os da escadaria).
import * as THREE from 'three';

function distanciaAoSegmento(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, c2 = dx * dx + dz * dz;
  const t = c2 ? Math.min(1, Math.max(0, ((px - s.ax) * dx + (pz - s.az) * dz) / c2)) : 0;
  return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}

export class Fisica {
  constructor(mundo, escala) {
    this.mundo = mundo; this.k = escala;
    this.raio = new THREE.Raycaster();
    this._o = new THREE.Vector3(); this._baixo = new THREE.Vector3(0, -1, 0);
  }
  _interior() { return this.mundo.interiores[this.mundo.mapaAtual]; }

  // Livre de paredes e portas fechadas? (x, z em metros da planta, sem ampliação)
  _semParede(it, x, z, folga) {
    for (const m of it.muros) if (!m.inativo && distanciaAoSegmento(x, z, m) < m.esp / 2 + folga) return false; // inativo: peça de desafio escondida
    for (const p of it.portas) if (!p.aberta && distanciaAoSegmento(x, z, p.seg) < 0.06 + folga) return false;
    return true;
  }
  // Altura do que há no chão nesse ponto (piso, degrau, tampo de mesa...), em metros do mundo.
  // ref: altura de quem anda. O que está mais de uma pessoa acima (vela, verga, marquise, galho) passa por cima dela.
  _altura(it, xm, zm, ref = null, terreno = false) {
    this.raio.set(this._o.set(xm, it.origem[1] + 120, zm), this._baixo);
    this.raio.far = 140;
    const t = this.raio.intersectObject(it.grupo, true).find((h) => h.face && !h.object.material.transparent && !h.object.userData.porta && !h.object.userData.teto && !h.object.userData.oculto && !(terreno && h.object.userData.atravessavel) && (ref == null || h.point.y <= ref + 2.1));
    return t ? t.point.y : it.origem[1];
  }

  // Leva um ponto de (x0,z0) até perto de (x1,z1) em passos curtos, deslizando nas paredes.
  // comMoveis: também barra desníveis maiores que um degrau (móveis, parapeitos).
  _andar(it, x0, z0, x1, z1, folga, comMoveis, yRef = null) {
    const k = this.k, [ox, , oz] = it.origem;
    const loc = (xm, zm) => [(xm - ox) / k, (zm - oz) / k];
    let [lx, lz] = loc(x0, z0);
    // Se já começou dentro de uma parede (ex.: criatura colocada ali), deixa sair livremente.
    if (!this._semParede(it, lx, lz, folga * 0.6)) return { x: x1, z: z1, y: comMoveis ? this._altura(it, x1, z1, yRef) : 0 };
    let x = x0, z = z0, h = comMoveis ? this._altura(it, x, z, yRef) : 0;
    const dist = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(dist / (0.2 * k)));
    const degrau = 0.3 * k;
    const pode = (nx, nz) => {
      const [ax, az] = loc(nx, nz);
      if (!this._semParede(it, ax, az, folga)) return null;
      if (!comMoveis) return 0;
      const nh = this._altura(it, nx, nz, h);
      return Math.abs(nh - h) <= degrau ? nh : null;
    };
    const px = (x1 - x0) / n, pz = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      let r = pode(x + px, z + pz);
      if (r !== null) { x += px; z += pz; h = r; continue; }
      r = pode(x + px, z); if (r !== null) { x += px; h = r; continue; }
      r = pode(x, z + pz); if (r !== null) { z += pz; h = r; continue; }
      break;
    }
    return { x, z, y: h };
  }

  // Criatura arrastada: devolve onde ela pode ficar (na cidade o movimento é livre).
  criatura(m, x, z) {
    const it = this._interior();
    if (!it) return null;
    const p = m.grupo.position;
    return this._andar(it, p.x, p.z, x, z, 0.12, true, p.y); // folga pequena, para caber nos vãos de porta
  }
  // Câmera: colide com paredes, prédios e cercas quando está abaixo do topo das paredes, medido a partir do chão
  // embaixo dela (num morro ou num convés o chão não está no zero). Acima disso, voa livre.
  // Nos mapas a céu aberto ela também acompanha o chão: sobe a encosta em vez de entrar nela, desce do outro lado e
  // nunca fica dentro do terreno. Devolve { x, z, dy } (dy: quanto subir ou descer a câmera e o ponto observado).
  camera(anterior, atual) {
    const it = this._interior();
    if (!it) return null;
    if (anterior.x === atual.x && anterior.z === atual.z) return null;
    // Saltos grandes são trocas de câmera ou de mapa, não movimento: não colidem.
    const passo = Math.hypot(atual.x - anterior.x, atual.z - anterior.z);
    if (passo > 3 * this.k) return null;
    const chao0 = this._altura(it, anterior.x, anterior.z, anterior.y - 2.2);
    const voando = anterior.y - chao0 > it.paredes.scale.y * this.k + 0.3;
    const r = voando ? { x: atual.x, z: atual.z, y: 0 } : this._andar(it, anterior.x, anterior.z, atual.x, atual.z, 0.15, false);
    r.dy = 0;
    if (!it.aberto) return voando ? null : r;
    if (!voando) {
      // A pé: segue o chão quando ele muda aos poucos (encosta); um degrau brusco (mesa, convés) não puxa a câmera.
      const andou = Math.hypot(r.x - anterior.x, r.z - anterior.z);
      const chao1 = this._altura(it, r.x, r.z, anterior.y - 2.2), dy = chao1 - chao0;
      if (Math.abs(dy) <= andou * 0.9 + 0.02) r.dy = dy;
    }
    // Nunca dentro do terreno: se a encosta ficou acima da câmera, ela sobe por cima. A pé, só vale para subidas
    // baixas (terreno); um telhado ou um beiral ao lado não levanta a câmera, porque ela não entra neles (colisão).
    const topo = this._altura(it, r.x, r.z, null, true), minimo = topo + 0.6 * this.k;
    if (atual.y + r.dy < minimo && (voando || topo - chao0 <= 2.5 * this.k)) r.dy = minimo - atual.y;
    return r;
  }
}
