'use client'

import { useEffect, useMemo } from 'react'
import { DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, NoColorSpace, LinearFilter, LinearMipmapLinearFilter } from 'three'
import { surfaceSwatch } from '@/lib/fleetSurfaceMaterials'

export default function FleetSurfaceMaterial({ kind = 'stone', color }) {
  const maps = useMemo(() => {
    const texture = new DataTexture(surfaceSwatch(kind), 128, 128, RGBAFormat)
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(kind === 'asphalt' ? .75 : .18, kind === 'asphalt' ? .75 : .18)
    texture.colorSpace = SRGBColorSpace
    texture.magFilter = LinearFilter
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = 4
    texture.needsUpdate = true
    const relief = texture.clone()
    relief.colorSpace = NoColorSpace
    relief.needsUpdate = true
    return { albedo: texture, relief }
  }, [kind])
  useEffect(() => () => { maps.albedo.dispose(); maps.relief.dispose() }, [maps])
  return <meshStandardMaterial color={color} map={maps.albedo} bumpMap={maps.relief} bumpScale={kind === 'asphalt' ? .012 : .018} roughnessMap={maps.relief} roughness={kind === 'asphalt' ? .97 : .9}/>
}
