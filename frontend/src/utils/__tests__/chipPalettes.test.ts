import {
  canonicalPairKey,
  chipSwatch,
  GENDER_COLORS,
  NO_COUPLE,
  RELIGION_COLORS,
  buildCoupleNumbers,
  coupleNumber,
} from '../chipPalettes'

describe('canonicalPairKey', () => {
  it('is order-independent', () => {
    expect(canonicalPairKey('Bob', 'Alice')).toBe(canonicalPairKey('Alice', 'Bob'))
  })
})

describe('chipSwatch', () => {
  const alice = { name: 'Alice', religion: 'Muslim', gender: 'Female', partner: null }

  it('colours by religion by default', () => {
    expect(chipSwatch('religion', alice)).toEqual(RELIGION_COLORS.Muslim)
  })

  it('falls back to Other for an unknown religion', () => {
    expect(chipSwatch('religion', { ...alice, religion: 'Zoroastrian' })).toEqual(
      RELIGION_COLORS.Other
    )
  })

  it('colours by gender', () => {
    expect(chipSwatch('gender', alice)).toEqual(GENDER_COLORS.Female)
    expect(chipSwatch('gender', { ...alice, gender: 'Nonbinary' })).toEqual(GENDER_COLORS.Other)
  })

  it('gives every chip the neutral swatch in couples focus, partnered or not', () => {
    expect(chipSwatch('couples', alice)).toEqual(NO_COUPLE)
    expect(chipSwatch('couples', { ...alice, partner: 'Bob' })).toEqual(NO_COUPLE)
  })
})

describe('buildCoupleNumbers / coupleNumber', () => {
  it('gives both partners the same number', () => {
    const people = [
      { name: 'Alice', partner: 'Bob' },
      { name: 'Bob', partner: 'Alice' },
    ]
    const numbers = buildCoupleNumbers(people)
    expect(coupleNumber('Alice', 'Bob', numbers)).toBe(coupleNumber('Bob', 'Alice', numbers))
  })

  it('gives distinct couples distinct, 1-indexed numbers', () => {
    const people = [
      { name: 'Alice', partner: 'Bob' },
      { name: 'Bob', partner: 'Alice' },
      { name: 'Cara', partner: 'Dan' },
      { name: 'Dan', partner: 'Cara' },
      { name: 'Eve', partner: 'Finn' },
      { name: 'Finn', partner: 'Eve' },
    ]
    const numbers = buildCoupleNumbers(people)
    const ab = coupleNumber('Alice', 'Bob', numbers)
    const cd = coupleNumber('Cara', 'Dan', numbers)
    const ef = coupleNumber('Eve', 'Finn', numbers)
    expect(new Set([ab, cd, ef]).size).toBe(3)
    expect([ab, cd, ef].every(n => n !== undefined && n >= 1)).toBe(true)
  })

  it('returns undefined for a pair with no assigned number', () => {
    const numbers = buildCoupleNumbers([{ name: 'Alice', partner: 'Bob' }])
    expect(coupleNumber('Alice', 'Zed', numbers)).toBeUndefined()
  })
})
