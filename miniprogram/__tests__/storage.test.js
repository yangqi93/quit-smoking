/**
 * storage.js 单元测试
 * 测试本地存储工具
 */

const {
  STORAGE_KEYS,
  saveQuitRecord,
  getQuitRecord,
  clearQuitRecord,
  saveCheckIn,
  getCheckInHistory,
  saveCraving,
  saveSettings,
  getSettings
} = require('../utils/storage')

describe('saveQuitRecord / getQuitRecord / clearQuitRecord', () => {
  beforeEach(() => {
    // 清空 wx mock 存储
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    // 重置 mock 调用计数
    jest.clearAllMocks()
    // 重置全局数据
    const mockApp = getApp()
    mockApp.globalData.quitRecord = null
    mockApp.globalData.hasActiveRecord = false
    mockApp.globalData.settings = null
  })

  test('保存并读取戒烟记录', () => {
    const record = {
      quitDate: Date.now() - 86400000,
      cigarettesPerDay: 20,
      pricePerPack: 25,
      cigarettesPerPack: 20,
      yearsSmoked: 5,
      reason: '为了健康'
    }

    const saved = saveQuitRecord(record)
    expect(saved).toBe(true)
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.QUIT_RECORD, record)

    const retrieved = getQuitRecord()
    expect(retrieved).toEqual(record)
  })

  test('getQuitRecord 无记录时返回 null', () => {
    const result = getQuitRecord()
    expect(result).toBeNull()
  })

  test('clearQuitRecord 清除记录', () => {
    const record = { quitDate: Date.now(), cigarettesPerDay: 20 }
    saveQuitRecord(record)

    const cleared = clearQuitRecord()
    expect(cleared).toBe(true)
    expect(wx.removeStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.QUIT_RECORD)

    const result = getQuitRecord()
    expect(result).toBeNull()
  })

  test('saveQuitRecord 更新全局数据', () => {
    const mockApp = getApp()
    const record = { quitDate: Date.now(), cigarettesPerDay: 15 }

    saveQuitRecord(record)
    expect(mockApp.globalData.quitRecord).toEqual(record)
    expect(mockApp.globalData.hasActiveRecord).toBe(true)
  })

  test('clearQuitRecord 重置全局数据', () => {
    const mockApp = getApp()
    const record = { quitDate: Date.now(), cigarettesPerDay: 15 }
    saveQuitRecord(record)

    clearQuitRecord()
    expect(mockApp.globalData.quitRecord).toBeNull()
    expect(mockApp.globalData.hasActiveRecord).toBe(false)
  })

  test('saveQuitRecord 异常时返回 false', () => {
    wx.setStorageSync.mockImplementationOnce(() => { throw new Error('Storage error') })
    const result = saveQuitRecord({ quitDate: Date.now() })
    expect(result).toBe(false)
  })

  test('getQuitRecord 异常时返回 null', () => {
    wx.getStorageSync.mockImplementationOnce(() => { throw new Error('Read error') })
    const result = getQuitRecord()
    expect(result).toBeNull()
  })
})

describe('saveCheckIn / getCheckInHistory', () => {
  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
  })

  test('保存打卡记录', () => {
    const result = saveCheckIn('2025-07-15', 'good', '坚持住了！')
    expect(result).toBe(true)

    const history = getCheckInHistory()
    expect(history['2025-07-15']).toBeDefined()
    expect(history['2025-07-15'].mood).toBe('good')
    expect(history['2025-07-15'].note).toBe('坚持住了！')
    expect(history['2025-07-15'].isSuccess).toBe(true)
  })

  test('保存打卡默认值处理', () => {
    saveCheckIn('2025-07-15')
    const history = getCheckInHistory()
    expect(history['2025-07-15'].mood).toBe('normal')
    expect(history['2025-07-15'].note).toBe('')
  })

  test('按月份过滤打卡历史', () => {
    saveCheckIn('2025-07-01', 'good')
    saveCheckIn('2025-07-15', 'normal')
    saveCheckIn('2025-06-20', 'bad')

    const julyHistory = getCheckInHistory('2025-07')
    expect(Object.keys(julyHistory).length).toBe(2)
    expect(julyHistory['2025-07-01']).toBeDefined()
    expect(julyHistory['2025-07-15']).toBeDefined()
    expect(julyHistory['2025-06-20']).toBeUndefined()
  })

  test('不传月份返回全部', () => {
    saveCheckIn('2025-07-01')
    saveCheckIn('2025-06-20')

    const allHistory = getCheckInHistory()
    expect(Object.keys(allHistory).length).toBe(2)
  })

  test('无打卡记录返回空对象', () => {
    const history = getCheckInHistory()
    expect(history).toEqual({})
  })

  test('打卡记录包含 timestamp', () => {
    const beforeSave = Date.now()
    saveCheckIn('2025-07-15', 'good')
    const history = getCheckInHistory()
    expect(history['2025-07-15'].timestamp).toBeGreaterThanOrEqual(beforeSave)
  })
})

describe('saveCraving', () => {
  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
  })

  test('保存烟瘾记录', () => {
    const result = saveCraving('stress', 8, 'breathe')
    expect(result).toBe(true)

    const history = wx.getStorageSync(STORAGE_KEYS.CRAVING_HISTORY)
    expect(history.length).toBe(1)
    expect(history[0].trigger).toBe('stress')
    expect(history[0].intensity).toBe(8)
    expect(history[0].method).toBe('breathe')
  })

  test('新记录添加到数组开头', () => {
    saveCraving('stress', 8, 'breathe')
    saveCraving('social', 5, 'water')

    const history = wx.getStorageSync(STORAGE_KEYS.CRAVING_HISTORY)
    expect(history.length).toBe(2)
    expect(history[0].trigger).toBe('social') // 最新的在前
    expect(history[1].trigger).toBe('stress')
  })

  test('最多保留100条记录', () => {
    // 先填充100条
    const existing = []
    for (let i = 0; i < 100; i++) {
      existing.push({ trigger: 'test', intensity: 5, method: '', timestamp: Date.now() - i * 1000 })
    }
    wx.setStorageSync(STORAGE_KEYS.CRAVING_HISTORY, existing)

    // 添加第101条
    saveCraving('new', 3, 'walk')

    const history = wx.getStorageSync(STORAGE_KEYS.CRAVING_HISTORY)
    expect(history.length).toBe(100)
    expect(history[0].trigger).toBe('new')
  })
})

describe('saveSettings / getSettings', () => {
  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
    // 重置全局数据
    const mockApp = getApp()
    mockApp.globalData.settings = null
  })

  test('保存并获取设置', () => {
    const settings = {
      cigarettesPerDay: 15,
      pricePerPack: 30,
      cigarettesPerPack: 20,
      yearsSmoked: 10,
      reminderEnabled: true,
      reminderTime: '08:00'
    }

    const saved = saveSettings(settings)
    expect(saved).toBe(true)

    const retrieved = getSettings()
    expect(retrieved).toEqual(settings)
  })

  test('getSettings 无设置时返回默认值', () => {
    const settings = getSettings()
    expect(settings.cigarettesPerDay).toBe(20)
    expect(settings.pricePerPack).toBe(20)
    expect(settings.cigarettesPerPack).toBe(20)
    expect(settings.yearsSmoked).toBe(5)
    expect(settings.reminderEnabled).toBe(false)
    expect(settings.reminderTime).toBe('09:00')
  })

  test('saveSettings 更新全局数据', () => {
    const mockApp = getApp()
    const settings = { cigarettesPerDay: 10, pricePerPack: 25 }
    saveSettings(settings)
    expect(mockApp.globalData.settings).toEqual(settings)
  })

  test('getSettings 异常时返回空对象', () => {
    wx.getStorageSync.mockImplementationOnce(() => { throw new Error('Error') })
    const settings = getSettings()
    expect(settings).toEqual({})
  })
})
