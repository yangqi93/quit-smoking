// pages/index/index.js - 首页（戒烟计时器 + 仪表盘）
const calc = require('../../utils/calculator')
const storage = require('../../utils/storage')
const api = require('../../utils/api')
const theme = require('../../utils/theme')

Page(theme.mixin({
  data: {
    // 戒烟状态
    hasActiveRecord: false,
    // 计时器
    days: 0,
    hours: 0,
    minutes: 0,
    // 统计
    moneySaved: 0,
    cigarettesAvoided: 0,
    lifeRegained: 0,
    // 里程碑
    nextMilestone: '',
    milestoneDaysLeft: 0,
    milestoneProgress: 0,
    // 年度进度（环形图用）
    yearProgress: 0,
    yearPercent: 0,
    // 鼓励语
    encouragement: '',
    // 用户昵称
    nickName: '',
    // 计时器 interval
    _timer: null
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    // 每次显示页面时重新加载（可能从设置页改了参数）
    this.initPage()
    // 异步从服务端刷新打卡历史（静默，不阻塞UI）
    this.refreshCheckInHistory()
  },

  onHide() {
    // 页面隐藏时暂停计时器（切换Tab时触发）
    if (this.data._timer) {
      clearInterval(this.data._timer)
    }
  },

  onUnload() {
    if (this.data._timer) {
      clearInterval(this.data._timer)
    }
  },

  initPage() {
    const record = storage.getQuitRecord()
    if (!record || !record.quitDate) {
      this.setData({ hasActiveRecord: false })
      return
    }

    // 加载用户昵称
    const userInfo = storage.getUserInfo()
    const nickName = (userInfo && userInfo.nickName) || ''

    this.setData({ hasActiveRecord: true, nickName })
    this.updateDashboard()
    // 启动定时器，每分钟更新
    if (this.data._timer) clearInterval(this.data._timer)
    const timer = setInterval(() => {
      this.updateDashboard()
    }, 60000)
    this.setData({ _timer: timer })
  },

  updateDashboard() {
    const record = storage.getQuitRecord()
    if (!record) return

    const duration = calc.calcQuitDuration(record.quitDate)
    const money = calc.calcMoneySaved(
      duration.days,
      record.cigarettesPerDay || 20,
      record.pricePerPack || 20,
      record.cigarettesPerPack || 20
    )
    const avoided = calc.calcCigarettesAvoided(duration.days, record.cigarettesPerDay || 20)
    const life = calc.calcLifeRegained(avoided)
    const milestone = calc.getNextMilestone(duration.days)
    const progress = milestone.targetDays > 0
      ? Math.min(100, Math.round((duration.days / milestone.targetDays) * 100))
      : 100
    const encouragement = calc.getEncouragement(duration.days)

    // 年度目标 365 天环形进度
    const yearGoal = 365
    const yearPct = Math.min(100, Math.round((duration.days / yearGoal) * 100))
    const yearDeg = (yearPct / 100) * 360

    this.setData({
      days: duration.days,
      hours: duration.hours,
      minutes: duration.minutes,
      moneySaved: money.toFixed(2),
      cigarettesAvoided: avoided,
      lifeRegained: life,
      yearProgress: yearDeg,
      yearPercent: yearPct,
      nextMilestone: milestone.title,
      milestoneDaysLeft: milestone.daysLeft,
      milestoneProgress: progress,
      encouragement
    })
  },

  // 异步刷新打卡历史（从服务端拉取最新数据）
  refreshCheckInHistory() {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    api.getCheckInHistory(month).catch(err => {
      console.warn('[Index] 刷新打卡历史失败:', err.message)
    })
  },

  // 开始戒烟
  onStartQuit() {
    // 使用全局数据传递操作意图（switchTab 不支持 URL 参数）
    const app = getApp()
    app.globalData.pendingAction = 'start'
    wx.switchTab({
      url: '/pages/profile/profile'
    })
  },

  // 烟瘾急救
  onEmergency() {
    wx.vibrateShort({ type: 'medium' })
    wx.switchTab({
      url: '/pages/breathe/breathe'
    })
  },

  // 查看健康时间线
  onViewHealth() {
    wx.switchTab({
      url: '/pages/health/health'
    })
  },

  // 打卡
  onCheckIn() {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    wx.showActionSheet({
      itemList: ['😊 今天状态不错', '😐 一般般', '😰 比较难熬'],
      success: (res) => {
        const moods = ['good', 'normal', 'bad']
        // 本地 + API 同步
        api.checkIn(dateStr, moods[res.tapIndex], '').then(() => {
          wx.showToast({ title: '打卡成功！', icon: 'success' })
        })
      }
    })
  },

  // 分享
  onShareAppMessage() {
    const record = storage.getQuitRecord()
    const days = record ? calc.calcQuitDuration(record.quitDate).days : 0
    return {
      title: `我已经戒烟${days}天了，一起来吧！`,
      path: '/pages/index/index'
    }
  }
}))
