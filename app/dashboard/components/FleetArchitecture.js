'use client'

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D, DoubleSide } from 'three'
import { ARCHITECTURE, canopyStructure } from '@/lib/fleetArchitecture'

// One draw call for all repeated pieces in a batch; no per-frame matrix work.
export const StaticParts = memo(function StaticParts({ parts, foliage = false, glass = false, metal = false }) {
  const mesh = useRef(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const object = new Object3D(), color = new Color()
    parts.forEach((part, n) => {
      object.position.set(...part.at)
      object.scale.set(...part.size)
      object.rotation.set(...(part.rotation || [0, 0, 0]))
      object.updateMatrix()
      mesh.current.setMatrixAt(n, object.matrix)
      mesh.current.setColorAt(n, color.set(part.color))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [parts])
  return <instancedMesh ref={mesh} args={[null, null, parts.length]} castShadow={!glass} receiveShadow={!glass}>
    {foliage ? <icosahedronGeometry args={[1, 1]}/> : <boxGeometry args={[1, 1, 1]}/>}
    {glass ? <meshPhysicalMaterial color="#ffffff" roughness={.19} metalness={.14} clearcoat={.7} clearcoatRoughness={.18}/>
      : <meshStandardMaterial color="#ffffff" roughness={foliage ? 1 : metal ? .48 : .72} metalness={metal ? .42 : .025} flatShading={foliage}/>}
  </instancedMesh>
})

export function ArchitecturalCanopy({ width, depth, height = 3.5 }) {
  const structure = useMemo(() => canopyStructure(width, depth, height), [width, depth, height])
  const ribs = useMemo(() => {
    const parts = []
    for (let n = 0; n <= 14; n++) {
      const z = -depth / 2 + depth * n / 14
      const y = height + .07 + .36 * Math.sin(Math.PI * n / 14)
      parts.push({ at: [0, y, z], size: [width, .045, .035], color: ARCHITECTURE.frame })
    }
    for (let n = 0; n <= Math.ceil(width / 2.5); n++) parts.push({ at: [-width / 2 + width * n / Math.ceil(width / 2.5), height - .02, 0], size: [.065, .1, depth], color: ARCHITECTURE.steel })
    return parts
  }, [width, depth, height])
  const surface = useMemo(() => {
    const points = [], indices = []
    for (let n = 0; n <= 20; n++) {
      const z = -depth / 2 + depth * n / 20, y = .36 * Math.sin(Math.PI * n / 20)
      points.push(-width / 2, y, z, width / 2, y, z)
      if (n < 20) { const a = n * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    }
    return { points: new Float32Array(points), indices: new Uint16Array(indices) }
  }, [width, depth])
  return <group>
    <StaticParts parts={structure} metal/><StaticParts parts={ribs} metal/>
    <mesh position={[0, height + .05, 0]} receiveShadow>
      <bufferGeometry onUpdate={geometry => geometry.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[surface.points, 3]}/>
        <bufferAttribute attach="index" args={[surface.indices, 1]}/>
      </bufferGeometry>
      <meshPhysicalMaterial color="#a4bcc0" roughness={.24} metalness={.15} clearcoat={.8} side={DoubleSide} transparent opacity={.48} depthWrite={false}/>
    </mesh>
  </group>
}
