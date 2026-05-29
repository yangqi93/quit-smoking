// utils/api.js - 后端 API 封装层
// 策略：本地存储为主，API 为辅，确保离线可用

const config = require('../config')
const storage = require('./storage')

/**
 * 获取 API 基础 URL
 * 统一从 config.js 读取，按环境自动选择
 */
function getBaseUrl() {
  return config.getApiBaseUrl()
}

/**
 * 获取用户 OpenID
 * 原型阶段使用本地存储的标识，生产环境走微信登录
 */
function getOpenId() {
  try {
    let openId = wx.getStorageSync('openId')
    if (!openId) {
      // 原型阶段：生成一个随机 OpenID 并持久化
      openId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      wx.setStorageSync('openId', openId)
    }
    return openId
  } catch (e) {
    return 'user_default'
  }
}

/**
 * 通用请求封装
 * @param {string} url 请求路径（不含 baseUrl）
 * @param {object} options 请求选项
 * @param {string} options.method 请求方法
 * @param {object} options.data 请求体数据
 * @param {boolean} options.silent 是否静默（不显示 loading）
 * @returns {Promise<object>} 响应数据
 */
function request(url, options = {}) {
  const {
    method = 'GET',
    data = {},
    silent = false
  } = options

  return new Promise((resolve, reject) => {
    if (!silent) {
      wx.showLoading({ title: '加载中...', mask: true })
    }

    const header = {
      'Content-Type': 'application/json',
      'X-Open-ID': getOpenId()
    }

    wx.request({
      url: getBaseUrl() + url,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // 未授权，需要重新登录
          console.warn('[API] 未授权，请重新登录')
          reject(new Error('未授权'))
        } else {
          const errMsg = (res.data && res.data.error) || '请求失败'
          console.error('[API] 请求失败:', url, res.statusCode, errMsg)
          reject(new Error(errMsg))
        }
      },
      fail(err) {
        console.error('[API] 网络请求失败:', url, err.errMsg)
        reject(new Error('网络请求失败，请检查网络连接'))
      },
      complete() {
        if (!silent) {
          wx.hideLoading()
        }
      }
    })
  })
}

// ========== 用户接口 ==========

/**
 * 登录/注册
 * 使用本地生成的 OpenID 向后端注册，确保后续 API 调用有权限
 * 后端会 COALESCE 更新 nickname 和 avatar_url（有新值时更新，否则保留旧值）
 * @param {string} [openId] 用户 OpenID，不传则自动获取
 * @param {string} [nickname] 用户昵称
 * @param {string} [avatarUrl] 用户头像 URL
 * @returns {Promise<object>} 用户信息
 */
function login(openId, nickname, avatarUrl) {
  const id = openId || getOpenId()

  // 优先使用传入参数，否则从 globalData 读取
  const app = getApp()
  const gd = (app && app.globalData) || {}
  const nick = nickname || (gd.userInfo && gd.userInfo.nickName) || ''
  const avatar = avatarUrl || (gd.userInfo && gd.userInfo.avatarUrl) || ''

  return request('/api/auth/login', {
    method: 'POST',
    silent: true,
    data: {
      open_id: id,
      nickname: nick,
      avatar_url: avatar
    }
  })
}

/**
 * 获取用户资料
 * @returns {Promise<object>} 用户资料
 */
function getProfile() {
  return request('/api/user/profile', { silent: true })
}

// ========== 戒烟记录接口 ==========

/**
 * 创建戒烟记录（同步到服务器）
 * @param {object} record 戒烟记录
 * @returns {Promise<object>} 创建结果
 */
function createQuitRecord(record) {
  // 先保存到本地
  storage.saveQuitRecord(record)

  // 异步同步到服务器
  return request('/api/quit-record', {
    method: 'POST',
    data: {
      quit_date: record.quitDate ? new Date(record.quitDate).toISOString() : new Date().toISOString(),
      cigarettes_per_day: record.cigarettesPerDay || 20,
      price_per_pack: record.pricePerPack || 20,
      cigarettes_per_pack: record.cigarettesPerPack || 20,
      years_smoked: record.yearsSmoked || 5,
      reason: record.reason || ''
    }
  }).catch(err => {
    console.warn('[API] 同步戒烟记录失败，已保存到本地:', err.message)
    // 本地优先，API 失败不影响使用
    return { local: true }
  })
}

/**
 * 获取活跃戒烟记录（优先本地，异步同步远端）
 * @returns {Promise<object|null>} 戒烟记录
 */
function getActiveQuitRecord() {
  // 优先从本地获取
  const localRecord = storage.getQuitRecord()
  if (localRecord) {
    return Promise.resolve(localRecord)
  }

  // 本地没有，尝试从服务器拉取
  return request('/api/quit-record/active', { silent: true })
    .then(res => {
      if (res && res.record && res.is_active) {
        const serverRecord = res.record
        // 转换服务器数据格式为本地格式
        const localFormat = {
          quitDate: new Date(serverRecord.quit_date).getTime(),
          cigarettesPerDay: serverRecord.cigarettes_per_day,
          pricePerPack: serverRecord.price_per_pack,
          cigarettesPerPack: serverRecord.cigarettes_per_pack,
          yearsSmoked: serverRecord.years_smoked,
          reason: serverRecord.reason || '',
          createdAt: new Date(serverRecord.created_at).getTime()
        }
        // 同步到本地
        storage.saveQuitRecord(localFormat)
        return localFormat
      }
      return null
    })
    .catch(err => {
      console.warn('[API] 获取远端记录失败:', err.message)
      return null
    })
}

// ========== 仪表盘接口 ==========

/**
 * 获取仪表盘数据（本地计算，API 作为校验）
 * @returns {Promise<object|null>} 仪表盘数据
 */
function getDashboard() {
  return request('/api/dashboard', { silent: true })
    .then(res => res && res.dashboard)
    .catch(err => {
      console.warn('[API] 获取仪表盘数据失败:', err.message)
      return null
    })
}

// ========== 健康时间线接口 ==========

/**
 * 获取健康时间线
 * @returns {Promise<object|null>} 时间线数据
 */
function getHealthTimeline() {
  return request('/api/health/timeline', { silent: true })
    .then(res => res && res.timeline)
    .catch(err => {
      console.warn('[API] 获取健康时间线失败:', err.message)
      return null
    })
}

// ========== 打卡接口 ==========

/**
 * 打卡（本地 + API 同步）
 * @param {string} date 日期 YYYY-MM-DD
 * @param {string} mood 心情
 * @param {string} note 备注
 * @returns {Promise<boolean>} 是否成功
 */
function checkIn(date, mood, note) {
  // 先保存到本地
  storage.saveCheckIn(date, mood, note)

  // 异步同步到服务器
  return request('/api/check-in', {
    method: 'POST',
    data: {
      date: date,
      is_success: true,
      mood: mood || 'normal',
      note: note || ''
    }
  }).then(() => true).catch(err => {
    console.warn('[API] 同步打卡失败，已保存到本地:', err.message)
    return true // 本地已保存，仍返回成功
  })
}

/**
 * 获取打卡历史
 * @param {string} month 月份 YYYY-MM
 * @returns {Promise<object>} 打卡历史
 */
function getCheckInHistory(month) {
  // 优先本地
  const localHistory = storage.getCheckInHistory(month)
  if (Object.keys(localHistory).length > 0) {
    return Promise.resolve(localHistory)
  }

  // 本地没有，尝试从服务器拉取
  return request('/api/check-in/history?month=' + month, { silent: true })
    .then(res => {
      if (res && res.check_ins) {
        // 转换服务器数据为本地格式
        const history = {}
        res.check_ins.forEach(ci => {
          history[ci.date] = {
            date: ci.date,
            isSuccess: ci.is_success,
            mood: ci.mood,
            note: ci.note || '',
            timestamp: new Date(ci.created_at).getTime()
          }
        })
        return history
      }
      return {}
    })
    .catch(err => {
      console.warn('[API] 获取打卡历史失败:', err.message)
      return {}
    })
}

// ========== 烟瘾记录接口 ==========

/**
 * 记录烟瘾发作（本地 + API 同步）
 * @param {string} trigger 触发场景
 * @param {number} intensity 强度 1-10
 * @param {string} method 克服方式
 * @returns {Promise<boolean>} 是否成功
 */
function createCraving(trigger, intensity, method) {
  // 先保存到本地
  storage.saveCraving(trigger, intensity, method)

  // 异步同步到服务器
  return request('/api/craving', {
    method: 'POST',
    data: {
      trigger: trigger || '',
      intensity: intensity || 5,
      method: method || ''
    }
  }).then(() => true).catch(err => {
    console.warn('[API] 同步烟瘾记录失败，已保存到本地:', err.message)
    return true
  })
}

// ========== 数据同步 ==========

/**
 * 全量同步本地数据到服务器
 * 在网络恢复时调用
 * @returns {Promise<void>}
 */
function syncAllToServer() {
  const record = storage.getQuitRecord()
  const settings = storage.getSettings()

  const promises = []

  // 同步戒烟记录
  if (record) {
    promises.push(
      createQuitRecord(record).catch(err => {
        console.warn('[Sync] 同步戒烟记录失败:', err.message)
      })
    )
  }

  // 同步打卡记录
  const checkInHistory = storage.getCheckInHistory()
  Object.keys(checkInHistory).forEach(date => {
    const ci = checkInHistory[date]
    promises.push(
      request('/api/check-in', {
        method: 'POST',
        data: {
          date: ci.date,
          is_success: ci.isSuccess,
          mood: ci.mood,
          note: ci.note
        },
        silent: true
      }).catch(() => {})
    )
  })

  return Promise.all(promises).then(() => {
    console.log('[Sync] 数据同步完成')
  })
}

/**
 * 从服务器拉取最新数据到本地
 * @returns {Promise<void>}
 */
function pullFromServer() {
  return getActiveQuitRecord().then(record => {
    if (record) {
      console.log('[Sync] 已从服务器同步戒烟记录')
    }
  }).catch(err => {
    console.warn('[Sync] 从服务器拉取数据失败:', err.message)
  })
}

module.exports = {
  // 基础
  getBaseUrl,
  getOpenId,
  request,
  // 用户
  login,
  getProfile,
  // 戒烟记录
  createQuitRecord,
  getActiveQuitRecord,
  // 仪表盘
  getDashboard,
  // 健康时间线
  getHealthTimeline,
  // 打卡
  checkIn,
  getCheckInHistory,
  // 烟瘾记录
  createCraving,
  // 同步
  syncAllToServer,
  pullFromServer
}
