'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// Procedural reflection lighting, baked once per mounted renderer. No HDR fetch.
export default function FleetEnvironment({ intensity = .38 }) {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment(), generator = new PMREMGenerator(gl)
    const environment = generator.fromScene(room, .035, .1, 100, { size: 128 })
    const previous = scene.environment, previousIntensity = scene.environmentIntensity
    // Three's scene is an external mutable object, not React state.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = environment.texture
    scene.environmentIntensity = intensity
    room.dispose(); generator.dispose(); invalidate()
    return () => {
      if (scene.environment === environment.texture) {
        scene.environment = previous; scene.environmentIntensity = previousIntensity
      }
      environment.dispose()
    }
  }, [gl, scene, invalidate, intensity])
  return null
}
