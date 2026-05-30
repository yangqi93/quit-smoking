// config.js - 环境配置
// 按小程序运行环境自动选择 API 地址，无需手动修改代码

// 各环境对应的后端地址
const ENV_CONFIG = {
  // 开发环境（微信开发者工具、预览版）
  development: {
    apiBaseUrl: 'https://api.yangqi.space/quit-smoking'
  },
  // 测试环境（体验版）
  staging: {
    apiBaseUrl: 'http://81.71.7.91:8081'
  },
  // 生产环境（正式版）
  production: {
    apiBaseUrl: 'https://api.yangqi.space/quit-smoking'
  }
}

/**
 * 获取当前运行环境
 * 微信小程序通过 wx.getAccountInfoSync() 区分 dev / trial / formal
 */
function getEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const envVersion = accountInfo.miniProgram.envVersion

    switch (envVersion) {
      case 'develop':
        return 'development'
      case 'trial':
        return 'staging'
      case 'release':
        return 'production'
      default:
        return 'development'
    }
  } catch (e) {
    // 非微信环境（如 Jest 测试）
    return 'development'
  }
}

/**
 * 获取当前环境的配置对象
 */
function getConfig() {
  const env = getEnv()
  const config = ENV_CONFIG[env] || ENV_CONFIG.development

  // 允许通过本地 storage 强制覆盖（方便调试）
  try {
    const overrideUrl = wx.getStorageSync('__api_base_url_override')
    if (overrideUrl) {
      config.apiBaseUrl = overrideUrl
    }
  } catch (e) {
    // ignore
  }

  return config
}

/**
 * 获取 API 基础 URL
 * 供 api.js 直接使用，无需再通过 app.globalData
 */
function getApiBaseUrl() {
  return getConfig().apiBaseUrl
}

module.exports = {
  getEnv,
  getConfig,
  getApiBaseUrl,
  ENV_CONFIG
}
