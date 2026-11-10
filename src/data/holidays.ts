/** Northern Ireland bank holidays, including substitute days. */
export const NI_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-03-17': "St Patrick's Day",
  '2026-04-03': 'Good Friday',
  '2026-04-06': 'Easter Monday',
  '2026-05-04': 'Early May bank holiday',
  '2026-05-25': 'Spring bank holiday',
  '2026-07-13': 'Battle of the Boyne (substitute day)',
  '2026-08-31': 'Summer bank holiday',
  '2026-12-25': 'Christmas Day',
  '2026-12-28': 'Boxing Day (substitute day)',

  '2027-01-01': "New Year's Day",
  '2027-03-17': "St Patrick's Day",
  '2027-03-26': 'Good Friday',
  '2027-03-29': 'Easter Monday',
  '2027-05-03': 'Early May bank holiday',
  '2027-05-31': 'Spring bank holiday',
  '2027-07-12': 'Battle of the Boyne',
  '2027-08-30': 'Summer bank holiday',
  '2027-12-27': 'Christmas Day (substitute day)',
  '2027-12-28': 'Boxing Day (substitute day)',

  '2028-01-03': "New Year's Day (substitute day)",
  '2028-03-17': "St Patrick's Day",
  '2028-04-14': 'Good Friday',
  '2028-04-17': 'Easter Monday',
  '2028-05-01': 'Early May bank holiday',
  '2028-05-29': 'Spring bank holiday',
  '2028-07-12': 'Battle of the Boyne',
  '2028-08-28': 'Summer bank holiday',
  '2028-12-25': 'Christmas Day',
  '2028-12-26': 'Boxing Day',

  '2029-01-01': "New Year's Day",
  '2029-03-19': "St Patrick's Day (substitute day)",
  '2029-03-30': 'Good Friday',
  '2029-04-02': 'Easter Monday',
  '2029-05-07': 'Early May bank holiday',
  '2029-05-28': 'Spring bank holiday',
  '2029-07-12': 'Battle of the Boyne',
  '2029-08-27': 'Summer bank holiday',
  '2029-12-25': 'Christmas Day',
  '2029-12-26': 'Boxing Day',
}

export function holidayName(isoDate: string): string | undefined {
  return NI_HOLIDAYS[isoDate]
}

export function isNiHoliday(isoDate: string): boolean {
  return Boolean(NI_HOLIDAYS[isoDate])
}
