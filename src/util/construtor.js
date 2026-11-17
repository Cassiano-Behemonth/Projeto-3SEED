// Utilitários de geometria: tudo que é estático é juntado em poucas malhas por material.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _cor = new THREE.Color();

// Gerador pseudoaleatório com semente (a cidade sai sempre igual).
export function semente(s) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const entre = (rng, a, b) => a + rng() * (b - a);
export const sorteia = (rng, lista) => lista[Math.floor(rng() * lista.length)];

function tiles(mat) {
  const t = mat.userData.tile;
  return t ? t : [1, 1];
}

// Caixa com UV em metros (dividido pelo tamanho do ladrilho da textura).
export function geoCaixa(w, h, d, tu = 1, tv = tu, uvOff = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      let u = (uv.getX(k) * dims[f][0]) / tu;
      let v = (uv.getY(k) * dims[f][1]) / tv;
      if (uvOff) { u += uvOff[0]; v += uvOff[1]; }
      uv.setXY(k, u, v);
    }
  }
  return g;
}

// Faces planas arbitrárias (telhados, empenas, pirâmides). Cada face: 3+ pontos no sentido anti-horário visto de fora.
export function geoFaces(polys, tu = 1, tv = tu) {
  const pos = [], uv = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const ua = new THREE.Vector3(), va = new THREE.Vector3(), rel = new THREE.Vector3();
  for (const p of polys) {
    e1.subVectors(p[1], p[0]); e2.subVectors(p[2], p[0]);
    n.crossVectors(e1, e2).normalize();
    ua.set(0, 1, 0).cross(n);
    if (ua.lengthSq() < 1e-6) ua.copy(e1);
    ua.normalize();
    va.crossVectors(n, ua).normalize();
    const pts = p.map((v) => {
      rel.subVectors(v, p[0]);
      return [v.x, v.y, v.z, rel.dot(ua) / tu, rel.dot(va) / tv];
    });
    for (let i = 1; i < pts.length - 1; i++) {
      for (const q of [pts[0], pts[i], pts[i + 1]]) { pos.push(q[0], q[1], q[2]); uv.push(q[3], q[4]); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Telhado de quatro águas; base centrada na origem, cumeeira no eixo mais longo.
export function polysQuatroAguas(w, d, h) {
  if (d > w) return polysQuatroAguas(d, w, h).map((p) => p.map((v) => V(-v.z, v.y, v.x)));
  const hw = w / 2, hd = d / 2, r = (w - d) / 2;
  const c0 = V(-hw, 0, hd), c1 = V(hw, 0, hd), c2 = V(hw, 0, -hd), c3 = V(-hw, 0, -hd);
  const A = V(-r, h, 0), B = V(r, h, 0);
  return r < 0.01
    ? [[c0, c1, B], [c1, c2, B], [c2, c3, B], [c3, c0, B]]
    : [[c0, c1, B, A], [c1, c2, B], [c2, c3, A, B], [c3, c0, A]];
}
// Telhado de duas águas com cumeeira ao longo de X.
export function polysDuasAguas(w, d, h) {
  const hw = w / 2, hd = d / 2;
  return [
    [V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, 0), V(-hw, h, 0)],
    [V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, 0), V(hw, h, 0)],
  ];
}
// Triângulos de parede que fecham as pontas do telhado de duas águas.
export function polysEmpenas(w, d, h) {
  const hw = w / 2, hd = d / 2;
  return [
    [V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, 0)],
    [V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, 0)],
  ];
}
export function polysPiramide(w, d, h) {
  const hw = w / 2, hd = d / 2, T = V(0, h, 0);
  const c0 = V(-hw, 0, hd), c1 = V(hw, 0, hd), c2 = V(hw, 0, -hd), c3 = V(-hw, 0, -hd);
  return [[c0, c1, T], [c1, c2, T], [c2, c3, T], [c3, c0, T]];
}

// Painel em arco (redondo ou gótico), base centrada em x=0, y=0, virado para +Z. UV de 0 a 1.
export function geoArco(w, h, gotico = false) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0);
  if (gotico) {
    const hs = Math.max(h - w * 1.1, h * 0.45);
    s.lineTo(hw, hs);
    s.quadraticCurveTo(hw, hs + (h - hs) * 0.62, 0, h);
    s.quadraticCurveTo(-hw, hs + (h - hs) * 0.62, -hw, hs);
  } else {
    const hs = Math.max(h - hw, 0);
    s.lineTo(hw, hs);
    s.absarc(0, hs, hw, 0, Math.PI, false);
  }
  s.lineTo(-hw, 0);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + hw) / w, p.getY(i) / h);
  return g;
}

// Copa de árvore orgânica (bolhas deformadas, normais suaves).
export function geoCopa(rng, bolhas = 3, detalhe = 1) {
  const partes = [];
  for (let i = 0; i < bolhas; i++) {
    let g = mergeVertices(new THREE.IcosahedronGeometry(1, detalhe));
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const f = 1 + (rng() - 0.5) * 0.28;
      p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.85, p.getZ(k) * f);
    }
    const s = i === 0 ? 1 : entre(rng, 0.55, 0.8);
    g.scale(s, s, s);
    if (i > 0) g.translate(entre(rng, -0.7, 0.7), entre(rng, -0.1, 0.5), entre(rng, -0.7, 0.7));
    g.computeVertexNormals();
    partes.push(g.toNonIndexed());
  }
  return mergeGeometries(partes);
}

function preparar(geo, cor) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const nome of Object.keys(g.attributes)) {
    if (nome !== 'position' && nome !== 'normal' && nome !== 'uv') g.deleteAttribute(nome);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  _cor.set(cor ?? 0xffffff);
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { cores[i * 3] = _cor.r; cores[i * 3 + 1] = _cor.g; cores[i * 3 + 2] = _cor.b; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  return g;
}

// Junta peças por material. Coordenadas: y é sempre a BASE da peça.
export class Construtor {
  constructor() { this.lotes = new Map(); }

  add(mat, geo, x = 0, y = 0, z = 0, ry = 0, cor) {
    if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    if (!this.lotes.has(mat)) this.lotes.set(mat, []);
    this.lotes.get(mat).push(preparar(geo, cor));
    return this;
  }
  caixa(mat, w, h, d, x, y, z, { ry = 0, cor, uvOff } = {}) {
    const [tu, tv] = tiles(mat);
    const g = geoCaixa(w, h, d, tu, tv, uvOff);
    g.translate(0, h / 2, 0);
    return this.add(mat, g, x, y, z, ry, cor);
  }
  // Plano horizontal com textura ladrilhada (ou UV 0..1 se uv01).
  chao(mat, w, d, x, y, z, { ry = 0, cor, uv01 = false } = {}) {
    const g = new THREE.PlaneGeometry(w, d);
    if (!uv01) {
      const [tu, tv] = tiles(mat);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tu, (uv.getY(i) * d) / tv);
    }
    g.rotateX(-Math.PI / 2);
    return this.add(mat, g, x, y, z, ry, cor);
  }
  // Painel vertical (UV 0..1), centrado em x, base em y, virado para +Z antes da rotação.
  painel(mat, w, h, x, y, z, ry = 0, cor) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    return this.add(mat, g, x, y, z, ry, cor);
  }
  cilindro(mat, rTopo, rBase, h, x, y, z, { seg = 14, cor, aberto = false } = {}) {
    const g = new THREE.CylinderGeometry(rTopo, rBase, h, seg, 1, aberto);
    const [tu, tv] = tiles(mat);
    const uv = g.attributes.uv;
    const per = Math.PI * (rTopo + rBase);
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      // Tampas usam projeção de cima (em metros); a lateral enrola a textura.
      if (Math.abs(nor.getY(i)) > 0.9) uv.setXY(i, pos.getX(i) / tu, pos.getZ(i) / tv);
      else uv.setXY(i, (uv.getX(i) * per) / tu, (uv.getY(i) * h) / tv);
    }
    g.translate(0, h / 2, 0);
    return this.add(mat, g, x, y, z, 0, cor);
  }
  esfera(mat, r, x, y, z, { cor, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(sx, sy, sz);
    return this.add(mat, g, x, y + r * sy, z, 0, cor);
  }
  // Cilindro afunilado ligando dois pontos (braços, hastes inclinadas).
  tubo(mat, p0, p1, r0, r1, { seg = 10, cor } = {}) {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), d = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    return this.add(mat, g, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0, cor);
  }
  // Sólido de revolução a partir de um perfil [[raio, altura], ...].
  torno(mat, perfil, x, y, z, { seg = 16, cor, sz = 1 } = {}) {
    const g = new THREE.LatheGeometry(perfil.map(([r, h]) => new THREE.Vector2(r, h)), seg);
    if (sz !== 1) g.scale(1, 1, sz);
    return this.add(mat, g, x, y, z, 0, cor);
  }
  faces(mat, polys, x, y, z, { ry = 0, cor } = {}) {
    const [tu, tv] = tiles(mat);
    return this.add(mat, geoFaces(polys, tu, tv), x, y, z, ry, cor);
  }
  // Copia tudo de outro construtor, com deslocamento e rotação.
  anexar(outro, x = 0, y = 0, z = 0, ry = 0, escala = 1) {
    for (const [mat, geos] of outro.lotes) {
      if (!this.lotes.has(mat)) this.lotes.set(mat, []);
      for (const g0 of geos) {
        const g = g0.clone();
        if (escala !== 1) g.scale(escala, escala, escala);
        if (ry) g.rotateY(ry);
        g.translate(x, y, z);
        this.lotes.get(mat).push(g);
      }
    }
    return this;
  }
  construir({ sombra = true } = {}) {
    const grupo = new THREE.Group();
    for (const [mat, geos] of this.lotes) {
      if (!geos.length) continue;
      const malha = new THREE.Mesh(mergeGeometries(geos, false), mat);
      const emissivo = mat.userData.semSombra;
      malha.castShadow = sombra && !emissivo;
      malha.receiveShadow = !emissivo;
      grupo.add(malha);
    }
    return grupo;
  }
}
