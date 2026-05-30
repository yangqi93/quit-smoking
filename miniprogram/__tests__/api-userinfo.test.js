/**
 * 用户信息功能 - api.js login 方法测试
 * 测试 login(nickname, avatarUrl) 新签名 — 内部调 wx.login() 拿 code 换 JWT
 */

const api = require('../utils/api')
const storage = require('../utils/storage')

// 所有测试共用的 wx.login mock helper
function mockWxLoginSuccess(code = 'wx_test_code_xyz') {
  wx.login.mockImplementation(({ success }) => {
    success({ code })
  })
}

describe('login - 基础流程', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    mockWxLoginSuccess()
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { token: 'jwt_test', user: { id: 1 } } })
    })
  })

  test('调用 wx.login 获取 code', async () => {
    await api.login()
    expect(wx.login).toHaveBeenCalled()
  })

  test('发送 code 而非 open_id 到后端', async () => {
    await api.login('昵称', 'http://avatar.jpg')

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall).toBeTruthy()
    expect(loginCall[0].data.code).toBe('wx_test_code_xyz')
    expect(loginCall[0].data.open_id).toBeUndefined()
  })

  test('传入 nickname 和 avatarUrl 时正确发送', async () => {
    await api.login('测试昵称', 'http://avatar.jpg')

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('测试昵称')
    expect(loginCall[0].data.avatar_url).toBe('http://avatar.jpg')
  })

  test('只传 nickname 不传 avatarUrl', async () => {
    await api.login('只有昵称')

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('只有昵称')
    expect(loginCall[0].data.avatar_url).toBe('')
  })

  test('只传 avatarUrl 不传 nickname', async () => {
    await api.login(undefined, 'http://avatar.jpg')

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('')
    expect(loginCall[0].data.avatar_url).toBe('http://avatar.jpg')
  })

  test('登录成功时持久化 token', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { token: 'jwt_persist', user: { id: 1 } } })
    })

    await api.login()
    expect(wx.setStorageSync).toHaveBeenCalledWith('auth_token', 'jwt_persist')
  })

  test('wx.login 失败时抛出错误', async () => {
    wx.login.mockImplementation(({ fail }) => {
      fail({ errMsg: 'login:fail' })
    })

    await expect(api.login()).rejects.toThrow('wx.login 失败')
  })
})

describe('login - 兼容性与 globalData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    mockWxLoginSuccess()
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { token: 'jwt_test', user: { id: 1 } } })
    })
  })

  test('api.login() 无参数调用', async () => {
    await api.login()

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.code).toBe('wx_test_code_xyz')
    expect(loginCall[0].data.nickname).toBe('')
    expect(loginCall[0].data.avatar_url).toBe('')
  })

  test('globalData.userInfo 为 null 时不报错', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = null

    await expect(api.login()).resolves.not.toThrow()

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('')
    expect(loginCall[0].data.avatar_url).toBe('')
  })

  test('globalData.userInfo 有值时自动填入 nickname/avatarUrl', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '全局昵称', avatarUrl: 'http://global-avatar.jpg' }

    await api.login()

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('全局昵称')
    expect(loginCall[0].data.avatar_url).toBe('http://global-avatar.jpg')
  })

  test('传入参数优先于 globalData', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '全局昵称', avatarUrl: 'http://global-avatar.jpg' }

    await api.login('显式昵称', 'http://explicit-avatar.jpg')

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('显式昵称')
    expect(loginCall[0].data.avatar_url).toBe('http://explicit-avatar.jpg')
  })

  test('globalData.userInfo nickName 为空时正确处理', async () => {
    const mockApp = getApp()
    mockApp.globalData.userInfo = { nickName: '', avatarUrl: '' }

    await api.login()

    const loginCall = wx.request.mock.calls.find(
      call => call[0].url && call[0].url.includes('/api/auth/login')
    )
    expect(loginCall[0].data.nickname).toBe('')
    expect(loginCall[0].data.avatar_url).toBe('')
  })

  test('后端返回错误时抛出异常', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 400, data: { error: 'code 无效' } })
    })

    await expect(api.login()).rejects.toThrow('code 无效')
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

  test('非静默模式显示 loading', async () => {
    wx.request.mockImplementation(({ success, complete }) => {
      success({ statusCode: 200, data: { user: {} } })
      complete()
    })

    await api.getProfile()
    expect(wx.showLoading).toHaveBeenCalled()
  })

  test('获取用户资料请求失败', async () => {
    wx.request.mockImplementation(({ fail }) => {
      fail({ errMsg: 'network error' })
    })

    await expect(api.getProfile()).rejects.toThrow()
  })
})
