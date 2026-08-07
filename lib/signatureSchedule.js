export function getSignatureSchedule(referenceDate = new Date()) {
  const date = new Date(referenceDate)
  const currentDay = date.getDate()
  const isOpen = currentDay >= 28 || currentDay <= 5
  const start = currentDay <= 5
    ? new Date(date.getFullYear(), date.getMonth() - 1, 28)
    : new Date(date.getFullYear(), date.getMonth(), 28)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 5)
  const formatDate = value => value.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const startText = formatDate(start)
  const endText = formatDate(end)

  return {
    isOpen,
    start,
    end,
    startText,
    endText,
    periodText: `${startText} – ${endText}`,
    reportMonth: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    monthText: start.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
  }
}
