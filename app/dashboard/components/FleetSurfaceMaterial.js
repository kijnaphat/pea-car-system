'use client'

import { useEffect, useMemo } from 'react'
import { DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } from 'three'
import { surfaceSwatch } from '@/lib/fleetSurfaceMaterials'

export default function FleetSurfaceMaterial({ kind = 'stone', color }) {
  const map = useMemo(() => {
    const texture = new DataTexture(surfaceSwatch(kind), 128, 128, RGBAFormat)
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(kind === 'asphalt' ? .75 : .18, kind === 'asphalt' ? .75 : .18)
    texture.colorSpace = SRGBColorSpace
    texture.magFilter = LinearFilter
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = 4
    texture.needsUpdate = true
    return texture
  }, [kind])
  useEffect(() => () => map.dispose(), [map])
  return <meshStandardMaterial color={color} map={map} roughness={kind === 'asphalt' ? .96 : .88}/>
}
