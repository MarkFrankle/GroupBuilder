import {
  canonicalPairKey,
  chipSwatch,
  COUPLE_PALETTE,
  GENDER_COLORS,
  NO_COUPLE,
  paletteSlot,
  RELIGION_COLORS,
} from '../chipPalettes'

describe('canonicalPairKey / paletteSlot', () => {
  it('is order-independent', () => {
    expect(canonicalPairKey('Bob', 'Alice')).toBe(canonicalPairKey('Alice', 'Bob'))
    expect(paletteSlot(canonicalPairKey('Bob', 'Alice'))).toBe(
      paletteSlot(canonicalPairKey('Alice', 'Bob'))
    )
  })

  it('lands inside the palette', () => {
    const slot = paletteSlot(canonicalPairKey('Alice', 'Bob'))
    expect(slot).toBeGreaterThanOrEqual(0)
    expect(slot).toBeLessThan(COUPLE_PALETTE.length)
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

  it('gives a partnerless person the neutral chip in couples focus', () => {
    expect(chipSwatch('couples', alice)).toEqual(NO_COUPLE)
  })

  it('gives both partners the same colour in couples focus', () => {
    const bob = { name: 'Bob', religion: 'Jewish', gender: 'Male', partner: 'Alice' }
    const alicePartnered = { ...alice, partner: 'Bob' }
    expect(chipSwatch('couples', bob)).toEqual(chipSwatch('couples', alicePartnered))
  })
})
