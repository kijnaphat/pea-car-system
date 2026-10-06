// Historical EV rows are charging records. Explicit activity always takes precedence.
export const isElectricCar = car => String(car?.fuel_type || '').trim().toUpperCase() === 'EV'

export function tripActivity(trip, car) {
  if (trip?.activity_type === 'usage' || trip?.activity_type === 'charge') return trip.activity_type
  const relatedCar = car || (Array.isArray(trip?.cars) ? trip.cars[0] : trip?.cars)
  return isElectricCar(relatedCar) || trip?.station_type ? 'charge' : 'usage'
}

export const isChargeTrip = (trip, car) => Boolean(trip) && tripActivity(trip, car) === 'charge'

export function monthlyReportData(logs = [], car) {
  const rows = isElectricCar(car) ? logs.filter(log => isChargeTrip(log, car)) : logs
  return {
    rows,
    startMileage: logs[0]?.start_mileage ?? 0,
    endMileage: logs.at(-1)?.end_mileage ?? 0,
  }
}
