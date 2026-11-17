// Poças de luz no chão sob cada ponto de luz (baratas; dão o clima noturno visto de cima).
import * as THREE from 'three';
import { brilho } from '../util/texturas.js';

const ALT_PADRAO = 0.37; // um pouco acima do chão, quando a luz não diz onde é o chão dela

export function criarPocasDeLuz(mundo) {
  const mat = new THREE.MeshBasicMaterial({ map: brilho(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, mat, mundo.luzes.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  mundo.luzes.forEach((l, i) => {
    o.position.set(l.x, l.chao ?? ALT_PADRAO, l.z); o.scale.set(l.raio * 1.5, 1, l.raio * 1.5); o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, c.set(l.cor).multiplyScalar(0.3 * (l.poca ?? l.forca)));
  });
  im.renderOrder = 2;
  im.frustumCulled = false;
  mundo.opacidadesNoturnas.push({ mat, max: 1, obj: im });
  return im;
}

