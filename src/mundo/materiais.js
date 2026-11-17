// Materiais compartilhados. Quase todos aceitam cor por vértice para tingir a mesma textura.
import * as THREE from 'three';
import { pbr, atlasFachada, atlasVidro, vidraca, vitral } from '../util/texturas.js';

// Materiais que acendem à noite: { mat, noite, dia }
export const noturnos = [];
export function noturno(mat, noite, dia = 0) {
  noturnos.push({ mat, noite, dia });
  mat.emissiveIntensity = dia;
  return mat;
}

export function matLuminoso(textura, forca = 1.6, dia = 0.0) {
  const m = new THREE.MeshStandardMaterial({ map: textura, emissiveMap: textura, emissive: 0xffffff, roughness: 0.6, vertexColors: true });
  return noturno(m, forca, dia);
}
export function matPlaca(textura) {
  return new THREE.MeshStandardMaterial({ map: textura, roughness: 0.8, vertexColors: true });
}

export function criarMateriais(rng) {
  const P = (nome, tile, extra = {}) => {
    const t = pbr(nome);
    const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.93, metalness: 0, vertexColors: true, ...extra });
    m.userData.tile = [tile, tile];
    return m;
  };
  const liso = (extra = {}) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, vertexColors: true, ...extra });
  const jan = (t, acesa, forca = 2.4) => {
    const m = new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.3, metalness: 0.15, vertexColors: true });
    if (acesa) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t.emissiveMap; noturno(m, forca); }
    return m;
  };

  const M = {
    asfalto: P('asphalt_02', 8, { roughness: 0.9 }),
    calcada: P('concrete_pavement', 5),
    pedra: P('cobblestone_floor_04', 2.6, { color: new THREE.Color(1.5, 1.5, 1.5) }),
    pisoPraca: P('brick_pavement_02', 4),
    grama: P('leafy_grass', 6, { roughness: 1, color: new THREE.Color(1.2, 1.25, 1.1) }),
    reboco: P('white_plaster_02', 4, { color: new THREE.Color(1.45, 1.45, 1.45) }),
    telha: P('clay_roof_tiles_02', 4, { side: THREE.DoubleSide }),
    ardosia: P('roof_slates_03', 4, { side: THREE.DoubleSide, color: new THREE.Color(1.9, 1.9, 1.9) }),
    arenito: P('sandstone_blocks_05', 2.8, { color: new THREE.Color(1.15, 1.15, 1.15) }),
    pedraMuro: P('stone_brick_wall_001', 3.5, { color: new THREE.Color(1.7, 1.7, 1.7) }),
    concreto: P('concrete_wall_008', 5),
    liso: liso(),
    lisoDuplo: liso({ side: THREE.DoubleSide }),
    metal: liso({ roughness: 0.5, metalness: 0.6 }),
    bronze: liso({ roughness: 0.36, metalness: 0.92, side: THREE.DoubleSide, envMapIntensity: 2.2 }),
    copa: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }),
    tronco: new THREE.MeshStandardMaterial({ roughness: 1, color: 0x4a3a2b }),
  };

  const fa = atlasFachada(rng);
  M.fachada = new THREE.MeshStandardMaterial({ map: fa.map, emissiveMap: fa.emissiveMap, emissive: 0xffffff, roughness: 0.9, vertexColors: true });
  M.fachada.userData.tile = [3.2 * 8, 3 * 8];
  noturno(M.fachada, 1.9);

  const vt = atlasVidro(rng);
  M.vidroTorre = new THREE.MeshStandardMaterial({ map: vt.map, emissiveMap: vt.emissiveMap, emissive: 0xffffff, roughness: 0.16, metalness: 0.9, vertexColors: true });
  M.vidroTorre.userData.tile = [2.2 * 8, 3.8 * 8];
  noturno(M.vidroTorre, 0.9);

  const clara = vidraca({ moldura: '#efe9dc' });
  const escura = vidraca({ moldura: '#2a2622', colunas: 2, linhas: 4, luz: '#ffc978' });
  const grade = vidraca({ moldura: '#22201d', colunas: 2, linhas: 3, grade: true, luz: '#cfe3c0' });
  M.janelaClara = [jan(clara, true), jan(clara, false)];
  M.janelaEscura = [jan(escura, true), jan(escura, false)];
  M.janelaGrade = [jan(grade, true, 1.6), jan(grade, false)];

  const vi = vitral(rng), ro = vitral(rng, true);
  M.vitral = new THREE.MeshStandardMaterial({ map: vi.map, emissiveMap: vi.emissiveMap, emissive: 0xffffff, roughness: 0.4, vertexColors: true });
  noturno(M.vitral, 1.1, 0.05);
  M.rosacea = new THREE.MeshStandardMaterial({ map: ro.map, emissiveMap: ro.emissiveMap, emissive: 0xffffff, roughness: 0.4, vertexColors: true });
  noturno(M.rosacea, 1.4, 0.05);

  // Lâmpadas: brilham só à noite e não projetam sombra.
  M.lampada = new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffd49a, vertexColors: true });
  M.lampada.userData.semSombra = true;
  noturno(M.lampada, 3.2, 0);
  M.neonVermelho = new THREE.MeshStandardMaterial({ color: 0x300808, emissive: 0xff2a1a, vertexColors: true });
  M.neonVermelho.userData.semSombra = true;
  noturno(M.neonVermelho, 6, 0.6);

  return M;
}
