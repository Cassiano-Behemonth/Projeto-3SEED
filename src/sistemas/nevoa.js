// Névoa rasteira: tufos macios que derivam com o vento em volta do ponto observado.
// A intensidade muda aos poucos até o valor pedido (0 = sem névoa, 1 = cerrada).
import * as THREE from 'three';
import { brilho } from '../util/texturas.js';

// Duas camadas por modo: uma larga (vista de cima) e uma fina e próxima (vista da rua).
const MODOS = {
  exterior: [
    { raio: 420, altura: 18, tamanho: 110, vento: [1.4, 0.6], forca: 0.62 },
    { raio: 110, altura: 7, tamanho: 34, vento: [0.9, 0.4], forca: 0.52 },
  ],
  interior: [
    { raio: 34, altura: 1.8, tamanho: 9, vento: [0.12, 0.05], forca: 0.52 },
    { raio: 12, altura: 1.1, tamanho: 3.4, vento: [0.08, 0.03], forca: 0.38 },
  ],
};

class Camada {
  constructor(cena, n) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const base = new Float32Array(n * 3), extra = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      base[i * 3] = Math.random(); base[i * 3 + 1] = Math.random(); base[i * 3 + 2] = Math.random() ** 1.6;
      extra[i * 2] = 0.6 + Math.random() * 0.8; extra[i * 2 + 1] = Math.random();
    }
    geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
    geo.setAttribute('aExtra', new THREE.InstancedBufferAttribute(extra, 2));
    geo.instanceCount = n;
    this.u = {
      uMapa: { value: brilho() }, uCentro: { value: new THREE.Vector3() }, uCor: { value: new THREE.Color(0x4a566e) },
      uRaio: { value: 420 }, uAltura: { value: 16 }, uTamanho: { value: 100 }, uBase: { value: 0 },
      uVento: { value: new THREE.Vector2(1.4, 0.6) }, uTempo: { value: 0 }, uOpacidade: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec3 aBase; attribute vec2 aExtra;
        uniform vec3 uCentro; uniform float uRaio, uAltura, uTamanho, uBase, uTempo; uniform vec2 uVento;
        varying vec2 vUv; varying float vAlfa;
        void main(){
          vUv = uv;
          vec2 p = aBase.xy * 2.0 * uRaio + uVento * uTempo * (0.6 + aExtra.y * 0.8);
          p = mod(p - uCentro.xz, 2.0 * uRaio) - uRaio;
          float y = uBase + aBase.z * uAltura + sin(uTempo * 0.2 + aExtra.y * 6.283) * uAltura * 0.12;
          vec4 mv = viewMatrix * vec4(uCentro.x + p.x, y, uCentro.z + p.y, 1.0);
          float tam = uTamanho * aExtra.x;
          mv.xy += position.xy * tam;
          float borda = 1.0 - smoothstep(0.6, 1.0, length(p) / uRaio);
          vAlfa = borda * smoothstep(tam * 0.03, tam * 0.3, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D uMapa; uniform vec3 uCor; uniform float uOpacidade; varying vec2 vUv; varying float vAlfa;
        void main(){ float a = texture2D(uMapa, vUv).a * vAlfa * uOpacidade; if (a < 0.003) discard; gl_FragColor = vec4(uCor, a); }`,
    });
    this.malha = new THREE.Mesh(geo, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 6;
    this.malha.visible = false;
    cena.add(this.malha);
  }
}

export class Nevoa {
  constructor(cena) {
    this.atual = 0; this.alvo = 0;
    this.camadas = [new Camada(cena, 170), new Camada(cena, 150)];
    this.definirModo('exterior');
  }
  definir(valor) { this.alvo = Math.min(1, Math.max(0, valor)); }
  definirModo(modo, escala = 1) {
    this.modo = modo;
    MODOS[modo].forEach((m, i) => {
      const u = this.camadas[i].u;
      u.uRaio.value = m.raio * escala; u.uAltura.value = m.altura * escala; u.uTamanho.value = m.tamanho * escala; u.uVento.value.set(m.vento[0] * escala, m.vento[1] * escala);
      this.camadas[i].forca = m.forca;
    });
  }
  atualizar(dt, t, centro, cor) {
    // Aproxima do alvo devagar, para a névoa "chegar" e "ir embora".
    this.atual += (this.alvo - this.atual) * Math.min(1, dt * 0.9);
    if (Math.abs(this.alvo - this.atual) < 0.002) this.atual = this.alvo;
    for (const c of this.camadas) {
      c.malha.visible = this.atual > 0.004;
      c.u.uOpacidade.value = this.atual * c.forca;
      c.u.uTempo.value = t;
      c.u.uCentro.value.copy(centro);
      c.u.uCor.value.copy(cor);
    }
  }
}
