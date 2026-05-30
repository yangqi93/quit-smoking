/**
 * utils/theme.test.js — 主题管理工具测试
 */
const theme = require('../utils/theme')

// Mock wx
const wxMock = {
  storage: {},
  systemInfo: { theme: 'light' },
  getStorageSync(key) {
    return this.storage[key]
  },
  setStorageSync(key, val) {
    this.storage[key] = val
  },
  getSystemInfoSync() {
    return this.systemInfo
  },
  onThemeChange() { /* noop in test */ },
  nextTick(cb) { cb() },
  setNavigationBarColor: jest.fn(),
  setTabBarStyle: jest.fn(),
  setBackgroundTextStyle: jest.fn(),
  setBackgroundColor: jest.fn()
}

// Mock getApp
const mockApp = {
  globalData: {}
}
global.getApp = () => mockApp
global.getCurrentPages = () => []
global.wx = wxMock

describe('theme 工具模块', () => {
  beforeEach(() => {
    wxMock.storage = {}
    wxMock.systemInfo = { theme: 'light' }
    mockApp.globalData = {}
    wxMock.setNavigationBarColor.mockClear()
    wxMock.setTabBarStyle.mockClear()
    wxMock.setBackgroundTextStyle.mockClear()
    wxMock.setBackgroundColor.mockClear()
  })

  describe('getMode()', () => {
    test('默认返回 auto', () => {
      expect(theme.getMode()).toBe('auto')
    })

    test('存储了 light 则返回 light', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'light')
      expect(theme.getMode()).toBe('light')
    })

    test('存储了 dark 则返回 dark', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'dark')
      expect(theme.getMode()).toBe('dark')
    })

    test('非法值回退到 auto', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'invalid')
      expect(theme.getMode()).toBe('auto')
    })
  })

  describe('resolveThemeClass()', () => {
    test('manual dark → theme-dark', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'dark')
      expect(theme.resolveThemeClass()).toBe('theme-dark')
    })

    test('manual light → theme-light', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'light')
      expect(theme.resolveThemeClass()).toBe('theme-light')
    })

    test('auto + 系统浅色 → 空字符串', () => {
      wxMock.systemInfo.theme = 'light'
      expect(theme.resolveThemeClass('auto')).toBe('')
    })

    test('auto + 系统深色 → theme-dark', () => {
      wxMock.systemInfo.theme = 'dark'
      expect(theme.resolveThemeClass('auto')).toBe('theme-dark')
    })

    test('手动传 dark 参数覆盖存储', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'auto')
      expect(theme.resolveThemeClass('dark')).toBe('theme-dark')
    })
  })

  describe('setMode()', () => {
    test('保存到 storage', () => {
      theme.setMode('dark')
      expect(wxMock.getStorageSync(theme.STORAGE_KEY)).toBe('dark')
    })

    test('更新 app.globalData', () => {
      theme.setMode('light')
      expect(mockApp.globalData.themeMode).toBe('light')
      expect(mockApp.globalData.themeClass).toBe('theme-light')
    })
  })

  describe('getThemeLabel()', () => {
    test('返回中文标签', () => {
      expect(theme.getThemeLabel('auto')).toBe('跟随系统')
      expect(theme.getThemeLabel('light')).toBe('浅色')
      expect(theme.getThemeLabel('dark')).toBe('深色')
    })
  })

  describe('getCurrentClass()', () => {
    test('从 app.globalData 读取', () => {
      mockApp.globalData.themeClass = 'theme-dark'
      expect(theme.getCurrentClass()).toBe('theme-dark')
    })

    test('fallback 到 resolveThemeClass', () => {
      wxMock.systemInfo.theme = 'dark'
      expect(theme.getCurrentClass()).toBe('theme-dark')
    })
  })

  describe('mixin()', () => {
    test('注入 onLoad / onShow 自动同步 themeClass', () => {
      const onLoadSpy = jest.fn()
      const onShowSpy = jest.fn()
      const pageCtx = { setData: jest.fn() }

      const def = theme.mixin({
        onLoad: onLoadSpy,
        onShow: onShowSpy
      })

      mockApp.globalData.themeClass = 'theme-dark'
      def.onLoad.call(pageCtx)
      expect(pageCtx.setData).toHaveBeenCalledWith({ themeClass: 'theme-dark', pageVisible: true })
      expect(onLoadSpy).toHaveBeenCalled()

      pageCtx.setData.mockClear()
      def.onShow.call(pageCtx)
      expect(pageCtx.setData).toHaveBeenCalledWith({ themeClass: 'theme-dark', pageVisible: false })
      expect(onShowSpy).toHaveBeenCalled()
    })

    test('没有原始 onLoad/onShow 也能正常运行', () => {
      const pageCtx = { setData: jest.fn() }
      const def = theme.mixin({})
      expect(() => def.onLoad.call(pageCtx)).not.toThrow()
      expect(() => def.onShow.call(pageCtx)).not.toThrow()
    })
  })

  describe('isDarkMode()', () => {
    test('manual dark → true', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'dark')
      expect(theme.isDarkMode()).toBe(true)
    })

    test('manual light → false', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'light')
      expect(theme.isDarkMode()).toBe(false)
    })

    test('auto + 系统深色 → true', () => {
      wxMock.systemInfo.theme = 'dark'
      expect(theme.isDarkMode('auto')).toBe(true)
    })

    test('auto + 系统浅色 → false', () => {
      wxMock.systemInfo.theme = 'light'
      expect(theme.isDarkMode('auto')).toBe(false)
    })

    test('传 dark 参数 → true', () => {
      expect(theme.isDarkMode('dark')).toBe(true)
    })

    test('传 light 参数 → false', () => {
      expect(theme.isDarkMode('light')).toBe(false)
    })
  })

  describe('applySystemBars()', () => {
    test('深色模式设置深色系统栏', () => {
      wxMock.setStorageSync(theme.STORAGE_KEY, 'dark')
      theme.applySystemBars('dark')

      expect(wxMock.setNavigationBarColor).toHaveBeenCalledWith({
        frontColor: '#ffffff',
        backgroundColor: '#1a1a2e'
      })
      expect(wxMock.setTabBarStyle).toHaveBeenCalledWith({
        color: '#8888aa',
        selectedColor: '#4ecdc4',
        backgroundColor: '#1a1a2e',
        borderStyle: 'black'
      })
      expect(wxMock.setBackgroundTextStyle).toHaveBeenCalledWith({ textStyle: 'light' })
      expect(wxMock.setBackgroundColor).toHaveBeenCalledWith({ backgroundColor: '#0f0f1a' })
    })

    test('浅色模式设置浅色系统栏', () => {
      theme.applySystemBars('light')

      expect(wxMock.setNavigationBarColor).toHaveBeenCalledWith({
        frontColor: '#000000',
        backgroundColor: '#ffffff'
      })
      expect(wxMock.setTabBarStyle).toHaveBeenCalledWith({
        color: '#999999',
        selectedColor: '#4ecdc4',
        backgroundColor: '#ffffff',
        borderStyle: 'white'
      })
      expect(wxMock.setBackgroundTextStyle).toHaveBeenCalledWith({ textStyle: 'dark' })
      expect(wxMock.setBackgroundColor).toHaveBeenCalledWith({ backgroundColor: '#f5f5f5' })
    })

    test('auto + 系统深色 → 应用深色系统栏', () => {
      wxMock.systemInfo.theme = 'dark'
      theme.applySystemBars('auto')

      expect(wxMock.setNavigationBarColor).toHaveBeenCalledWith({
        frontColor: '#ffffff',
        backgroundColor: '#1a1a2e'
      })
    })

    test('auto + 系统浅色 → 应用浅色系统栏', () => {
      wxMock.systemInfo.theme = 'light'
      theme.applySystemBars('auto')

      expect(wxMock.setNavigationBarColor).toHaveBeenCalledWith({
        frontColor: '#000000',
        backgroundColor: '#ffffff'
      })
    })
  })

  describe('setMode() 触发系统栏更新', () => {
    test('setMode dark 会更新系统栏', () => {
      theme.setMode('dark')
      expect(wxMock.setNavigationBarColor).toHaveBeenCalled()
      expect(wxMock.setTabBarStyle).toHaveBeenCalled()
    })

    test('setMode light 会更新系统栏', () => {
      theme.setMode('light')
      expect(wxMock.setNavigationBarColor).toHaveBeenCalled()
      expect(wxMock.setTabBarStyle).toHaveBeenCalled()
    })
  })
})
