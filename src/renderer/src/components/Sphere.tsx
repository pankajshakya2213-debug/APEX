import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { irisService } from '@renderer/services/Iris-voice-ai'

const CustomParticleSphere = ({ count = 2000 }) => {
  const mesh = useRef<THREE.Points>(null)
  const dataArray = useMemo(() => new Uint8Array(128), [])

  const palette = useMemo(() => [
    new THREE.Color('#8B5CF6'),
    new THREE.Color('#EC4899'),
    new THREE.Color('#06B6D4'),
    new THREE.Color('#F59E0B'),
  ], [])

  const { positions, originalPositions, spreadFactors, phaseOffsets } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const orig = new Float32Array(count * 3)
    const spread = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 1.6

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      orig[i * 3] = x
      orig[i * 3 + 1] = y
      orig[i * 3 + 2] = z

      spread[i] = Math.random() 
      phases[i] = Math.random() * Math.PI * 2
    }
    return { positions: pos, originalPositions: orig, spreadFactors: spread, phaseOffsets: phases }
  }, [count])

  useFrame((state, delta) => {
    if (!mesh.current) return

    const time = state.clock.getElapsedTime()
    const slowTime = time * 0.2
    const colorIndex = Math.floor(slowTime % palette.length)
    const nextColorIndex = (colorIndex + 1) % palette.length
    const lerpFactor = slowTime % 1

    let volume = 0
    if (irisService.analyser) {
      irisService.analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length
      volume = avg / 128
    }

    const baseColor = palette[colorIndex].clone().lerp(palette[nextColorIndex], lerpFactor)
    ;(mesh.current.material as THREE.PointsMaterial).color = baseColor.lerp(new THREE.Color('#FFFFFF'), volume * 0.4)

    const currentPos = mesh.current.geometry.attributes.position.array as Float32Array
    const expansionBase = 1 + (Math.sin(time * 0.8) * 0.02)
    const volEffect = volume * 0.35

    for (let i = 0; i < count; i++) {
      const ix = i * 3 
      const expansion = expansionBase + (volEffect * spreadFactors[i])
      currentPos[ix] = originalPositions[ix] * expansion
      currentPos[ix + 1] = originalPositions[ix + 1] * expansion
      currentPos[ix + 2] = originalPositions[ix + 2] * expansion
    }

    mesh.current.rotation.y += delta * 0.15
    mesh.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        transparent={true}
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const Sphere = () => {
  return (
    <Canvas camera={{ position: [0, 0, 4.5] }}>
      <ambientLight intensity={0.6} />
      <CustomParticleSphere />
    </Canvas>
  )
}

export default Sphere
