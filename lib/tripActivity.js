// Historical EV rows are charging records. Explicit activity always takes precedence.
export const isElectricCar = car => String(car?.fuel_type || '').trim().toUpperCase() === 'EV'

export function tripActivity(trip, car) {
  if (trip?.activity_type === 'usage' || trip?.activity_type === 'charge') return trip.activity_type
  const relatedCar = car || (Array.isArray(trip?.cars) ? trip.cars[0] : trip?.cars)
  return isElectricCar(relatedCar) || trip?.station_type ? 'charge' : 'usage'
}

export const isChargeTrip = (trip, car) => Boolean(trip) && tripActivity(trip, car) === 'charge'

export const reportTypeForCar = (car, requestedType) => isElectricCar(car)
  ? requestedType === 'usage' ? 'usage' : 'charge'
  : 'usage'

export const reportSignatureTable = (car, requestedType) =>
  isElectricCar(car) && reportTypeForCar(car, requestedType) === 'usage'
    ? 'ev_usage_report_signatures' : 'report_signatures'

export function monthlyReportData(logs = [], car, requestedType) {
  const type = reportTypeForCar(car, requestedType)
  const rows = isElectricCar(car)
    ? logs.filter(log => isChargeTrip(log, car) === (type === 'charge'))
    : logs
  return {
    type,
    rows,
    startMileage: logs[0]?.start_mileage ?? 0,
    // A charge can start after its parent trip but finish before the car returns.
    endMileage: [...logs].sort((a, b) => new Date(a.end_time || a.start_time || 0) - new Date(b.end_time || b.start_time || 0)).at(-1)?.end_mileage ?? 0,
  }
}
