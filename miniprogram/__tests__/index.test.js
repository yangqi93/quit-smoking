// __tests__/index.test.js - 首页逻辑测试
// 必须在 require 页面之前 mock Page
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
  mixin: (def) => def,
  getMode: jest.fn(() => 'auto'),
  getCurrentClass: jest.fn(() => ''),
  getThemeLabel: jest.fn(() => '跟随系统'),
  setMode: jest.fn(),
  resolveThemeClass: jest.fn(() => ''),
  STORAGE_KEY: 'themeMode'
}))

describe('首页 index 逻辑', () => {
  let methods = {}

  beforeEach(() => {
    jest.clearAllMocks()
    pageInstance = null
    delete require.cache[require.resolve('../pages/index/index.js')]
    require('../pages/index/index.js')
    methods = pageInstance || {}
  })

  afterEach(() => {
    if (methods._timer) { clearInterval(methods._timer); methods._timer = null }
  })

  const makePage = (overrides = {}) => {
    const data = {
      hasActiveRecord: false, days: 0, hours: 0, minutes: 0,
      moneySaved: 0, cigarettesAvoided: 0, lifeRegained: 0,
      nextMilestone: '', milestoneDaysLeft: 0, milestoneProgress: 0,
      encouragement: '', nickName: '', _timer: null,
      ...overrides
    }
    const page = { data }
    Object.keys(methods).forEach(k => {
      if (typeof methods[k] === 'function') page[k] = methods[k].bind(page)
    })
    page.setData = function (d) { Object.assign(this.data, d) }
    return page
  }

  describe('initPage', () => {
    test('无戒烟记录时设置 hasActiveRecord 为 false', () => {
      storage.getQuitRecord.mockReturnValue(null)
      const p = makePage()
      p.initPage()
      expect(p.data.hasActiveRecord).toBe(false)
    })

    test('有戒烟记录时设置 hasActiveRecord 为 true', () => {
      storage.getQuitRecord.mockReturnValue({ quitDate: Date.now() - 3 * 86400000 })
      storage.getUserInfo.mockReturnValue({ nickName: '测试用户' })
      calc.calcQuitDuration.mockReturnValue({ days: 3, hours: 0, minutes: 0 })

      const p = makePage()
      p.initPage()
      expect(p.data.hasActiveRecord).toBe(true)
      expect(p.data.nickName).toBe('测试用户')
    })
  })

  describe('updateDashboard', () => {
    test('计算金钱节省', () => {
      storage.getQuitRecord.mockReturnValue({
        quitDate: Date.now() - 5 * 86400000,
        cigarettesPerDay: 20, pricePerPack: 25, cigarettesPerPack: 20
      })
      calc.calcQuitDuration.mockReturnValue({ days: 5, hours: 0, minutes: 0 })
      calc.calcMoneySaved.mockReturnValue(125)
      calc.getNextMilestone.mockReturnValue({ name: '24小时', hoursNeeded: 24, emoji: '🕐' })
      calc.formatDuration.mockReturnValue('19天')
      calc.getWHOMilestones.mockReturnValue([])

      const p = makePage({ hasActiveRecord: true })
      p.updateDashboard()
      expect(calc.calcMoneySaved).toHaveBeenCalled()
      expect(p.data.moneySaved).toBe(125)
    })
  })

  describe('生命周期', () => {
    test('onHide 清除计时器', () => {
      global.clearInterval = jest.fn()
      const p = makePage({ _timer: 123 })
      p.onHide()
      expect(global.clearInterval).toHaveBeenCalledWith(123)
    })

    test('onUnload 清除计时器', () => {
      global.clearInterval = jest.fn()
      const p = makePage({ _timer: 456 })
      p.onUnload()
      expect(global.clearInterval).toHaveBeenCalledWith(456)
    })
  })
})
