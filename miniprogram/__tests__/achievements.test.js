// __tests__/achievements.test.js
const {
  ACHIEVEMENTS,
  calcUnlockedIds,
  getAchievementsWithStatus,
  detectNewAchievements
} = require('../utils/achievements')

describe('ACHIEVEMENTS 定义', () => {
  test('至少有15个成就', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15)
  })

  test('每个成就都有必填字段', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a).toHaveProperty('id')
      expect(a).toHaveProperty('icon')
      expect(a).toHaveProperty('title')
      expect(a).toHaveProperty('desc')
      expect(a).toHaveProperty('category')
      expect(typeof a.condition).toBe('function')
    }
  })

  test('id 不重复', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  test('category 只有合法值', () => {
    const valid = new Set(['time', 'money', 'health', 'special'])
    for (const a of ACHIEVEMENTS) {
      expect(valid.has(a.category)).toBe(true)
    }
  })
})

describe('calcUnlockedIds', () => {
  test('新手：days=0 时什么都未解锁', () => {
    const ids = calcUnlockedIds({ days: 0, moneySaved: 0, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toHaveLength(0)
  })

  test('第1天解锁 day_1', () => {
    const ids = calcUnlockedIds({ days: 1, moneySaved: 0, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toContain('day_1')
  })

  test('7天解锁 day_1 / day_3 / day_7', () => {
    const ids = calcUnlockedIds({ days: 7, moneySaved: 0, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toContain('day_1')
    expect(ids).toContain('day_3')
    expect(ids).toContain('day_7')
    expect(ids).not.toContain('day_14')
  })

  test('30天时金钱类按 moneySaved 独立计算', () => {
    const ids = calcUnlockedIds({ days: 30, moneySaved: 200, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toContain('money_100')
    expect(ids).not.toContain('money_500')
  })

  test('moneySaved=5000 解锁所有金钱成就', () => {
    const ids = calcUnlockedIds({ days: 0, moneySaved: 5000, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toContain('money_100')
    expect(ids).toContain('money_500')
    expect(ids).toContain('money_1000')
    expect(ids).toContain('money_5000')
  })

  test('cigarettesAvoided=1000 解锁所有烟支成就', () => {
    const ids = calcUnlockedIds({ days: 0, moneySaved: 0, cigarettesAvoided: 1000, checkins: 0 })
    expect(ids).toContain('cig_100')
    expect(ids).toContain('cig_500')
    expect(ids).toContain('cig_1000')
  })

  test('checkins=7 解锁打卡新手+打卡达人', () => {
    const ids = calcUnlockedIds({ days: 0, moneySaved: 0, cigarettesAvoided: 0, checkins: 7 })
    expect(ids).toContain('checkin_3')
    expect(ids).toContain('checkin_7')
    expect(ids).not.toContain('checkin_30')
  })

  test('365天解锁所有时间类成就', () => {
    const ids = calcUnlockedIds({ days: 365, moneySaved: 0, cigarettesAvoided: 0, checkins: 0 })
    expect(ids).toContain('day_1')
    expect(ids).toContain('day_7')
    expect(ids).toContain('day_30')
    expect(ids).toContain('day_90')
    expect(ids).toContain('day_180')
    expect(ids).toContain('day_365')
    expect(ids).not.toContain('day_730')
  })
})

describe('getAchievementsWithStatus', () => {
  test('返回完整成就列表，长度与 ACHIEVEMENTS 相同', () => {
    const list = getAchievementsWithStatus([])
    expect(list.length).toBe(ACHIEVEMENTS.length)
  })

  test('空 unlockedIds 时所有 unlocked = false', () => {
    const list = getAchievementsWithStatus([])
    expect(list.every(a => a.unlocked === false)).toBe(true)
  })

  test('传入 [day_1] 时只有 day_1 的 unlocked = true', () => {
    const list = getAchievementsWithStatus(['day_1'])
    const day1 = list.find(a => a.id === 'day_1')
    expect(day1.unlocked).toBe(true)
    const others = list.filter(a => a.id !== 'day_1')
    expect(others.every(a => a.unlocked === false)).toBe(true)
  })

  test('保留原始字段（icon/title/desc/category）', () => {
    const list = getAchievementsWithStatus(['day_7'])
    const a = list.find(a => a.id === 'day_7')
    expect(a.icon).toBeTruthy()
    expect(a.title).toBeTruthy()
    expect(a.desc).toBeTruthy()
    expect(a.category).toBe('time')
  })
})

describe('detectNewAchievements', () => {
  test('全新解锁：prevIds 为空时，currentIds 全是新的', () => {
    const newOnes = detectNewAchievements([], ['day_1', 'day_3'])
    expect(newOnes).toHaveLength(2)
    expect(newOnes.map(a => a.id)).toContain('day_1')
    expect(newOnes.map(a => a.id)).toContain('day_3')
  })

  test('没有新解锁时返回空数组', () => {
    const newOnes = detectNewAchievements(['day_1'], ['day_1'])
    expect(newOnes).toHaveLength(0)
  })

  test('只返回本次新增的成就', () => {
    const newOnes = detectNewAchievements(['day_1', 'day_3'], ['day_1', 'day_3', 'day_7'])
    expect(newOnes).toHaveLength(1)
    expect(newOnes[0].id).toBe('day_7')
  })

  test('返回的是完整成就对象（含 icon/title）', () => {
    const newOnes = detectNewAchievements([], ['day_30'])
    expect(newOnes[0]).toHaveProperty('icon')
    expect(newOnes[0]).toHaveProperty('title')
    expect(newOnes[0]).toHaveProperty('desc')
  })
})
