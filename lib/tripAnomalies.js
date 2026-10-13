import { isChargeTrip } from './tripActivity.js'

export const tripTime = trip => {
  const time = new Date(trip.start_time || trip.created_at).getTime()
  return Number.isFinite(time) ? time : 0
}

export const getTripCar = trip => Array.isArray(trip?.cars) ? trip.cars[0] : trip?.cars

// Compatibility name: callers use this to select charging-only validation/corrections.
export const isEVTrip = trip => isChargeTrip(trip)

export function buildTripSequence(logs = []) {
  const byCar = new Map()

  logs.forEach(log => {
    const carLogs = byCar.get(log.car_id) || []
    carLogs.push(log)
    byCar.set(log.car_id, carLogs)
  })

  const decorated = new Map()
  const byId = new Map(logs.map(log => [String(log.id), log]))
  byCar.forEach(carLogs => {
    carLogs.sort((a, b) => tripTime(a) - tripTime(b) || Number(a.id) - Number(b.id))
    const mainTrips = carLogs.filter(log => !log.parent_trip_log_id)
    const mainIndices = new Map(mainTrips.map((trip, index) => [trip.id, index]))
    carLogs.forEach((trip, index) => {
      const mainIndex = mainIndices.get(trip.id) ?? -1
      decorated.set(String(trip.id), {
        ...trip,
        parentTrip: trip.parent_trip_log_id ? byId.get(String(trip.parent_trip_log_id)) || null : null,
        previousTrip: mainIndex >= 0 ? mainTrips[mainIndex - 1] || null : carLogs[index - 1] || null,
        nextTrip: mainIndex >= 0 ? mainTrips[mainIndex + 1] || null : carLogs[index + 1] || null,
      })
    })
  })

  return logs
    .map(log => decorated.get(String(log.id)))
    .sort((a, b) => tripTime(b) - tripTime(a) || Number(b.id) - Number(a.id))
}

const hasValue = value => value !== null && value !== undefined && value !== ''
const numberValue = value => hasValue(value) ? Number(value) : null
const EV_SEQUENCE_ISSUES = new Set(['ev_mileage_before_previous', 'ev_mileage_jump', 'ev_mileage_after_next', 'ev_mileage_outside_parent'])

export function getTripIssues(trip) {
  const issues = []
  const add = (code, label) => issues.push({ code, label })
  const start = numberValue(trip.start_mileage)
  const end = numberValue(trip.end_mileage)

  if (isEVTrip(trip)) {
    const batteryBefore = numberValue(trip.battery_before)
    const batteryAfter = numberValue(trip.battery_after)

    if (start === null) add('ev_start_mileage_missing', 'ไม่พบเลขไมล์ตอนเริ่มชาร์จ')
    if (trip.is_completed && end === null) add('ev_end_mileage_missing', 'ไม่พบเลขไมล์หลังชาร์จ')
    if (trip.is_completed && start !== null && end !== null && start !== end) {
      add('ev_mileage_changed', 'เลขไมล์ระหว่างชาร์จเปลี่ยน ทั้งที่ควรเท่าเดิม')
    }
    if (batteryBefore === null) {
      add('ev_battery_before_missing', 'ไม่พบเปอร์เซ็นต์แบตก่อนชาร์จ')
    } else if (batteryBefore < 0 || batteryBefore > 100) {
      add('ev_battery_before_range', 'เปอร์เซ็นต์แบตก่อนชาร์จไม่อยู่ในช่วง 0–100%')
    }

    if (trip.is_completed) {
      if (batteryAfter === null) {
        add('ev_battery_after_missing', 'ไม่พบเปอร์เซ็นต์แบตหลังชาร์จ')
      } else if (batteryAfter < 0 || batteryAfter > 100) {
        add('ev_battery_after_range', 'เปอร์เซ็นต์แบตหลังชาร์จไม่อยู่ในช่วง 0–100%')
      } else if (batteryBefore !== null && batteryBefore >= 0 && batteryBefore <= 100 && batteryAfter <= batteryBefore) {
        add('ev_battery_not_increased', 'เปอร์เซ็นต์แบตหลังชาร์จต้องมากกว่าก่อนชาร์จ')
      }
    }

    // A stationary charge may have equal before/after readings that are BOTH
    // mistyped. Compare the odometer with its real history, not just this row.
    if (trip.parent_trip_log_id) {
      const parentStart = numberValue(trip.parentTrip?.start_mileage)
      const parentEnd = trip.parentTrip?.is_completed ? numberValue(trip.parentTrip?.end_mileage) : null
      if ((parentStart !== null && start !== null && start < parentStart)
        || (parentEnd !== null && start !== null && start > parentEnd)) {
        add('ev_mileage_outside_parent', 'เลขไมล์ตอนชาร์จอยู่นอกช่วงเลขไมล์ของภารกิจที่กำลังขับ')
      }
    } else {
      const previousEnd = numberValue(trip.previousTrip?.end_mileage)
      const nextStart = numberValue(trip.nextTrip?.start_mileage)
      if (previousEnd !== null && start !== null && start < previousEnd) {
        add('ev_mileage_before_previous', `เลขไมล์ต่ำกว่ารายการก่อน (${previousEnd.toLocaleString('th-TH')} กม.)`)
      }
      if (previousEnd !== null && start !== null && start - previousEnd > 1000) {
        add('ev_mileage_jump', `เลขไมล์เพิ่มจากรายการก่อนเกิน 1,000 กม. (${previousEnd.toLocaleString('th-TH')} → ${start.toLocaleString('th-TH')} กม.)`)
      }
      if (nextStart !== null && start !== null && start > nextStart) {
        add('ev_mileage_after_next', `เลขไมล์สูงกว่ารายการถัดไป (${nextStart.toLocaleString('th-TH')} กม.)`)
      }
    }

    return issues
  }

  const previousEnd = numberValue(trip.previousTrip?.end_mileage)
  if (start !== null && end !== null && end < start) {
    add('mileage_end_before_start', 'เลขไมล์คืนต่ำกว่าเลขไมล์ออก')
  }
  if (start !== null && end !== null && end - start > 1000) {
    add('distance_over_1000', 'ระยะทางมากกว่า 1,000 กม.')
  }
  if (previousEnd !== null && start !== null && previousEnd !== start) {
    add('mileage_sequence_gap', `ไม่ต่อจากเที่ยวก่อน (${previousEnd.toLocaleString('th-TH')} กม.)`)
  }

  return issues
}

export function getIssueFingerprint(trip, issues = getTripIssues(trip)) {
  if (!issues.length) return ''

  const fingerprint = {
    version: 1,
    issue_codes: issues.map(issue => issue.code).sort(),
    start_mileage: numberValue(trip.start_mileage),
    end_mileage: numberValue(trip.end_mileage),
    battery_before: numberValue(trip.battery_before),
    battery_after: numberValue(trip.battery_after),
    previous_end_mileage: isEVTrip(trip) ? null : numberValue(trip.previousTrip?.end_mileage),
  }
  // Keep existing battery-only reviews compatible, but re-open an odometer
  // warning when the surrounding readings used to validate it change.
  if (issues.some(issue => EV_SEQUENCE_ISSUES.has(issue.code))) {
    fingerprint.ev_mileage_context = {
      previous_end_mileage: trip.parent_trip_log_id ? null : numberValue(trip.previousTrip?.end_mileage),
      next_start_mileage: trip.parent_trip_log_id ? null : numberValue(trip.nextTrip?.start_mileage),
      parent_start_mileage: numberValue(trip.parentTrip?.start_mileage),
      parent_end_mileage: trip.parentTrip?.is_completed ? numberValue(trip.parentTrip.end_mileage) : null,
    }
  }
  return JSON.stringify(fingerprint)
}

export const anomalyReviewKey = (tripId, fingerprint) => `${tripId}:${fingerprint}`

export function buildAnomalyReviewSet(reviews = []) {
  return new Set(reviews.map(review => anomalyReviewKey(review.trip_log_id, review.issue_fingerprint)))
}

export function isTripAnomalyReviewed(trip, reviewSet, issues = getTripIssues(trip)) {
  const fingerprint = getIssueFingerprint(trip, issues)
  return Boolean(fingerprint && reviewSet.has(anomalyReviewKey(trip.id, fingerprint)))
}

export function isRelevantMileageLog(trip) {
  return isEVTrip(trip) || hasValue(trip.start_mileage)
}

export function countPendingAnomalies(logs = [], reviews = []) {
  const reviewSet = buildAnomalyReviewSet(reviews)
  return buildTripSequence(logs).reduce((count, trip) => {
    if (!isRelevantMileageLog(trip)) return count
    const issues = getTripIssues(trip)
    return count + (issues.length > 0 && !isTripAnomalyReviewed(trip, reviewSet, issues) ? 1 : 0)
  }, 0)
}
