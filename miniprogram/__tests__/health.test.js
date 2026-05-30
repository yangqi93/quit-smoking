// __tests__/health.test.js - 健康页面逻辑测试
let pageInstance = null
global.Page = function (config) { pageInstance = config }

const calc = require('../utils/calculator')
const storage = require('../utils/storage')
const api = require('../utils/api')

global.wx = { showToast: jest.fn(), showShareMenu: jest.fn() }

jest.mock('../utils/calculator')
jest.mock('../utils/storage')
jest.mock('../utils/api')
jest.mock('../utils/theme', () => ({
  mixin: (def) => def,  // 测试中跳过 onLoad/onShow 包装
  getMode: jest.fn(() => 'auto'),
  getCurrentClass: jest.fn(() => ''),
  getThemeLabel: jest.fn(() => '跟随系统'),
  setMode: jest.fn(),
  resolveThemeClass: jest.fn(() => ''),
  STORAGE_KEY: 'themeMode'
}))

describe('健康 health 页面', () => {
  let methods = {}

  beforeEach(() => {
    jest.clearAllMocks()
    pageInstance = null
    delete require.cache[require.resolve('../pages/health/health.js')]
    require('../pages/health/health.js')
    methods = pageInstance || {}
  })

  const makePage = (overrides = {}) => {
    const data = {
      isActive: false, hoursElapsed: 0, timeline: [],
      achievedCount: 0, totalCount: 0, progressPercent: 0,
      ...overrides
    }
    const page = { data }
    Object.keys(methods).forEach(k => {
      if (typeof methods[k] === 'function') page[k] = methods[k].bind(page)
    })
    page.setData = function (d) { Object.assign(this.data, d) }
    return page
  }

  describe('loadTimeline', () => {
    test('无戒烟记录时设置 isActive 为 false', () => {
      storage.getQuitRecord.mockReturnValue(null)
      const p = makePage()
      p.loadTimeline()
      expect(p.data.isActive).toBe(false)
    })

    test('有记录时计算时间线', () => {
      storage.getQuitRecord.mockReturnValue({ quitDate: Date.now() - 48 * 3600000 })
      calc.calcQuitDuration.mockReturnValue({ days: 2, hours: 48, minutes: 0 })
      calc.getHealthMilestones.mockReturnValue([
        { hours: 8, title: '血压开始下降', emoji: '❤️', category: 'heart' },
        { hours: 24, title: '一氧化碳排出', emoji: '🫁', category: 'lung' },
        { hours: 72, title: '呼吸更顺畅', emoji: '🌬️', category: 'lung' }
      ])
      calc.formatDuration.mockReturnValue('1天')

      const p = makePage()
      p.loadTimeline()

      expect(p.data.isActive).toBe(true)
      expect(p.data.hoursElapsed).toBe(48)
      expect(p.data.timeline.length).toBe(3)
      expect(p.data.achievedCount).toBe(2)
      expect(p.data.timeline[0].achieved).toBe(true)
      expect(p.data.timeline[2].achieved).toBe(false)
    })

    test('进度百分比计算正确', () => {
      storage.getQuitRecord.mockReturnValue({ quitDate: Date.now() - 12 * 3600000 })
      calc.calcQuitDuration.mockReturnValue({ days: 0, hours: 12, minutes: 0 })
      calc.getHealthMilestones.mockReturnValue([
        { hours: 8, title: '血压开始下降', emoji: '❤️', category: 'heart' },
        { hours: 24, title: '一氧化碳排出', emoji: '🫁', category: 'lung' }
      ])
      calc.formatDuration.mockReturnValue('12小时')

      const p = makePage()
      p.loadTimeline()

      expect(p.data.achievedCount).toBe(1)
      expect(p.data.progressPercent).toBe(50)
    })
  })

  describe('refreshFromServer', () => {
    test('成功刷新时更新时间线', async () => {
      api.getHealthTimeline.mockResolvedValue({
        milestones: [
          { hours: 8, title: '血压开始下降', achieved: true },
          { hours: 24, title: '一氧化碳排出', achieved: false }
        ]
      })
      const p = makePage()
      await p.refreshFromServer()
      expect(p.data.timeline.length).toBe(2)
      expect(p.data.achievedCount).toBe(1)
      expect(p.data.progressPercent).toBe(50)
    })

    test('API 失败时 catch 不抛异常', async () => {
      api.getHealthTimeline.mockRejectedValue(new Error('网络错误'))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const p = makePage()
      await expect(p.refreshFromServer()).resolves.not.toThrow()
      warnSpy.mockRestore()
    })
  })
})
