/**
 * Sri Lankan NIC (National Identity Card) Validation Utilities
 * Supports both old format (9 digits + V) and new format (12 digits)
 */

export interface NICInfo {
  isValid: boolean
  birthDate?: Date
  gender?: 'male' | 'female'
  errorMessage?: string
}

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 == 0) && (year % 100 != 0 || year % 400 == 0)
}

/**
 * Calculate birth date from year and day number considering leap years
 * NIC day counting: January 1st = day 1, January 2nd = day 2, etc.
 * We subtract 1 to convert to 0-indexed, then subtract 1 more as per NIC standard
 */
function calculateBirthDate(year: number, dayOfYear: number): Date {
  const leap = isLeapYear(year)
  const maxDays = leap ? 366 : 365
  
  // Validate day of year
  if (dayOfYear < 1 || dayOfYear > maxDays) {
    throw new Error(`Invalid day of year: ${dayOfYear} for year ${year}`)
  }

  // Subtract 2 from the day count (1 for 0-indexing, 1 more for NIC standard)
  const adjustedDays = dayOfYear - 2

  // Days in each month (accounting for leap year)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  
  let remainingDays = adjustedDays
  let month = 0
  let day = 1
  
  // Find the month and day
  for (let i = 0; i < daysInMonth.length; i++) {
    if (remainingDays < daysInMonth[i]) {
      month = i
      day = remainingDays + 1
      break
    }
    remainingDays -= daysInMonth[i]
  }
  
  // Create date at noon UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0, 0))
  return date
}

/**
 * Extract birth date and gender from Sri Lankan NIC
 * Old format: 123456789V (9 digits + V)
 * New format: 123456789012 (12 digits)
 */
export function validateSriLankanNIC(nic: string): NICInfo {
  if (!nic) {
    return { isValid: false, errorMessage: 'NIC is required' }
  }

  // Remove spaces and convert to uppercase
  const cleanNIC = nic.replace(/\s/g, '').toUpperCase()

  // Check if it's old format (9 digits + V) or new format (12 digits)
  const oldFormatRegex = /^[0-9]{9}[Vv]$/
  const newFormatRegex = /^[0-9]{12}$/

  if (oldFormatRegex.test(cleanNIC)) {
    return parseOldFormatNIC(cleanNIC)
  } else if (newFormatRegex.test(cleanNIC)) {
    return parseNewFormatNIC(cleanNIC)
  } else {
    return {
      isValid: false,
      errorMessage: 'Invalid NIC format. Use format: 123456789V or 123456789012',
    }
  }
}

/**
 * Parse old format NIC (9 digits + V)
 * Format: YYDDDFXXXXV
 * YY = Year (last 2 digits)
 * DDD = Days from Jan 1st (add 500 for females)
 */
function parseOldFormatNIC(nic: string): NICInfo {
  try {
    const year = parseInt(nic.substring(0, 2))
    let days = parseInt(nic.substring(2, 5))

    // Determine gender (days > 500 means female)
    let gender: 'male' | 'female' = 'male'
    if (days > 500) {
      gender = 'female'
      days -= 500
    }

    // Calculate full year (assume 1900s for >50, 2000s for <=50)
    const fullYear = year > 50 ? 1900 + year : 2000 + year

    // Validate day count considering leap year
    const maxDays = isLeapYear(fullYear) ? 366 : 365
    if (days < 1 || days > maxDays) {
      return { 
        isValid: false, 
        errorMessage: `Invalid day count (${days}) for ${isLeapYear(fullYear) ? 'leap' : 'non-leap'} year ${fullYear}. Must be 1-${maxDays}` 
      }
    }

    // Validate original days including gender offset (1-366 for males, 501-866 for females)
    const originalDays = parseInt(nic.substring(2, 5))
    const maxOriginalDays = isLeapYear(fullYear) ? 366 : 365
    if (gender === 'male' && (originalDays < 1 || originalDays > maxOriginalDays)) {
      return { isValid: false, errorMessage: `Invalid day count in NIC for male in year ${fullYear}` }
    }
    if (gender === 'female' && (originalDays < 501 || originalDays > (500 + maxOriginalDays))) {
      return { isValid: false, errorMessage: `Invalid day count in NIC for female in year ${fullYear}` }
    }

    // Calculate birth date using leap year aware function
    const birthDate = calculateBirthDate(fullYear, days)

    return {
      isValid: true,
      birthDate,
      gender,
    }
  } catch (error) {
    return { isValid: false, errorMessage: error instanceof Error ? error.message : 'Error parsing NIC' }
  }
}

/**
 * Parse new format NIC (12 digits)
 * Format: YYYYDDDXXXXXXX
 * YYYY = Year (full 4 digits)
 * DDD = Days from Jan 1st (add 500 for females)
 */
function parseNewFormatNIC(nic: string): NICInfo {
  try {
    const year = parseInt(nic.substring(0, 4))
    let days = parseInt(nic.substring(4, 7))

    // Determine gender (days > 500 means female)
    let gender: 'male' | 'female' = 'male'
    if (days > 500) {
      gender = 'female'
      days -= 500
    }

    // Validate year range
    if (year < 1900 || year > new Date().getFullYear()) {
      return { isValid: false, errorMessage: 'Invalid year in NIC' }
    }

    // Validate day count considering leap year
    const maxDays = isLeapYear(year) ? 366 : 365
    if (days < 1 || days > maxDays) {
      return { 
        isValid: false, 
        errorMessage: `Invalid day count (${days}) for ${isLeapYear(year) ? 'leap' : 'non-leap'} year ${year}. Must be 1-${maxDays}` 
      }
    }

    // Validate original days including gender offset (1-366 for males, 501-866 for females)
    const originalDays = parseInt(nic.substring(4, 7))
    const maxOriginalDays = isLeapYear(year) ? 366 : 365
    if (gender === 'male' && (originalDays < 1 || originalDays > maxOriginalDays)) {
      return { isValid: false, errorMessage: `Invalid day count in NIC for male in year ${year}` }
    }
    if (gender === 'female' && (originalDays < 501 || originalDays > (500 + maxOriginalDays))) {
      return { isValid: false, errorMessage: `Invalid day count in NIC for female in year ${year}` }
    }

    // Calculate birth date using leap year aware function
    const birthDate = calculateBirthDate(year, days)

    return {
      isValid: true,
      birthDate,
      gender,
    }
  } catch (error) {
    return { isValid: false, errorMessage: error instanceof Error ? error.message : 'Error parsing NIC' }
  }
}

/**
 * Validate if the provided birthdate and gender match the NIC
 */
export function validateNICMatch(
  nic: string,
  birthDate: string,
  gender: string
): { isValid: boolean; errorMessage?: string } {
  const nicInfo = validateSriLankanNIC(nic)

  if (!nicInfo.isValid) {
    return { isValid: false, errorMessage: nicInfo.errorMessage }
  }

  // Compare birthdate
  const providedDate = new Date(birthDate + 'T12:00:00.000Z') // Parse as UTC
  const nicDate = nicInfo.birthDate!

  if (
    providedDate.getUTCFullYear() !== nicDate.getUTCFullYear() ||
    providedDate.getUTCMonth() !== nicDate.getUTCMonth() ||
    providedDate.getUTCDate() !== nicDate.getUTCDate()
  ) {
    return {
      isValid: false,
      errorMessage: 'Birth date does not match NIC',
    }
  }

  // Compare gender
  if (gender.toLowerCase() !== nicInfo.gender) {
    return {
      isValid: false,
      errorMessage: 'Gender does not match NIC',
    }
  }

  return { isValid: true }
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDateForInput(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
