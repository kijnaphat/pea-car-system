// Only known same-origin report routes may be used as a login return path.
export function adminDestination(search = '') {
  const params = new URLSearchParams(search)
  const carId = params.get('car_id')
  if (params.get('next') === 'home-maintenance' && /^\d+$/.test(carId || '')) {
    return `/?admin_report_car_id=${carId}`
  }
  const next = params.get('next') || ''
  if (!/^\/report\/repairs(?:\?|$)/.test(next)) return '/admin'
  const target = new URL(next, 'https://local.invalid')
  if (target.origin !== 'https://local.invalid' || target.pathname !== '/report/repairs') return '/admin'
  const safe = new URLSearchParams()
  if (/^[1-9]\d*$/.test(target.searchParams.get('car_id') || '')) safe.set('car_id', target.searchParams.get('car_id'))
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(target.searchParams.get('month') || '')) safe.set('month', target.searchParams.get('month'))
  return `/report/repairs${safe.size ? `?${safe}` : ''}`
}
