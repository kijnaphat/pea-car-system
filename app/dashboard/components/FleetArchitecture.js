'use client'

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D, DoubleSide } from 'three'
import { ARCHITECTURE, canopyStructure } from '@/lib/fleetArchitecture'

// One draw call for all repeated pieces in a batch; no per-frame matrix work.
export const StaticParts = memo(function StaticParts({ parts, foliage = false, glass = false }) {
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
  return <instancedMesh ref={mesh} args={[null, null, parts.length]} castShadow={!glass} receiveShadow>
    {foliage ? <icosahedronGeometry args={[1, 1]}/> : <boxGeometry args={[1, 1, 1]}/>}
    <meshStandardMaterial color="#ffffff" roughness={glass ? .24 : foliage ? 1 : .76} metalness={glass ? .3 : .04} flatShading={foliage}/>
  </instancedMesh>
})

export function ArchitecturalCanopy({ width, depth, height = 3.5 }) {
  const structure = useMemo(() => canopyStructure(width, depth, height), [width, depth, height])
  const ribs = useMemo(() => {
    const parts = []
    for (let n = 0; n <= 12; n++) {
      const z = -depth / 2 + depth * n / 12
      const y = height + .07 + .36 * Math.sin(Math.PI * n / 12)
      parts.push({ at: [0, y, z], size: [width, .045, .04], color: ARCHITECTURE.frame })
    }
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
    <StaticParts parts={structure}/><StaticParts parts={ribs}/>
    <mesh position={[0, height + .05, 0]} receiveShadow>
      <bufferGeometry onUpdate={geometry => geometry.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[surface.points, 3]}/>
        <bufferAttribute attach="index" args={[surface.indices, 1]}/>
      </bufferGeometry>
      <meshStandardMaterial color="#d6e0df" roughness={.4} metalness={.15} side={DoubleSide} transparent opacity={.42} depthWrite={false}/>
    </mesh>
  </group>
}
