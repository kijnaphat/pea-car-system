const THAI_ZERO_CODE_POINT = '๐'.codePointAt(0)

export function normalizeStaffCode(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[๐-๙]/g, digit => String(digit.codePointAt(0) - THAI_ZERO_CODE_POINT))
    .replace(/[^0-9]/g, '')
    .slice(0, 7)
}
