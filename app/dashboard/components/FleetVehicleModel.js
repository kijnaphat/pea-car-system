'use client'

import { memo, useLayoutEffect, useState } from 'react'
import { vehicleStyle } from '@/lib/fleetVehicleStyle'
import { createVehicleModelCache, vehicleModelIdentity } from '@/lib/fleetVehicleModel'

const models = createVehicleModelCache()

export default memo(function FleetVehicleModel({ car, kind: explicitKind, color: explicitColor }) {
  const style = vehicleStyle(car)
  const { kind, color, key } = vehicleModelIdentity(explicitKind || style.kind, explicitColor || style.color)
  const [resource, setResource] = useState(null)
  useLayoutEffect(() => {
    // Allocate external GPU resources only after commit. An abandoned/yielding
    // concurrent render cannot create an unretained cache entry for LRU to evict.
    const committed = models.get(kind, color)
    models.retain(committed)
    // Synchronize the committed external resource before the browser paints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResource(committed)
    return () => models.release(committed)
  }, [kind, color])
  if (resource?.key !== key) return null
  return <group dispose={null}>
    {resource.model.batches.map(({ family, geometry, material }) => <mesh key={family} geometry={geometry} material={material}
      castShadow={family !== 'glass' && family !== 'lights'} receiveShadow={family !== 'glass' && family !== 'lights'}/>) }
  </group>
})
