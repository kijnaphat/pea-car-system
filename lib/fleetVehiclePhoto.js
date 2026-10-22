import { getCarImage, getLegacyCarImage, getStoredCarImageUrl } from './carImages.js'

// Uploaded image first, then a clearly identified local type example. The card
// proxy already handles resizing/caching; do not fetch a second hero-size image.
export function vehiclePhotoSources(car = {}) {
  const primary = getCarImage(car, 'card')
  const legacy = getLegacyCarImage(car || {})
  return [
    ...(primary ? [{ src: primary, actual: Boolean(getStoredCarImageUrl(car?.image_path, 'card')) }] : []),
    ...(legacy && legacy !== primary ? [{ src: legacy, actual: false }] : []),
  ]
}

export function vehiclePhotoKey(car, sources) {
  return JSON.stringify([car?.id ?? null, sources.map(source => source.src)])
}

export function nextVehiclePhoto(sources, failed = []) {
  return sources.find(source => !failed.includes(source.src)) || null
}

export function recordPhotoFailure(failed, src) {
  return failed.includes(src) ? failed : [...failed, src]
}
