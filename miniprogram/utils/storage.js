// utils/storage.js - 本地存储工具

const STORAGE_KEYS = {
  QUIT_RECORD: 'quitRecord',
  USER_INFO: 'userInfo',
  SETTINGS: 'settings',
  CHECK_INS_HISTORY: 'checkInHistory',
  CRAVING_HISTORY: 'cravingHistory'
}

/**
 * 保存戒烟记录
 */
function saveQuitRecord(record) {
  try {
    wx.setStorageSync(STORAGE_KEYS.QUIT_RECORD, record)
    // 更新全局数据
    const app = getApp()
    app.globalData.quitRecord = record
    app.globalData.hasActiveRecord = true
    return true
  } catch (e) {
    console.error('保存戒烟记录失败', e)
    return false
  }
}

/**
 * 获取戒烟记录
 */
function getQuitRecord() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.QUIT_RECORD) || null
  } catch (e) {
    return null
  }
}

/**
 * 清除戒烟记录（复吸重置）
 */
function clearQuitRecord() {
  try {
    wx.removeStorageSync(STORAGE_KEYS.QUIT_RECORD)
    const app = getApp()
    app.globalData.quitRecord = null
    app.globalData.hasActiveRecord = false
    return true
  } catch (e) {
    return false
  }
}

/**
 * 保存打卡
 */
function saveCheckIn(date, mood, note) {
  try {
    const history = wx.getStorageSync(STORAGE_KEYS.CHECK_IN_HISTORY) || {}
    history[date] = {
      date: date,
      isSuccess: true,
      mood: mood || 'normal',
      note: note || '',
      timestamp: Date.now()
    }
    wx.setStorageSync(STORAGE_KEYS.CHECK_IN_HISTORY, history)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 获取打卡历史
 * @param {string} month YYYY-MM
 */
function getCheckInHistory(month) {
  try {
    const history = wx.getStorageSync(STORAGE_KEYS.CHECK_IN_HISTORY) || {}
    if (!month) return history
    // 过滤指定月份
    const filtered = {}
    Object.keys(history).forEach(key => {
      if (key.startsWith(month)) {
        filtered[key] = history[key]
      }
    })
    return filtered
  } catch (e) {
    return {}
  }
}

/**
 * 保存烟瘾记录
 */
function saveCraving(trigger, intensity, method) {
  try {
    const history = wx.getStorageSync(STORAGE_KEYS.CRAVING_HISTORY) || []
    history.unshift({
      trigger,
      intensity,
      method,
      timestamp: Date.now()
    })
    // 只保留最近100条
    if (history.length > 100) history.length = 100
    wx.setStorageSync(STORAGE_KEYS.CRAVING_HISTORY, history)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 保存设置
 */
function saveSettings(settings) {
  try {
    wx.setStorageSync(STORAGE_KEYS.SETTINGS, settings)
    const app = getApp()
    app.globalData.settings = settings
    return true
  } catch (e) {
    return false
  }
}

/**
 * 获取设置
 */
function getSettings() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.SETTINGS) || {
      cigarettesPerDay: 20,
      pricePerPack: 20,
      cigarettesPerPack: 20,
      yearsSmoked: 5,
      reminderEnabled: false,
      reminderTime: '09:00'
    }
  } catch (e) {
    return {}
  }
}

/**
 * 保存用户信息（头像、昵称等）
 * @param {object} info 用户信息 { avatarUrl, nickName, ... }
 */
function saveUserInfo(info) {
  try {
    wx.setStorageSync(STORAGE_KEYS.USER_INFO, info)
    const app = getApp()
    app.globalData.userInfo = info
    return true
  } catch (e) {
    console.error('保存用户信息失败', e)
    return false
  }
}

/**
 * 获取用户信息
 * @returns {object|null} 用户信息 { avatarUrl, nickName, ... }
 */
function getUserInfo() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.USER_INFO) || null
  } catch (e) {
    return null
  }
}

module.exports = {
  STORAGE_KEYS,
  saveQuitRecord,
  getQuitRecord,
  clearQuitRecord,
  saveCheckIn,
  getCheckInHistory,
  saveCraving,
  saveSettings,
  getSettings,
  saveUserInfo,
  getUserInfo
}
