/**
 * Jest 全局 setup - 模拟微信小程序环境
 * 小程序环境中 wx 是全局对象，getApp 是全局函数
 */

// 模拟 wx 全局对象
const wxStorage = {}

const wx = {
  // 存储 API
  setStorageSync: jest.fn((key, value) => {
    wxStorage[key] = value
  }),
  getStorageSync: jest.fn((key) => {
    return wxStorage[key] !== undefined ? wxStorage[key] : ''
  }),
  removeStorageSync: jest.fn((key) => {
    delete wxStorage[key]
  }),
  clearStorageSync: jest.fn(() => {
    Object.keys(wxStorage).forEach(k => delete wxStorage[k])
  }),

  // 网络 API
  request: jest.fn(),

  // 登录 API
  login: jest.fn(),

  // 小程序环境信息
  getAccountInfoSync: jest.fn(() => ({
    miniProgram: { envVersion: 'develop' }
  })),

  // UI API
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showToast: jest.fn(),
  hideToast: jest.fn(),
  showModal: jest.fn(),
  showActionSheet: jest.fn(),

  // 导航 API
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  navigateBack: jest.fn(),

  // 提醒 API
  requestSubscribeMessage: jest.fn(),

  // 清除存储（测试辅助）
  __storage: wxStorage
}

global.wx = wx

// 模拟 getApp - 返回同一个实例，确保 globalData 修改在所有调用间共享
const mockAppInstance = {
  globalData: {
    apiBaseUrl: 'http://localhost:8080',
    quitRecord: null,
    hasActiveRecord: false,
    settings: null
  }
}
global.getApp = jest.fn(() => mockAppInstance)

// 模拟 console 方法（可选，减少测试输出噪音）
// global.console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() }
