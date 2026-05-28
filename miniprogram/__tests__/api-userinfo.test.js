/**
 * 用户信息功能 - api.js login 方法扩展测试
 * 测试 login(openId, nickname, avatarUrl) 新签名及向后兼容
 */

const api = require('../utils/api')
const storage = require('../utils/storage')

describe('login - 新签名测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('传入 nickname 和 avatarUrl 时正确发送', async () => {
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123', '测试昵称', 'http://avatar.jpg')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('测试昵称')
    expect(callArgs.data.avatar_url).toBe('http://avatar.jpg')
  })

  test('只传 nickname 不传 avatarUrl', async () => {
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123', '只有昵称')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('只有昵称')
    expect(callArgs.data.avatar_url).toBe('') // 默认空字符串
  })

  test('只传 avatarUrl 不传 nickname', async () => {
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123', undefined, 'http://avatar.jpg')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('')
    expect(callArgs.data.avatar_url).toBe('http://avatar.jpg')
  })
})

describe('login - 向后兼容性测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
  })

  test('api.login() 无参数调用 - 使用自动 openId 和空 nickname/avatarUrl', async () => {
    wx.getStorageSync.mockReturnValueOnce('auto_open_id')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login()

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.open_id).toBe('auto_open_id')
    expect(callArgs.data.nickname).toBe('')
    expect(callArgs.data.avatar_url).toBe('')
  })

  test('api.login(openId) 只传 openId - 向后兼容旧调用方式', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_existing_456')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.open_id).toBe('user_existing_456')
    // nickname 和 avatarUrl 从 globalData 读取
  })

  test('api.login(api.getOpenId()) 旧调用方式兼容', async () => {
    wx.getStorageSync.mockReturnValueOnce('user_auto_get_openid')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login(api.getOpenId())

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.open_id).toBe('user_auto_get_openid')
  })

  test('globalData.userInfo 为 null 时 login 不报错', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = null
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    // 不应抛出错误
    await expect(api.login('user_123')).resolves.not.toThrow()

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('')
    expect(callArgs.data.avatar_url).toBe('')
  })

  test('globalData.userInfo 有值时 login 从中读取 nickname/avatarUrl', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '全局昵称', avatarUrl: 'http://global-avatar.jpg' }
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('全局昵称')
    expect(callArgs.data.avatar_url).toBe('http://global-avatar.jpg')
  })

  test('传入参数优先于 globalData', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '全局昵称', avatarUrl: 'http://global-avatar.jpg' }
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123', '显式昵称', 'http://explicit-avatar.jpg')

    const callArgs = wx.request.mock.calls[0][0]
    expect(callArgs.data.nickname).toBe('显式昵称')
    expect(callArgs.data.avatar_url).toBe('http://explicit-avatar.jpg')
  })

  test('globalData.userInfo 存在但 nickName 为空字符串时正确处理', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '', avatarUrl: '' }
    wx.getStorageSync.mockReturnValueOnce('user_123')
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { user: { id: 1 } } })
    })

    await api.login('user_123')

    const callArgs = wx.request.mock.calls[0][0]
    // 空字符串是 falsy，但 || 运算符会让它回退到 ''
    expect(callArgs.data.nickname).toBe('')
    expect(callArgs.data.avatar_url).toBe('')
  })
})

describe('getProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('成功获取用户资料', async () => {
    const profileData = { user: { id: 1, nickname: '测试', avatar_url: 'http://test.jpg' } }
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: profileData })
    })

    const result = await api.getProfile()
    expect(result).toEqual(profileData)
    expect(result.user.nickname).toBe('测试')
    expect(result.user.avatar_url).toBe('http://test.jpg')
  })

  test('非静默模式（getProfile 未传 silent，默认显示 loading）', async () => {
    wx.request.mockImplementation(({ success, complete }) => {
      success({ statusCode: 200, data: { user: {} } })
      complete()
    })

    await api.getProfile()
    // getProfile 调用 request() 时未传 silent: true，所以会显示 loading
    expect(wx.showLoading).toHaveBeenCalled()
  })

  test('获取用户资料请求失败', async () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'network error' })
    })

    await expect(api.getProfile()).rejects.toThrow()
  })
})
