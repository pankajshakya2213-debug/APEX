import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { irisService } from '@renderer/services/Iris-voice-ai'

interface PlasmaBlobProps {
  active: boolean
  mood: 'idle' | 'listening' | 'thinking' | 'speaking'
  color?: string
}

const noiseFunctions = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float total = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 3; i++) {
      total += snoise(p * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total;
  }
`

const BlobScene = ({ active, mood, color = '#00ffe1' }: PlasmaBlobProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const plasmaRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Points>(null)
  const audioDataRef = useRef<Uint8Array>(new Uint8Array(128))
  const smoothedAudioRef = useRef(0)

  const params = useMemo(
    () => ({
      timeScale: mood === 'speaking' ? 1.85 : mood === 'thinking' ? 1.35 : active ? 1.1 : 0.55,
      rotationSpeedX: active ? 0.0008 : 0,
      rotationSpeedY: mood === 'thinking' ? 0.004 : active ? 0.0012 : 0,
      plasmaScale: 0.2,
      plasmaBrightness: mood === 'speaking' ? 1.85 : active ? 1.35 : 0.85,
      voidThreshold: active ? 0.09 : 0.18,
      shellOpacity: active ? 0.45 : 0.24
    }),
    [active, mood]
  )

  const shellMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewPosition)), 2.5);
            gl_FragColor = vec4(uColor, fresnel * uOpacity);
          }
        `,
        uniforms: {
          uColor: { value: new THREE.Color(0x0066ff) },
          uOpacity: { value: params.shellOpacity }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
      }),
    []
  )

  const plasmaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAudio: { value: 0 },
          uScale: { value: params.plasmaScale },
          uBrightness: { value: params.plasmaBrightness },
          uThreshold: { value: params.voidThreshold },
          uColorDeep: { value: new THREE.Color(0x001433) },
          uColorMid: { value: new THREE.Color(0x0084ff) },
          uColorBright: { value: new THREE.Color(0x00ffe1) }
        },
        vertexShader: `
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          uniform float uTime;
          uniform float uAudio;
          ${noiseFunctions}
          void main() {
            float pulse = snoise(normal * 2.5 + vec3(uTime * 0.35));
            vec3 displaced = position + normal * pulse * (0.035 + uAudio * 0.14);
            vPosition = displaced;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uScale;
          uniform float uBrightness;
          uniform float uThreshold;
          uniform vec3 uColorDeep;
          uniform vec3 uColorMid;
          uniform vec3 uColorBright;
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          ${noiseFunctions}
          void main() {
            vec3 p = vPosition * uScale;
            vec3 q = vec3(
              fbm(p + vec3(0.0, uTime * 0.05, 0.0)),
              fbm(p + vec3(5.2, 1.3, 2.8) + uTime * 0.05),
              fbm(p + vec3(2.2, 8.4, 0.5) - uTime * 0.02)
            );
            float density = fbm(p + 2.0 * q);
            float t = (density + 0.4) * 0.8;
            float alpha = smoothstep(uThreshold, 0.7, t);
            vec3 color = mix(uColorDeep, uColorMid, smoothstep(uThreshold, 0.5, t));
            color = mix(color, uColorBright, smoothstep(0.5, 0.8, t));
            color = mix(color, vec3(1.0), smoothstep(0.8, 1.0, t));
            float facing = dot(normalize(vNormal), normalize(vViewPosition));
            float depthFactor = (facing + 1.0) * 0.5;
            gl_FragColor = vec4(color * uBrightness, alpha * (0.02 + 0.98 * depthFactor));
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
    []
  )

  const particleGeometry = useMemo(() => {
    const count = 600
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = 0.95 * Math.cbrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      sizes[i] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return geometry
  }, [])

  const particleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAudio: { value: 0 },
          uColor: { value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uAudio;
          attribute float aSize;
          varying float vAlpha;
          void main() {
            vec3 pos = position;
            pos *= 1.0 + uAudio * 0.22;
            pos.y += sin(uTime * (0.35 + uAudio) + pos.x * 3.0) * (0.02 + uAudio * 0.06);
            pos.x += cos(uTime * (0.25 + uAudio) + pos.z * 3.0) * (0.02 + uAudio * 0.05);
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = (8.0 * aSize + 4.0 + uAudio * 16.0) * (1.0 / -mvPosition.z);
            vAlpha = 0.65 + uAudio * 0.35 + 0.2 * sin(uTime + aSize * 10.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float dist = length(uv);
            if (dist > 0.5) discard;
            float glow = pow(1.0 - (dist * 2.0), 1.8);
            gl_FragColor = vec4(uColor, glow * vAlpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
    []
  )

  useEffect(() => {
    const base = new THREE.Color(color)
    const deep = base.clone().multiplyScalar(0.12)
    const mid = base.clone().multiplyScalar(0.72)
    const bright = base.clone().lerp(new THREE.Color(0xffffff), 0.18)

    shellMaterial.uniforms.uColor.value.copy(mid)
    plasmaMaterial.uniforms.uColorDeep.value.copy(deep)
    plasmaMaterial.uniforms.uColorMid.value.copy(mid)
    plasmaMaterial.uniforms.uColorBright.value.copy(bright)
    particleMaterial.uniforms.uColor.value.copy(bright)
  }, [color, particleMaterial, plasmaMaterial, shellMaterial])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    let audioLevel = 0

    if (irisService.analyser) {
      if (audioDataRef.current.length !== irisService.analyser.frequencyBinCount) {
        audioDataRef.current = new Uint8Array(irisService.analyser.frequencyBinCount)
      }
      irisService.analyser.getByteFrequencyData(audioDataRef.current as Uint8Array<ArrayBuffer>)
      const sum = audioDataRef.current.reduce((total, value) => total + value, 0)
      audioLevel = Math.min(1, sum / audioDataRef.current.length / 190)
    }

    audioLevel = Math.max(audioLevel, irisService.inputAudioLevel * 0.95)

    const moodBoost =
      audioLevel > 0.055
        ? mood === 'speaking'
          ? 0.1
          : mood === 'listening'
            ? 0.06
            : mood === 'thinking'
              ? 0.05
              : 0
        : 0
    const targetAudio = audioLevel > 0.055 ? Math.min(1, audioLevel + moodBoost) : 0
    smoothedAudioRef.current += (targetAudio - smoothedAudioRef.current) * 0.06
    const reactive = smoothedAudioRef.current

    plasmaMaterial.uniforms.uTime.value = active
      ? t * (params.timeScale + reactive * 1.4)
      : reactive > 0
        ? t * 0.4
        : 0
    plasmaMaterial.uniforms.uAudio.value = reactive
    plasmaMaterial.uniforms.uBrightness.value = params.plasmaBrightness + reactive * 1.55
    plasmaMaterial.uniforms.uThreshold.value = Math.max(0.02, params.voidThreshold - reactive * 0.05)
    shellMaterial.uniforms.uOpacity.value = Math.min(0.9, params.shellOpacity + reactive * 0.34)
    particleMaterial.uniforms.uTime.value = t
    particleMaterial.uniforms.uAudio.value = reactive

    if (plasmaRef.current) {
      plasmaRef.current.rotation.y = t * (0.08 + reactive * 0.18)
    }

    if (groupRef.current) {
      const scale = 1 + reactive * 0.16
      groupRef.current.scale.setScalar(scale)
      groupRef.current.rotation.x += params.rotationSpeedX + reactive * 0.0015
      groupRef.current.rotation.y += params.rotationSpeedY + reactive * 0.004
    }
  })

  return (
    <group ref={groupRef}>
      <pointLight color={color} intensity={2} distance={10} />
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <primitive object={shellMaterial} attach="material" />
      </mesh>
      <mesh ref={plasmaRef}>
        <sphereGeometry args={[0.998, 128, 128]} />
        <primitive object={plasmaMaterial} attach="material" />
      </mesh>
      <points ref={particlesRef} geometry={particleGeometry}>
        <primitive object={particleMaterial} attach="material" />
      </points>
    </group>
  )
}

const PlasmaBlob = (props: PlasmaBlobProps) => (
  <Canvas
    camera={{ position: [0, 0, 2.4], fov: 75 }}
    gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
    dpr={[1, 2]}
  >
    <ambientLight intensity={0.35} />
    <BlobScene {...props} />
  </Canvas>
)

export default PlasmaBlob
