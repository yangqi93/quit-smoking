/**
 * calculator.js 单元测试
 * 测试戒烟计算器的核心逻辑
 */

const {
  calcQuitDuration,
  calcMoneySaved,
  calcCigarettesAvoided,
  calcLifeRegained,
  getNextMilestone,
  getHealthMilestones,
  formatDuration,
  getEncouragement
} = require('../utils/calculator')

describe('calcQuitDuration - 计算戒烟时长', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2025-07-15T12:00:00'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('计算1天前戒烟的时长', () => {
    const result = calcQuitDuration('2025-07-14T12:00:00')
    expect(result.days).toBe(1)
    expect(result.hours).toBe(24)
    expect(result.totalMinutes).toBe(1440)
  })

  test('计算7天前戒烟的时长', () => {
    const result = calcQuitDuration('2025-07-08T12:00:00')
    expect(result.days).toBe(7)
    expect(result.totalMinutes).toBe(7 * 24 * 60)
  })

  test('计算0天（当天戒烟）', () => {
    const result = calcQuitDuration('2025-07-15T12:00:00')
    expect(result.days).toBe(0)
    expect(result.hours).toBe(0)
    expect(result.totalMinutes).toBe(0)
  })

  test('未来日期返回全0', () => {
    const result = calcQuitDuration('2025-07-16T12:00:00')
    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, totalMinutes: 0 })
  })

  test('传入时间戳数字也能正常计算', () => {
    const timestamp = new Date('2025-07-14T12:00:00').getTime()
    const result = calcQuitDuration(timestamp)
    expect(result.days).toBe(1)
  })

  test('跨月计算', () => {
    const result = calcQuitDuration('2025-06-15T12:00:00')
    expect(result.days).toBe(30)
  })
})

describe('calcMoneySaved - 计算省钱金额', () => {
  test('基本计算：20支/天，20元/包，20支/包，1天', () => {
    // 每支1元，20支*1元*1天 = 20
    const result = calcMoneySaved(1, 20, 20, 20)
    expect(result).toBe(20)
  })

  test('10支/天，15元/包，20支/包，7天', () => {
    // 每支 15/20 = 0.75元，10*0.75*7 = 52.5
    const result = calcMoneySaved(7, 10, 15, 20)
    expect(result).toBe(52.5)
  })

  test('默认每包20支（cigarettesPerPack 省略）', () => {
    // 省略第4参数，默认20支/包
    const result = calcMoneySaved(1, 20, 20)
    expect(result).toBe(20)
  })

  test('0天戒烟省0元', () => {
    const result = calcMoneySaved(0, 20, 20, 20)
    expect(result).toBe(0)
  })

  test('0支/天省0元', () => {
    const result = calcMoneySaved(30, 0, 20, 20)
    expect(result).toBe(0)
  })

  test('金额精度：四舍五入到2位小数', () => {
    // 13元/包, 20支/包 => 0.65/支; 7支/天 * 0.65 * 3天 = 13.65
    const result = calcMoneySaved(3, 7, 13, 20)
    expect(result).toBe(13.65)
  })

  test('大金额计算', () => {
    // 365天，30支/天，50元/包，20支/包 => 2.5元/支 => 30*2.5*365 = 27375
    const result = calcMoneySaved(365, 30, 50, 20)
    expect(result).toBe(27375)
  })
})

describe('calcCigarettesAvoided - 计算少抽烟数', () => {
  test('基本计算', () => {
    expect(calcCigarettesAvoided(7, 20)).toBe(140)
  })

  test('0天', () => {
    expect(calcCigarettesAvoided(0, 20)).toBe(0)
  })

  test('0支/天', () => {
    expect(calcCigarettesAvoided(30, 0)).toBe(0)
  })

  test('1天1支', () => {
    expect(calcCigarettesAvoided(1, 1)).toBe(1)
  })
})

describe('calcLifeRegained - 计算重获生命时长', () => {
  test('1支烟 ≈ 0.2小时', () => {
    // 1 * 11 / 60 = 0.1833... => round to 0.2
    expect(calcLifeRegained(1)).toBe(0.2)
  })

  test('20支烟', () => {
    // 20 * 11 / 60 = 3.6667 => round to 3.7
    expect(calcLifeRegained(20)).toBe(3.7)
  })

  test('0支烟', () => {
    expect(calcLifeRegained(0)).toBe(0)
  })

  test('100支烟', () => {
    // 100 * 11 / 60 = 18.3333 => round to 18.3
    expect(calcLifeRegained(100)).toBe(18.3)
  })

  test('精确到1位小数', () => {
    const result = calcLifeRegained(55)
    // 55 * 11 / 60 = 10.0833 => round to 10.1
    expect(result).toBe(10.1)
  })
})

describe('getNextMilestone - 获取下一个里程碑', () => {
  test('第0天 → 第1天', () => {
    const result = getNextMilestone(0)
    expect(result.title).toBe('第1天')
    expect(result.daysLeft).toBe(1)
    expect(result.targetDays).toBe(1)
  })

  test('第1天 → 第3天', () => {
    const result = getNextMilestone(1)
    expect(result.title).toBe('第3天')
    expect(result.daysLeft).toBe(2)
    expect(result.targetDays).toBe(3)
  })

  test('第6天 → 一周', () => {
    const result = getNextMilestone(6)
    expect(result.title).toBe('一周')
    expect(result.daysLeft).toBe(1)
    expect(result.targetDays).toBe(7)
  })

  test('第30天 → 三个月', () => {
    const result = getNextMilestone(30)
    expect(result.title).toBe('三个月')
    expect(result.daysLeft).toBe(60)
    expect(result.targetDays).toBe(90)
  })

  test('超过所有里程碑 → 传奇', () => {
    const result = getNextMilestone(4000)
    expect(result.title).toBe('传奇')
    expect(result.daysLeft).toBe(0)
    expect(result.targetDays).toBe(4000)
  })

  test('恰好在里程碑上 → 返回下一个', () => {
    // 第7天应该返回两周（14天）
    const result = getNextMilestone(7)
    expect(result.title).toBe('两周')
    expect(result.daysLeft).toBe(7)
  })
})

describe('getHealthMilestones - WHO健康恢复时间线', () => {
  test('返回数组', () => {
    const milestones = getHealthMilestones()
    expect(Array.isArray(milestones)).toBe(true)
  })

  test('包含至少10个里程碑', () => {
    const milestones = getHealthMilestones()
    expect(milestones.length).toBeGreaterThanOrEqual(10)
  })

  test('第一个是"开始戒烟"', () => {
    const milestones = getHealthMilestones()
    expect(milestones[0].title).toBe('开始戒烟')
    expect(milestones[0].hours).toBe(0)
  })

  test('里程碑按 hours 升序排列', () => {
    const milestones = getHealthMilestones()
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].hours).toBeGreaterThan(milestones[i - 1].hours)
    }
  })

  test('每个里程碑有 hours, title, desc, category', () => {
    const milestones = getHealthMilestones()
    milestones.forEach(m => {
      expect(m).toHaveProperty('hours')
      expect(m).toHaveProperty('title')
      expect(m).toHaveProperty('desc')
      expect(m).toHaveProperty('category')
    })
  })

  test('category 合法值', () => {
    const validCategories = ['immediate', 'short', 'medium', 'long']
    const milestones = getHealthMilestones()
    milestones.forEach(m => {
      expect(validCategories).toContain(m.category)
    })
  })
})

describe('formatDuration - 格式化时长', () => {
  test('小于24小时显示"小时"', () => {
    expect(formatDuration(8)).toBe('8小时')
    expect(formatDuration(0.5)).toBe('1小时') // Math.round(0.5) = 1
  })

  test('1天~29天显示"天"', () => {
    expect(formatDuration(24)).toBe('1天')
    expect(formatDuration(72)).toBe('3天')
    // 720小时 = 30天，30天进入"个月"分支（days < 30 为 false）
    expect(formatDuration(696)).toBe('29天') // 696/24 = 29天
  })

  test('1~11个月显示"个月"', () => {
    // 30*24 = 720小时 = 30天 = 1个月
    expect(formatDuration(744)).toBe('1个月')  // 31天 => 31/30 = 1.033 => round 1
  })

  test('12个月以上显示"年"', () => {
    // 365天 = 8760小时 => 365/30 = 12.17月 => 12.17/12 = 1.0年
    expect(formatDuration(8760)).toBe('1.0年')
  })
})

describe('getEncouragement - 戒烟鼓励语', () => {
  test('第0天', () => {
    expect(getEncouragement(0)).toContain('第一天')
  })

  test('第1天', () => {
    expect(getEncouragement(1)).toContain('第一天')
  })

  test('第2天', () => {
    expect(getEncouragement(2)).toContain('关键期')
  })

  test('第5天', () => {
    expect(getEncouragement(5)).toContain('戒断期')
  })

  test('第10天', () => {
    expect(getEncouragement(10)).toContain('恢复')
  })

  test('第20天', () => {
    expect(getEncouragement(20)).toContain('勇士')
  })

  test('第60天', () => {
    expect(getEncouragement(60)).toContain('肺功能')
  })

  test('第120天', () => {
    expect(getEncouragement(120)).toContain('运动耐力')
  })

  test('第200天', () => {
    expect(getEncouragement(200)).toContain('不再想')
  })

  test('第400天', () => {
    expect(getEncouragement(400)).toContain('冠心病')
  })

  test('第800天（传奇）', () => {
    expect(getEncouragement(800)).toContain('传奇')
  })
})
