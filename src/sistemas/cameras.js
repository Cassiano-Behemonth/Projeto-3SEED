// Câmeras predefinidas por local, com voo suave entre elas.
import * as THREE from 'three';

const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class Cameras {
  constructor(camera, controles) {
    this.camera = camera; this.controles = controles; this.voo = null;
  }
  voarPara(pos, alvo, dur = 1.9) {
    const p = new THREE.Vector3(...pos), a = new THREE.Vector3(...alvo);
    const dist = this.camera.position.distanceTo(p);
    if (dist < 0.5) dur = 0.01;
    this.voo = { t: 0, dur: Math.min(dur, 0.8 + dist / 260), p0: this.camera.position.clone(), a0: this.controles.target.clone(), p, a, arco: Math.min(dist * 0.16, 110) };
    this.controles.enabled = false;
  }
  irJa(pos, alvo) {
    this.camera.position.set(...pos); this.controles.target.set(...alvo); this.voo = null; this.controles.enabled = true;
    this._liberarInclinacao(); this.controles.update();
  }
  // Os controles não deixam a câmera ficar abaixo do ponto para onde olha. Uma câmera de rua que olha para cima
  // (o portão visto do chão) seria empurrada para o alto assim que o voo termina; aqui o limite acompanha a vista.
  _liberarInclinacao() {
    this.polarBase ??= this.controles.maxPolarAngle;
    const d = this.camera.position.clone().sub(this.controles.target);
    const polar = Math.acos(THREE.MathUtils.clamp(d.y / (d.length() || 1), -1, 1));
    this.controles.maxPolarAngle = Math.max(this.polarBase, Math.min(Math.PI * 0.8, polar + 0.01));
  }
  atualizar(dt) {
    const v = this.voo;
    if (!v) return;
    v.t = Math.min(1, v.t + dt / v.dur);
    const k = suave(v.t);
    this.camera.position.lerpVectors(v.p0, v.p, k);
    this.camera.position.y += Math.sin(k * Math.PI) * v.arco;
    this.controles.target.lerpVectors(v.a0, v.a, k);
    this.camera.lookAt(this.controles.target);
    if (v.t >= 1) { this.voo = null; this.controles.enabled = true; this._liberarInclinacao(); }
  }
}
