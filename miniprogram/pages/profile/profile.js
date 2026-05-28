// pages/profile/profile.js - 个人设置页
const calc = require('../../utils/calculator')
const storage = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    hasActiveRecord: false,
    // 吸烟参数
    cigarettesPerDay: 20,
    pricePerPack: 20,
    cigarettesPerPack: 20,
    yearsSmoked: 5,
    // 戒烟理由
    reason: '',
    // 提醒设置
    reminderEnabled: false,
    reminderTime: '09:00',
    // 戒烟信息
    quitDate: '',
    daysQuit: 0,
    // 显示开始戒烟表单
    showStartForm: false,
    // 订阅消息模板ID（需在微信公众平台申请）
    subscribeTemplateId: '',
    // 用户信息
    avatarUrl: '',
    nickName: ''
  },

  onLoad(options) {
    if (options && options.action === 'start') {
      this.setData({ showStartForm: true })
    }
    this.loadSettings()
  },

  onShow() {
    // 检查是否有待处理的操作（从首页跳转过来开始戒烟）
    const app = getApp()
    if (app.globalData.pendingAction === 'start') {
      this.setData({ showStartForm: true })
      app.globalData.pendingAction = null // 清除标记
    }
    this.loadSettings()
  },

  loadSettings() {
    const record = storage.getQuitRecord()
    const settings = storage.getSettings()
    const userInfo = storage.getUserInfo()

    // 加载用户头像和昵称
    const avatarUrl = (userInfo && userInfo.avatarUrl) || ''
    const nickName = (userInfo && userInfo.nickName) || ''

    if (record) {
      this.setData({
        hasActiveRecord: true,
        quitDate: record.quitDate ? this.formatDate(record.quitDate) : '',
        daysQuit: record.quitDate ? calc.calcQuitDuration(record.quitDate).days : 0,
        cigarettesPerDay: record.cigarettesPerDay || settings.cigarettesPerDay || 20,
        pricePerPack: record.pricePerPack || settings.pricePerPack || 20,
        cigarettesPerPack: record.cigarettesPerPack || settings.cigarettesPerPack || 20,
        yearsSmoked: record.yearsSmoked || settings.yearsSmoked || 5,
        reason: record.reason || '',
        avatarUrl,
        nickName
      })
    } else {
      this.setData({
        hasActiveRecord: false,
        cigarettesPerDay: settings.cigarettesPerDay || 20,
        pricePerPack: settings.pricePerPack || 20,
        cigarettesPerPack: settings.cigarettesPerPack || 20,
        yearsSmoked: settings.yearsSmoked || 5,
        reminderEnabled: settings.reminderEnabled || false,
        reminderTime: settings.reminderTime || '09:00',
        avatarUrl,
        nickName
      })
    }

    // 异步从服务端拉取最新头像昵称
    this._fetchProfileFromServer()
  },

  /**
   * 选择头像回调
   * 微信小程序通过 button open-type="chooseAvatar" 触发
   * 返回的 avatarUrl 是临时路径（wxfile://），重启后可能失效
   */
  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl
    if (!tempUrl) return

    this.setData({ avatarUrl: tempUrl })

    // 保存到本地存储和全局数据
    const userInfo = storage.getUserInfo() || {}
    userInfo.avatarUrl = tempUrl
    storage.saveUserInfo(userInfo)

    const app = getApp()
    app.globalData.userInfo = userInfo

    // 同步到后端
    this._syncUserInfoToServer()
  },

  /**
   * 昵称输入回调
   * 使用 input type="nickname" 触发微信昵称键盘选择
   */
  onNicknameInput(e) {
    const name = e.detail.value
    if (name === undefined || name === null) return

    this.setData({ nickName: name })

    // 保存到本地存储和全局数据
    const userInfo = storage.getUserInfo() || {}
    userInfo.nickName = name
    storage.saveUserInfo(userInfo)

    const app = getApp()
    app.globalData.userInfo = userInfo

    // 同步到后端
    this._syncUserInfoToServer()
  },

  /**
   * 同步用户信息到后端
   * 调用 login 接口，后端会 COALESCE 更新 nickname 和 avatar_url
   */
  _syncUserInfoToServer() {
    const { nickName, avatarUrl } = this.data
    api.login(undefined, nickName, avatarUrl).catch(err => {
      console.warn('[Profile] 同步用户信息到后端失败:', err.message)
    })
  },

  /**
   * 从服务端拉取最新用户资料
   * 用于头像/昵称的恢复（本地临时路径可能已失效）
   */
  async _fetchProfileFromServer() {
    try {
      const res = await api.getProfile()
      if (res && res.user) {
        const serverAvatar = res.user.avatar_url || ''
        const serverNick = res.user.nickname || ''

        // 本地没有头像时，用服务端的
        // 本地有头像时保留本地（可能是刚选的新头像）
        const userInfo = storage.getUserInfo() || {}
        let needUpdate = false

        if (serverAvatar && !userInfo.avatarUrl) {
          userInfo.avatarUrl = serverAvatar
          needUpdate = true
        }
        if (serverNick && !userInfo.nickName) {
          userInfo.nickName = serverNick
          needUpdate = true
        }

        if (needUpdate) {
          storage.saveUserInfo(userInfo)
          const app = getApp()
          app.globalData.userInfo = userInfo
          this.setData({
            avatarUrl: userInfo.avatarUrl || '',
            nickName: userInfo.nickName || ''
          })
        }
      }
    } catch (err) {
      console.warn('[Profile] 从服务端拉取用户资料失败:', err.message)
    }
  },

  // 开始戒烟
  onStartQuit() {
    this.setData({ showStartForm: true })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ quitDate: e.detail.value })
  },

  // 参数修改
  onCigPerDayChange(e) {
    this.setData({ cigarettesPerDay: Number(e.detail.value) || 20 })
  },
  onPriceChange(e) {
    this.setData({ pricePerPack: Number(e.detail.value) || 20 })
  },
  onCigPerPackChange(e) {
    this.setData({ cigarettesPerPack: Number(e.detail.value) || 20 })
  },
  onYearsSmokedChange(e) {
    this.setData({ yearsSmoked: Number(e.detail.value) || 5 })
  },
  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  // 提醒开关
  onReminderToggle(e) {
    const enabled = e.detail.value
    this.setData({ reminderEnabled: enabled })

    if (enabled) {
      this.setupReminder()
    } else {
      this.cancelReminder()
    }

    storage.saveSettings({
      ...storage.getSettings(),
      reminderEnabled: enabled
    })
  },

  onReminderTimeChange(e) {
    this.setData({ reminderTime: e.detail.value })
    storage.saveSettings({
      ...storage.getSettings(),
      reminderTime: e.detail.value
    })
    if (this.data.reminderEnabled) {
      this.setupReminder()
    }
  },

  /**
   * 设置提醒
   * 使用微信订阅消息实现定时提醒
   * 微信小程序不支持真正的本地定时通知，
   * 通过 wx.requestSubscribeMessage 请求用户授权接收订阅消息
   */
  setupReminder() {
    const that = this
    const templateId = this.data.subscribeTemplateId

    // 如果没有配置模板ID，使用本地提醒方案
    if (!templateId) {
      this._setupLocalReminder()
      return
    }

    // 请求订阅消息授权
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        if (res[templateId] === 'accept') {
          console.log('[Reminder] 用户同意接收订阅消息')
          // 保存订阅状态
          wx.setStorageSync('reminderSubscribed', true)
          that._setupLocalReminder()
          wx.showToast({ title: '提醒已开启', icon: 'success' })
        } else if (res[templateId] === 'reject') {
          console.log('[Reminder] 用户拒绝接收订阅消息')
          wx.showModal({
            title: '提醒需要授权',
            content: '您拒绝了消息通知，将无法收到每日打卡提醒。可在设置中重新开启。',
            showCancel: false,
            confirmColor: '#4ecdc4'
          })
          // 恢复开关状态
          that.setData({ reminderEnabled: false })
          storage.saveSettings({
            ...storage.getSettings(),
            reminderEnabled: false
          })
        }
      },
      fail(err) {
        console.warn('[Reminder] 订阅消息请求失败:', err.errMsg)
        // 降级为本地提醒
        that._setupLocalReminder()
        wx.showToast({ title: '提醒已开启（本地模式）', icon: 'none' })
      }
    })
  },

  /**
   * 本地提醒方案
   * 由于微信小程序没有真正的本地通知API，
   * 这里使用后台运行 + 页面内提醒的方式实现
   * 实际提醒效果依赖用户打开小程序
   */
  _setupLocalReminder() {
    const reminderTime = this.data.reminderTime || '09:00'
    const [hour, minute] = reminderTime.split(':').map(Number)

    // 保存提醒配置到本地
    wx.setStorageSync('reminderConfig', {
      enabled: true,
      time: reminderTime,
      hour: hour,
      minute: minute,
      createdAt: Date.now()
    })

    // 尝试使用 wx.setStorageSync 记录下次提醒时间
    // 微信小程序生命周期内检查
    this._scheduleNextReminder(hour, minute)

    console.log(`[Reminder] 本地提醒已设置: 每天 ${reminderTime}`)
  },

  /**
   * 调度下一次提醒
   * @param {number} hour 小时
   * @param {number} minute 分钟
   */
  _scheduleNextReminder(hour, minute) {
    // 清除已有的定时器
    if (this._reminderTimer) {
      clearTimeout(this._reminderTimer)
    }

    const now = new Date()
    const target = new Date()
    target.setHours(hour, minute, 0, 0)

    // 如果今天的提醒时间已过，设置为明天
    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }

    const delay = target.getTime() - now.getTime()

    // 设置定时器（微信小程序后台可能被回收，最长约5分钟）
    this._reminderTimer = setTimeout(() => {
      this._showReminderNotification()
    }, Math.min(delay, 5 * 60 * 1000)) // 不超过5分钟

    // 记录下次提醒时间
    wx.setStorageSync('nextReminderTime', target.getTime())
  },

  /**
   * 显示提醒通知
   */
  _showReminderNotification() {
    const record = storage.getQuitRecord()
    if (!record) return

    const duration = calc.calcQuitDuration(record.quitDate)
    const encouragement = calc.getEncouragement(duration.days)

    wx.showModal({
      title: '⏰ 打卡提醒',
      content: `你已经戒烟 ${duration.days} 天了！${encouragement}`,
      confirmText: '去打卡',
      cancelText: '稍后',
      confirmColor: '#4ecdc4',
      success(res) {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }
    })

    // 设置下一次提醒
    if (this.data.reminderEnabled) {
      const reminderTime = this.data.reminderTime || '09:00'
      const [h, m] = reminderTime.split(':').map(Number)
      this._scheduleNextReminder(h, m)
    }
  },

  /**
   * 取消提醒
   */
  cancelReminder() {
    // 清除定时器
    if (this._reminderTimer) {
      clearTimeout(this._reminderTimer)
      this._reminderTimer = null
    }

    // 清除本地配置
    wx.removeStorageSync('reminderConfig')
    wx.removeStorageSync('nextReminderTime')
    wx.removeStorageSync('reminderSubscribed')

    console.log('[Reminder] 提醒已取消')
  },

  /**
   * 检查是否需要显示提醒
   * 在页面 onShow 时调用
   */
  checkAndShowReminder() {
    const config = wx.getStorageSync('reminderConfig')
    if (!config || !config.enabled) return

    const nextTime = wx.getStorageSync('nextReminderTime')
    if (!nextTime) return

    const now = Date.now()
    if (now >= nextTime) {
      this._showReminderNotification()
    }
  },

  // 确认开始戒烟
  async onConfirmStart() {
    const quitDate = this.data.quitDate || new Date().toISOString().split('T')[0]

    const record = {
      quitDate: new Date(quitDate).getTime(),
      cigarettesPerDay: this.data.cigarettesPerDay,
      pricePerPack: this.data.pricePerPack,
      cigarettesPerPack: this.data.cigarettesPerPack,
      yearsSmoked: this.data.yearsSmoked,
      reason: this.data.reason,
      createdAt: Date.now()
    }

    // 保存到本地存储
    storage.saveQuitRecord(record)

    // 保存设置
    storage.saveSettings({
      cigarettesPerDay: this.data.cigarettesPerDay,
      pricePerPack: this.data.pricePerPack,
      cigarettesPerPack: this.data.cigarettesPerPack,
      yearsSmoked: this.data.yearsSmoked,
      reminderEnabled: this.data.reminderEnabled,
      reminderTime: this.data.reminderTime
    })

    // 同步到服务器
    try {
      await api.createQuitRecord(record)
      console.log('[Profile] 戒烟记录已同步到服务器')
    } catch (err) {
      console.warn('[Profile] 同步到服务器失败，已保存到本地:', err.message)
    }

    // 更新全局数据
    const app = getApp()
    app.globalData.quitRecord = record
    app.globalData.hasActiveRecord = true

    wx.showToast({ title: '戒烟之旅开始！', icon: 'success' })
    this.setData({ hasActiveRecord: true, showStartForm: false })
    this.loadSettings()

    // 如果开启了提醒，立即设置
    if (this.data.reminderEnabled) {
      this.setupReminder()
    }

    // 跳转首页
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 1500)
  },

  // 复吸重置（温柔版）
  onRelapse() {
    wx.showModal({
      title: '没关系 💙',
      content: '复吸是戒烟过程中很常见的事情，不代表失败。要重新开始吗？',
      confirmText: '重新开始',
      cancelText: '再想想',
      confirmColor: '#4ecdc4',
      success: (res) => {
        if (res.confirm) {
          // 取消提醒
          this.cancelReminder()
          storage.clearQuitRecord()
          this.setData({
            hasActiveRecord: false,
            showStartForm: true
          })
          wx.showToast({ title: '重新出发，你很勇敢', icon: 'none' })
        }
      }
    })
  },

  // 格式化日期
  formatDate(timestamp) {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return timestamp
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  // 页面卸载时清理
  onUnload() {
    if (this._reminderTimer) {
      clearTimeout(this._reminderTimer)
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '戒烟助手 - 帮你记录每一天的变化',
      path: '/pages/index/index'
    }
  }
})
