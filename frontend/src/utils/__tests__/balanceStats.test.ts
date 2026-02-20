import {
  expectedWithinTableDeviation,
  actualWithinTableDeviation,
  formatAttributeCounts,
} from '../balanceStats'

describe('expectedWithinTableDeviation', () => {
  it('returns 0 for equal gender counts', () => {
    expect(expectedWithinTableDeviation({ Female: 8, Male: 8 }, 4)).toBe(0)
  })

  it('returns 2 for 10F/6M across 4 tables', () => {
    expect(expectedWithinTableDeviation({ Female: 10, Male: 6 }, 4)).toBe(2)
  })

  it('returns 1 for 3-way split with dominant gender', () => {
    // ceil(8/4) - floor(4/4) = 2 - 1 = 1
    expect(expectedWithinTableDeviation({ Female: 8, Male: 4, 'Non-binary': 4 }, 4)).toBe(1)
  })

  it('returns 0 for single-gender roster', () => {
    expect(expectedWithinTableDeviation({ Female: 12 }, 4)).toBe(0)
  })

  it('returns 0 for empty counts', () => {
    expect(expectedWithinTableDeviation({}, 4)).toBe(0)
  })
})

describe('actualWithinTableDeviation', () => {
  it('returns 0 for perfectly balanced tables', () => {
    const tables = [
      { Female: 2, Male: 2 },
      { Female: 2, Male: 2 },
    ]
    expect(actualWithinTableDeviation(tables, ['Female', 'Male'])).toBe(0)
  })

  it('returns 2 for a 3F/1M table', () => {
    const tables = [
      { Female: 2, Male: 2 },
      { Female: 3, Male: 1 },
    ]
    expect(actualWithinTableDeviation(tables, ['Female', 'Male'])).toBe(2)
  })

  it('counts missing genders as 0', () => {
    // Table with only females — Male is in allValues but absent from table
    const tables = [{ Female: 4 }]
    expect(actualWithinTableDeviation(tables, ['Female', 'Male'])).toBe(4)
  })

  it('returns 0 for single-attribute roster', () => {
    const tables = [{ Female: 4 }, { Female: 4 }]
    expect(actualWithinTableDeviation(tables, ['Female'])).toBe(0)
  })
})

describe('formatAttributeCounts', () => {
  it('formats gender counts sorted by count descending', () => {
    expect(formatAttributeCounts({ Female: 10, Male: 6 })).toBe('10 Female / 6 Male')
  })

  it('formats with abbreviation', () => {
    expect(formatAttributeCounts({ Female: 10, Male: 6 }, true)).toBe('10F / 6M')
  })
})
