import { chipSwatch, GENDER_COLORS, RELIGION_COLORS } from '../chipPalettes'

describe('chipSwatch', () => {
  const alice = { religion: 'Muslim', gender: 'Female' }

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
})
