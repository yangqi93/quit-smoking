/**
 * 用户信息功能 - Profile 页面逻辑测试
 * 测试 profile.js 中新增的用户信息相关方法
 *
 * 由于微信小程序 Page() 不是标准模块导出，我们通过手动模拟 Page 调用
 * 来提取页面逻辑进行测试。
 */

const storage = require('../utils/storage')
const api = require('../utils/api')

// 捕获 Page() 传入的对象
let pageObj = null
global.Page = jest.fn((obj) => { pageObj = obj })

// 加载 profile.js（会调用 Page()）
require('../pages/profile/profile')

describe('Profile 页面 - 用户信息功能', () => {
  let page

  beforeEach(() => {
    wx.__storage && Object.keys(wx.__storage).forEach(k => delete wx.__storage[k])
    jest.clearAllMocks()
    const mockApp = getApp()
    mockApp.globalData.userInfo = null
    mockApp.globalData.quitRecord = null
    mockApp.globalData.hasActiveRecord = false

    // 构造一个可测试的 page 实例
    page = {
      data: {
        hasActiveRecord: false,
        cigarettesPerDay: 20,
        pricePerPack: 20,
        cigarettesPerPack: 20,
        yearsSmoked: 5,
        reason: '',
        reminderEnabled: false,
        reminderTime: '09:00',
        quitDate: '',
        daysQuit: 0,
        showStartForm: false,
        subscribeTemplateId: '',
        avatarUrl: '',
        nickName: ''
      },
      setData: jest.fn(function (update) {
        Object.assign(this.data, update)
      })
    }

    // 绑定方法到 page 实例
    page.onChooseAvatar = pageObj.onChooseAvatar.bind(page)
    page.onNicknameInput = pageObj.onNicknameInput.bind(page)
    page._syncUserInfoToServer = pageObj._syncUserInfoToServer.bind(page)
    page._fetchProfileFromServer = pageObj._fetchProfileFromServer.bind(page)
    page.loadSettings = pageObj.loadSettings.bind(page)
  })

  // ========= onChooseAvatar 测试 =========

  describe('onChooseAvatar', () => {
    test('正确获取 e.detail.avatarUrl 并更新 data', () => {
      const tempUrl = 'wxfile://tmp_avatar.jpg'
      page.onChooseAvatar({ detail: { avatarUrl: tempUrl } })

      expect(page.data.avatarUrl).toBe(tempUrl)
    })

    test('avatarUrl 为空时不更新', () => {
      page.onChooseAvatar({ detail: { avatarUrl: '' } })
      expect(page.data.avatarUrl).toBe('')
    })

    test('avatarUrl 不存在时不更新', () => {
      page.onChooseAvatar({ detail: {} })
      expect(page.data.avatarUrl).toBe('')
    })

    test('e.detail.avatarUrl 为 undefined 时不更新', () => {
      page.onChooseAvatar({ detail: { avatarUrl: undefined } })
      expect(page.data.avatarUrl).toBe('')
    })

    test('保存头像到本地 storage', () => {
      const tempUrl = 'wxfile://tmp_avatar.jpg'
      page.onChooseAvatar({ detail: { avatarUrl: tempUrl } })

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe(tempUrl)
    })

    test('保存头像到全局数据', () => {
      const tempUrl = 'wxfile://tmp_avatar.jpg'
      page.onChooseAvatar({ detail: { avatarUrl: tempUrl } })

      const mockApp = getApp()
      expect(mockApp.globalData.userInfo.avatarUrl).toBe(tempUrl)
    })

    test('保存头像时保留已有昵称', () => {
      // 先设置昵称
      storage.saveUserInfo({ nickName: '已有昵称' })
      const mockApp = getApp()
      mockApp.globalData.userInfo = { nickName: '已有昵称' }

      page.onChooseAvatar({ detail: { avatarUrl: 'http://new-avatar.jpg' } })

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe('http://new-avatar.jpg')
      expect(savedInfo.nickName).toBe('已有昵称')
    })

    test('保存头像后调用 _syncUserInfoToServer', () => {
      const syncSpy = jest.spyOn(page, '_syncUserInfoToServer')
      page.onChooseAvatar({ detail: { avatarUrl: 'http://test.jpg' } })

      expect(syncSpy).toHaveBeenCalled()
    })
  })

  // ========= onNicknameInput 测试 =========

  describe('onNicknameInput', () => {
    test('正确获取 e.detail.value 并更新 data', () => {
      page.onNicknameInput({ detail: { value: '新昵称' } })

      expect(page.data.nickName).toBe('新昵称')
    })

    test('空字符串时不更新 (BUG: 用户无法清空昵称)', () => {
      page.data.nickName = '旧昵称'
      page.onNicknameInput({ detail: { value: '' } })

      // 当前的 if (!name) return 会阻止清空操作
      expect(page.data.nickName).toBe('旧昵称')
    })

    test('保存昵称到本地 storage', () => {
      page.onNicknameInput({ detail: { value: '新昵称' } })

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.nickName).toBe('新昵称')
    })

    test('保存昵称到全局数据', () => {
      page.onNicknameInput({ detail: { value: '新昵称' } })

      const mockApp = getApp()
      expect(mockApp.globalData.userInfo.nickName).toBe('新昵称')
    })

    test('保存昵称时保留已有头像', () => {
      storage.saveUserInfo({ avatarUrl: 'http://existing-avatar.jpg' })
      const mockApp = getApp()
      mockApp.globalData.userInfo = { avatarUrl: 'http://existing-avatar.jpg' }

      page.onNicknameInput({ detail: { value: '新昵称' } })

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe('http://existing-avatar.jpg')
      expect(savedInfo.nickName).toBe('新昵称')
    })

    test('保存昵称后调用 _syncUserInfoToServer', () => {
      const syncSpy = jest.spyOn(page, '_syncUserInfoToServer')
      page.onNicknameInput({ detail: { value: '新昵称' } })

      expect(syncSpy).toHaveBeenCalled()
    })
  })

  // ========= _syncUserInfoToServer 测试 =========

  describe('_syncUserInfoToServer', () => {
    test('调用 api.login(undefined, nickName, avatarUrl)', async () => {
      page.data.nickName = '测试用户'
      page.data.avatarUrl = 'http://avatar.jpg'

      const loginSpy = jest.spyOn(api, 'login').mockResolvedValue({})

      page._syncUserInfoToServer()

      expect(loginSpy).toHaveBeenCalledWith(undefined, '测试用户', 'http://avatar.jpg')
      loginSpy.mockRestore()
    })

    test('nickName 和 avatarUrl 为空时也能同步', () => {
      const loginSpy = jest.spyOn(api, 'login').mockResolvedValue({})

      page._syncUserInfoToServer()

      expect(loginSpy).toHaveBeenCalledWith(undefined, '', '')
      loginSpy.mockRestore()
    })

    test('同步失败时 console.warn 不抛异常', () => {
      const loginSpy = jest.spyOn(api, 'login').mockRejectedValue(new Error('网络错误'))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      expect(() => page._syncUserInfoToServer()).not.toThrow()

      loginSpy.mockRestore()
      warnSpy.mockRestore()
    })
  })

  // ========= _fetchProfileFromServer 测试 =========

  describe('_fetchProfileFromServer', () => {
    test('服务端有头像但本地没有时，更新本地头像', async () => {
      const serverProfile = {
        user: { avatar_url: 'http://server-avatar.jpg', nickname: '服务端昵称' }
      }
      const getProfileSpy = jest.spyOn(api, 'getProfile').mockResolvedValue(serverProfile)

      await page._fetchProfileFromServer()

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe('http://server-avatar.jpg')
      expect(savedInfo.nickName).toBe('服务端昵称')

      getProfileSpy.mockRestore()
    })

    test('服务端有头像但本地也有头像时，保留本地头像', async () => {
      storage.saveUserInfo({ avatarUrl: 'http://local-avatar.jpg', nickName: '本地昵称' })
      const mockApp = getApp()
      mockApp.globalData.userInfo = { avatarUrl: 'http://local-avatar.jpg', nickName: '本地昵称' }

      const serverProfile = {
        user: { avatar_url: 'http://server-avatar.jpg', nickname: '服务端昵称' }
      }
      const getProfileSpy = jest.spyOn(api, 'getProfile').mockResolvedValue(serverProfile)

      await page._fetchProfileFromServer()

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe('http://local-avatar.jpg')
      expect(savedInfo.nickName).toBe('本地昵称')

      getProfileSpy.mockRestore()
    })

    test('服务端返回空资料时不更新本地', async () => {
      storage.saveUserInfo({ avatarUrl: 'http://local.jpg', nickName: '本地名' })
      const mockApp = getApp()
      mockApp.globalData.userInfo = { avatarUrl: 'http://local.jpg', nickName: '本地名' }

      const getProfileSpy = jest.spyOn(api, 'getProfile').mockResolvedValue({
        user: { avatar_url: '', nickname: '' }
      })

      await page._fetchProfileFromServer()

      const savedInfo = storage.getUserInfo()
      // 本地不应被覆盖
      expect(savedInfo.avatarUrl).toBe('http://local.jpg')
      expect(savedInfo.nickName).toBe('本地名')

      getProfileSpy.mockRestore()
    })

    test('getProfile 返回 null 时不报错', async () => {
      const getProfileSpy = jest.spyOn(api, 'getProfile').mockResolvedValue(null)

      await expect(page._fetchProfileFromServer()).resolves.not.toThrow()

      getProfileSpy.mockRestore()
    })

    test('getProfile 请求失败时不报错', async () => {
      const getProfileSpy = jest.spyOn(api, 'getProfile').mockRejectedValue(new Error('网络错误'))

      await expect(page._fetchProfileFromServer()).resolves.not.toThrow()

      getProfileSpy.mockRestore()
    })

    test('服务端只返回头像不返回昵称时，只恢复头像', async () => {
      const serverProfile = {
        user: { avatar_url: 'http://server-avatar.jpg', nickname: '' }
      }
      const getProfileSpy = jest.spyOn(api, 'getProfile').mockResolvedValue(serverProfile)

      await page._fetchProfileFromServer()

      const savedInfo = storage.getUserInfo()
      expect(savedInfo.avatarUrl).toBe('http://server-avatar.jpg')
      // nickname 不应被设置为空字符串
      expect(savedInfo.nickName).toBeFalsy()

      getProfileSpy.mockRestore()
    })
  })

  // ========= loadSettings 用户信息加载测试 =========

  describe('loadSettings - 用户信息加载', () => {
    test('有用户信息时正确加载到 data', () => {
      storage.saveUserInfo({ avatarUrl: 'http://loaded.jpg', nickName: '加载名' })

      page.loadSettings()

      // 通过 setData 检查
      const calls = page.setData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.avatarUrl).toBe('http://loaded.jpg')
      expect(lastCall.nickName).toBe('加载名')
    })

    test('无用户信息时 avatarUrl 和 nickName 为空', () => {
      page.loadSettings()

      const calls = page.setData.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.avatarUrl).toBe('')
      expect(lastCall.nickName).toBe('')
    })
  })
})
