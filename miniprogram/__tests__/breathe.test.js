// __tests__/breathe.test.js - 呼吸急救页面逻辑测试
let pageInstance = null
global.Page = function (config) { pageInstance = config }

const storage = require('../utils/storage')
const api = require('../utils/api')

global.wx = { showToast: jest.fn(), showShareMenu: jest.fn() }

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

describe('呼吸 breathe 页面', () => {
  let methods = {}
  let jestTimer = null

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    pageInstance = null
    delete require.cache[require.resolve('../pages/breathe/breathe.js')]
    require('../pages/breathe/breathe.js')
    methods = pageInstance || {}
  })

  afterEach(() => {
    jest.useRealTimers()
    if (jestTimer) { clearInterval(jestTimer); jestTimer = null }
  })

  const makePage = (overrides = {}) => {
    const data = {
      isBreathing: false, phase: 'ready',
      phaseText: '准备开始', phaseDesc: '当你感到烟瘾来袭时，跟随引导呼吸',
      inhaleTime: 4, holdTime: 7, exhaleTime: 8,
      circleScale: 1, circleOpacity: 0.6, countdown: 0,
      triggers: [
        { id: 'stress', label: '😰 压力大', selected: false },
        { id: 'social', label: '👥 社交场合', selected: false },
        { id: 'boredom', label: '😴 无聊', selected: false },
        { id: 'habit', label: '🔄 习惯性', selected: false },
        { id: 'other', label: '🤔 其他', selected: false }
      ],
      selectedTrigger: '', completedRounds: 0, totalRounds: 3, _timer: null,
      ...overrides
    }
    const page = { data }
    Object.keys(methods).forEach(k => {
      if (typeof methods[k] === 'function') page[k] = methods[k].bind(page)
    })
    page.setData = function (d) {
      Object.assign(this.data, d)
      if (d._timer !== undefined) { if (d._timer) jestTimer = d._timer; else jestTimer = null }
    }
    return page
  }

  describe('onSelectTrigger', () => {
    test('选择触发场景后更新 selectedTrigger', () => {
      const p = makePage()
      p.onSelectTrigger({ currentTarget: { dataset: { id: 'stress' } } })
      expect(p.data.selectedTrigger).toBe('stress')
      expect(p.data.triggers[0].selected).toBe(true)
    })

    test('选择不同场景时取消之前的选择', () => {
      const p = makePage({ selectedTrigger: 'stress', triggers: [
        { id: 'stress', label: '😰', selected: true },
        { id: 'boredom', label: '😴', selected: false },
        { id: 'social', label: '👥', selected: false },
        { id: 'habit', label: '🔄', selected: false },
        { id: 'other', label: '🤔', selected: false }
      ]})
      p.onSelectTrigger({ currentTarget: { dataset: { id: 'boredom' } } })
      expect(p.data.selectedTrigger).toBe('boredom')
      expect(p.data.triggers[0].selected).toBe(false)
      expect(p.data.triggers[1].selected).toBe(true)
    })
  })

  describe('onStartBreathe', () => {
    test('isBreathing 为 true 时不允许重复开始', () => {
      const p = makePage({ isBreathing: true })
      const spy = jest.spyOn(p, 'startInhale')
      p.onStartBreathe()
      expect(spy).not.toHaveBeenCalled()
    })

    test('开始时设置 isBreathing 为 true 且 completedRounds 为 0', () => {
      const p = makePage()
      p.onStartBreathe()
      expect(p.data.isBreathing).toBe(true)
      expect(p.data.completedRounds).toBe(0)
    })
  })

  describe('runCountdown', () => {
    test('倒计时结束回调', () => {
      const callback = jest.fn()
      const p = makePage()
      p.runCountdown(2, callback)
      expect(p.data.countdown).toBe(2)
      jest.advanceTimersByTime(1000)
      expect(p.data.countdown).toBe(1)
      jest.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalled()
      expect(p.data._timer).toBeNull()
    })
  })

  describe('onBreatheComplete', () => {
    test('完成后设置 phase 为 done 且 isBreathing 为 false', () => {
      const p = makePage({ _timer: 123 })
      p.onBreatheComplete()
      expect(p.data.phase).toBe('done')
      expect(p.data.phaseText).toBe('🎉 你做到了！')
      expect(p.data.isBreathing).toBe(false)
    })

    test('有 selectedTrigger 时调用 api.createCraving', () => {
      const spy = jest.spyOn(api, 'createCraving').mockResolvedValue({})
      const p = makePage({ selectedTrigger: 'stress' })
      p.onBreatheComplete()
      expect(spy).toHaveBeenCalledWith('stress', 3, 'breathe')
    })
  })

  describe('onReset', () => {
    test('重置所有状态', () => {
      const p = makePage({ _timer: 456, phase: 'done', completedRounds: 3 })
      p.onReset()
      expect(p.data.isBreathing).toBe(false)
      expect(p.data.phase).toBe('ready')
      expect(p.data.completedRounds).toBe(0)
    })
  })
})
