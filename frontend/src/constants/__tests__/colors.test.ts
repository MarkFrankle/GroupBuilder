import { getReligionStyle, BBT_COLORS } from '../colors'

describe('getReligionStyle', () => {
  it('returns blue family for Jewish', () => {
    const style = getReligionStyle('Jewish', 'Sarah')
    expect(style.backgroundColor).toMatch(/^#(D6F0FB|B0E0F6|8AD0F1|CCE8F4)$/)
    expect(style.color).toMatch(/^#00(5F83|4A66)$/)
  })

  it('returns red family for Christian', () => {
    const style = getReligionStyle('Christian', 'Alice')
    expect(style.backgroundColor).toMatch(/^#(FDE2E2|F9C4C4|F5A6A7|FCDADA)$/)
    expect(style.color).toMatch(/^#(8B1A1A|6B1414)$/)
  })

  it('returns green family for Muslim', () => {
    const style = getReligionStyle('Muslim', 'Ahmed')
    expect(style.backgroundColor).toMatch(/^#(E2F2DA|C6E5B8|AAD896|D8EDCF)$/)
    expect(style.color).toMatch(/^#(3D6625|2E4D1C)$/)
  })

  it('returns yellow family for Other', () => {
    const style = getReligionStyle('Other', 'Pat')
    expect(style.backgroundColor).toMatch(/^#(FEF0D8|FDE1B1|FCD28A|FDE9C5)$/)
    expect(style.color).toMatch(/^#(7A5410|5C3F0C)$/)
  })

  it('same name always gets same shade', () => {
    const style1 = getReligionStyle('Muslim', 'Ahmed')
    const style2 = getReligionStyle('Muslim', 'Ahmed')
    expect(style1).toEqual(style2)
  })

  it('different names can get different shades within same religion', () => {
    const styles = new Set(
      ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank']
        .map(name => getReligionStyle('Christian', name).backgroundColor)
    )
    expect(styles.size).toBeGreaterThan(1)
  })

  it('unknown religion falls back to Other colors', () => {
    const style = getReligionStyle('Zoroastrian', 'Cyrus')
    const otherStyle = getReligionStyle('Other', 'Cyrus')
    expect(style).toEqual(otherStyle)
  })

  it('flat mode returns consistent base color regardless of name', () => {
    const style1 = getReligionStyle('Jewish', 'Sarah', false)
    const style2 = getReligionStyle('Jewish', 'David', false)
    expect(style1).toEqual(style2)
    expect(style1.backgroundColor).toBe(BBT_COLORS.Jewish.bg)
  })
})
