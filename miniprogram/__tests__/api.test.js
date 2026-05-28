/**
 * api.js 单元测试
 * 测试后端API封装层
 */

const api = require('../utils/api')
const storage = require('../utils/storage')

describe('getBaseUrl', () => {
  test('从 globalData 获取基础 URL', () => {
    const mockApp = getApp()
    mockApp.globalData.apiBaseUrl = 'http://custom-api.example.com'
    expect(api.getBaseUrl()).toBe('http://custom-api.example.com')
    // 恢复默认
    mockApp.globalData.apiBaseUrl = 'http://localhost:8080'
  })

  test('默认使用 localhost:8080', () => {
    const mockApp = getApp()
    mockApp.globalData.apiBaseUrl = 'http://localhost:8080'
    expect(api.getBaseUrl()).toBe('http://localhost:8080')
  })

  test('globalData 不存在时使用默认值', () => {
    global.getApp.mockReturnValueOnce(null)
    expect(api.getBaseUrl()).toBe('http://localhost:8080')
  })
})

describe('getOpenId', () => {
  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
  })

  test('返回已存在的 openId', () => {
    wx.getStorageSync.mockReturnValueOnce('user_existing_123')
    const openId = api.getOpenId()
    expect(openId).toBe('user_existing_123')
  })

  test('生成新的 openId 并持久化', () => {
    wx.getStorageSync.mockReturnValueOnce('') // 空，需要生成
    const openId = api.getOpenId()
    expect(openId).toMatch(/^user_\d+_[a-z0-9]+$/)
    expect(wx.setStorageSync).toHaveBeenCalledWith('openId', openId)
  })

  test('异常时返回默认值', () => {
    wx.getStorageSync.mockImplementationOnce(() => { throw new Error('Error') })
    const openId = api.getOpenId()
    expect(openId).toBe('user_default')
  })
})

describe('request - 通用请求封装', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('成功请求返回数据', async () => {
    const mockResponse = { statusCode: 200, data: { success: true } }
    wx.request.mockImplementation(({ success }) => success(mockResponse))

    const result = await api.request('/api/test')
    expect(result).toEqual({ success: true })
  })

  test('请求 URL 正确拼接', async () => {
    const mockApp = getApp()
    mockApp.globalData.apiBaseUrl = 'http://localhost:8080'

    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: {} })
    })

    await api.request('/api/test')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.url).toBe('http://localhost:8080/api/test')
  })

  test('默认 GET 方法', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: {} })
    })

    await api.request('/api/test')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.method).toBe('GET')
  })

  test('POST 方法正确传递', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 201, data: { id: 1 } })
    })

    await api.request('/api/test', { method: 'POST', data: { name: 'test' } })

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.method).toBe('POST')
    expect(callArgs.data).toEqual({ name: 'test' })
  })

  test('请求头包含 Content-Type 和 X-Open-ID', async () => {
    wx.getStorageSync.mockReturnValueOnce('test_open_id_123')

    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: {} })
    })

    await api.request('/api/test')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.header['Content-Type']).toBe('application/json')
    expect(callArgs.header['X-Open-ID']).toBeTruthy()
  })

  test('非静默模式显示 loading', async () => {
    wx.request.mockImplementation(({ success, complete }) => {
      success({ statusCode: 200, data: {} })
      complete()
    })

    await api.request('/api/test', { silent: false })
    expect(wx.showLoading).toHaveBeenCalled()
    expect(wx.hideLoading).toHaveBeenCalled()
  })

  test('静默模式不显示 loading', async () => {
    wx.request.mockImplementation(({ success, complete }) => {
      success({ statusCode: 200, data: {} })
      complete()
    })

    await api.request('/api/test', { silent: true })
    expect(wx.showLoading).not.toHaveBeenCalled()
  })

  test('401 状态码拒绝并提示未授权', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 401, data: { error: 'Unauthorized' } })
    })

    await expect(api.request('/api/test')).rejects.toThrow('未授权')
  })

  test('其他错误状态码拒绝', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 500, data: { error: 'Internal Error' } })
    })

    await expect(api.request('/api/test')).rejects.toThrow('Internal Error')
  })

  test('网络失败拒绝', async () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'request:fail timeout' })
    })

    await expect(api.request('/api/test')).rejects.toThrow('网络请求失败')
  })

  test('错误响应无 error 字段时使用默认消息', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 500, data: {} })
    })

    await expect(api.request('/api/test')).rejects.toThrow('请求失败')
  })
})

describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('发送正确的登录请求', async () => {
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123', '测试用户', 'http://avatar.jpg')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.url).toContain('/api/auth/login')
    expect(callArgs.method).toBe('POST')
    expect(callArgs.data.open_id).toBe('user_123')
    expect(callArgs.data.nickname).toBe('测试用户')
    expect(callArgs.data.avatar_url).toBe('http://avatar.jpg')
  })
})

describe('createQuitRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('先保存到本地再同步到服务器', async () => {
    const record = {
      quitDate: '2025-07-01',
      cigarettesPerDay: 20,
      pricePerPack: 25,
      cigarettesPerPack: 20,
      yearsSmoked: 5,
      reason: '健康'
    }

    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 201, data: { id: 1, message: '加油' } })
    })

    const result = await api.createQuitRecord(record)

    // 应该先调了 storage.saveQuitRecord
    expect(wx.setStorageSync).toHaveBeenCalledWith('quitRecord', record)
    // 服务器端请求
    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.method).toBe('POST')
    expect(callArgs.url).toContain('/api/quit-record')
    expect(callArgs.data.cigarettes_per_day).toBe(20)
  })

  test('API 失败时返回 {local: true}', async () => {
    const record = { quitDate: '2025-07-01', cigarettesPerDay: 20 }

    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'network error' })
    })

    const result = await api.createQuitRecord(record)
    expect(result).toEqual({ local: true })
  })
})

describe('getDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功获取仪表盘数据', async () => {
    const dashboardData = { days_quit: 7, money_saved: 175 }
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { dashboard: dashboardData } })
    })

    const result = await api.getDashboard()
    expect(result).toEqual(dashboardData)

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.url).toContain('/api/dashboard')
    expect(callArgs.method).toBe('GET')
  })

  test('仪表盘请求使用静默模式', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { dashboard: {} } })
    })

    await api.getDashboard()
    expect(wx.showLoading).not.toHaveBeenCalled()
  })

  test('仪表盘请求失败返回 null', async () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'error' })
    })

    const result = await api.getDashboard()
    expect(result).toBeNull()
  })
})

describe('checkIn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('先保存本地再同步服务器', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { message: '打卡成功' } })
    })

    const result = await api.checkIn('2025-07-15', 'good', '加油')
    expect(result).toBe(true)

    // 本地保存
    expect(wx.setStorageSync).toHaveBeenCalled()
    // 服务器请求
    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.url).toContain('/api/check-in')
    expect(callArgs.method).toBe('POST')
    expect(callArgs.data.date).toBe('2025-07-15')
    expect(callArgs.data.mood).toBe('good')
  })

  test('API 失败仍返回 true（本地已保存）', async () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'network error' })
    })

    const result = await api.checkIn('2025-07-15', 'normal')
    expect(result).toBe(true)
  })
})

describe('createCraving', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('保存烟瘾记录到本地和服务器', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 201, data: { id: 1 } })
    })

    const result = await api.createCraving('stress', 8, 'breathe')
    expect(result).toBe(true)

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.url).toContain('/api/craving')
    expect(callArgs.method).toBe('POST')
    expect(callArgs.data.trigger).toBe('stress')
    expect(callArgs.data.intensity).toBe(8)
    expect(callArgs.data.method).toBe('breathe')
  })
})
