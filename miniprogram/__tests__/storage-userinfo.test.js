/**
 * 用户信息功能 - storage.js 新增方法测试
 * 测试 saveUserInfo / getUserInfo
 */

const {
  STORAGE_KEYS,
  saveUserInfo,
  getUserInfo
} = require('../utils/storage')

describe('saveUserInfo / getUserInfo', () => {
  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
    const mockApp = getApp()
    mockApp.globalData.userInfo = null
  })

  test('保存并读取用户信息', () => {
    const info = { avatarUrl: 'http://avatar.jpg', nickName: '小明' }
    const saved = saveUserInfo(info)
    expect(saved).toBe(true)
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.USER_INFO, info)

    const retrieved = getUserInfo()
    expect(retrieved).toEqual(info)
  })

  test('保存用户信息更新全局数据', () => {
    const mockApp = getApp()
    const info = { avatarUrl: 'http://avatar.jpg', nickName: '小明' }
    saveUserInfo(info)
    expect(mockApp.globalData.userInfo).toEqual(info)
  })

  test('getUserInfo 无记录时返回 null', () => {
    const result = getUserInfo()
    expect(result).toBeNull()
  })

  test('只保存头像不保存昵称', () => {
    const info = { avatarUrl: 'http://avatar.jpg' }
    saveUserInfo(info)
    const retrieved = getUserInfo()
    expect(retrieved.avatarUrl).toBe('http://avatar.jpg')
    expect(retrieved.nickName).toBeUndefined()
  })

  test('只保存昵称不保存头像', () => {
    const info = { nickName: '小红' }
    saveUserInfo(info)
    const retrieved = getUserInfo()
    expect(retrieved.nickName).toBe('小红')
    expect(retrieved.avatarUrl).toBeUndefined()
  })

  test('更新已有用户信息（保留旧字段）', () => {
    // 先保存完整信息
    saveUserInfo({ avatarUrl: 'http://old.jpg', nickName: '旧名', extra: 'val' })

    // 更新昵称时保留头像和其他字段
    const existing = getUserInfo()
    existing.nickName = '新名'
    saveUserInfo(existing)

    const retrieved = getUserInfo()
    expect(retrieved.avatarUrl).toBe('http://old.jpg')
    expect(retrieved.nickName).toBe('新名')
    expect(retrieved.extra).toBe('val')
  })

  test('saveUserInfo 异常时返回 false', () => {
    wx.setStorageSync.mockImplementationOnce(() => { throw new Error('Storage error') })
    const result = saveUserInfo({ avatarUrl: 'test' })
    expect(result).toBe(false)
  })

  test('getUserInfo 异常时返回 null', () => {
    wx.getStorageSync.mockImplementationOnce(() => { throw new Error('Read error') })
    const result = getUserInfo()
    expect(result).toBeNull()
  })

  test('STORAGE_KEYS.USER_INFO 值正确', () => {
    expect(STORAGE_KEYS.USER_INFO).toBe('userInfo')
  })
})
