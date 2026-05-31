/**
 * 主题管理工具
 * 支持 auto（跟随系统）/ light / dark 三种模式
 */
const STORAGE_KEY = 'themeMode'

// 导航栏配色
const NAV_BAR = {
  light: { frontColor: '#000000', backgroundColor: '#ffffff' },
  dark:  { frontColor: '#ffffff', backgroundColor: '#1a1a2e' }
}

// tabBar 配色
const TAB_BAR = {
  light: { color: '#999999', selectedColor: '#4ecdc4', backgroundColor: '#ffffff', borderStyle: 'white' },
  dark:  { color: '#8888aa', selectedColor: '#4ecdc4', backgroundColor: '#1a1a2e', borderStyle: 'black' }
}

// 窗口背景色
const BG_COLOR = { light: '#f5f5f5', dark: '#0f0f1a' }
const BG_TEXT_STYLE = { light: 'dark', dark: 'light' }

function getMode() {
  try {
    const mode = wx.getStorageSync(STORAGE_KEY)
    if (mode === 'light' || mode === 'dark') return mode
  } catch (_) { /* ignore */ }
  return 'auto'
}

function setMode(mode) {
  wx.setStorageSync(STORAGE_KEY, mode)
  applyTheme(mode)
}

function applyTheme(mode) {
  const app = getApp()
  const cls = resolveThemeClass(mode)
  if (app) {
    app.globalData.themeClass = cls
    app.globalData.themeMode = mode || getMode()
  }
  // 更新系统栏（导航栏 + tabBar + 窗口背景）
  applySystemBars(mode)
  // 通知当前活跃页面刷新
  notifyPages(cls)
}

function resolveThemeClass(mode) {
  const m = mode || getMode()
  if (m === 'dark') return 'theme-dark'
  if (m === 'light') return 'theme-light'
  try {
    if (wx.getSystemInfoSync().theme === 'dark') return 'theme-dark'
  } catch (_) { /* ignore */ }
  return ''
}

function getThemeLabel(mode) {
  const m = mode || getMode()
  if (m === 'light') return '浅色'
  if (m === 'dark') return '深色'
  return '跟随系统'
}

function getCurrentClass() {
  const app = getApp()
  if (app && app.globalData.themeClass !== undefined) {
    return app.globalData.themeClass
  }
  return resolveThemeClass()
}

function notifyPages(cls) {
  const pages = getCurrentPages()
  pages.forEach(page => {
    try {
      page.setData({ themeClass: cls || '' })
    } catch (_) { /* page may not have themeClass in data */ }
  })
}

/**
 * 判断当前模式是否为深色（用于系统栏切换）
 */
function isDarkMode(mode) {
  return resolveThemeClass(mode) === 'theme-dark'
}

/**
 * 更新导航栏 + tabBar + 窗口背景色，使其跟随主题
 * @param {string} mode - 'auto' | 'light' | 'dark'
 * @param {string} [sysTheme] - 系统主题（'dark'|'light'），仅 auto 模式下使用此值覆盖 getSystemInfoSync 的延迟
 */
function applySystemBars(mode, sysTheme) {
  // auto 模式下优先使用外部传入的 sysTheme（来自 onThemeChange 回调，避免 getSystemInfoSync 不同步）
  let dark
  if (mode === 'auto') {
    const sys = sysTheme || (() => { try { return wx.getSystemInfoSync().theme } catch (_) { return 'light' } })()
    dark = sys === 'dark'
  } else {
    dark = isDarkMode(mode)
  }

  const nav = dark ? NAV_BAR.dark : NAV_BAR.light
  const tab = dark ? TAB_BAR.dark : TAB_BAR.light

  try { wx.setNavigationBarColor({ frontColor: nav.frontColor, backgroundColor: nav.backgroundColor }) } catch (_) {}
  try { wx.setTabBarStyle(tab) } catch (_) {}
  try { wx.setBackgroundTextStyle({ textStyle: dark ? BG_TEXT_STYLE.dark : BG_TEXT_STYLE.light }) } catch (_) {}
  try { wx.setBackgroundColor({ backgroundColor: dark ? BG_COLOR.dark : BG_COLOR.light }) } catch (_) {}
}

/**
 * 页面混入：在 onLoad/onShow 中自动同步主题类
 * 用法: Page(theme.mixin({ ... }))
 */
function mixin(pageDef) {
  const origOnLoad = pageDef.onLoad
  const origOnShow = pageDef.onShow

  // 确保 data 中有 pageVisible 字段（用于页面过渡动画）
  if (!pageDef.data) pageDef.data = {}
  if (pageDef.data.pageVisible === undefined) {
    pageDef.data.pageVisible = false
  }

  pageDef.onLoad = function (options) {
    this.setData({
      themeClass: getCurrentClass() || '',
      pageVisible: true  // 首次加载播放入场过渡
    })
    // 启用分享菜单（好友 + 朋友圈）
    try { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) } catch (_) {}
    if (origOnLoad) origOnLoad.call(this, options)
  }

  pageDef.onShow = function () {
    const cls = getCurrentClass() || ''
    // 先隐藏再显示，利用 transition 在每次 Tab 切换时重新播放过渡
    this.setData({ themeClass: cls, pageVisible: false })
    wx.nextTick(() => {
      this.setData({ pageVisible: true })
    })
    if (origOnShow) origOnShow.call(this)
  }

  return pageDef
}

module.exports = {
  getMode,
  setMode,
  applyTheme,
  getThemeLabel,
  getCurrentClass,
  resolveThemeClass,
  mixin,
  applySystemBars,
  isDarkMode,
  STORAGE_KEY
}
