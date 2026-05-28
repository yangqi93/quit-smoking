// pages/health/health.js - 健康恢复时间线
const calc = require('../../utils/calculator')
const storage = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    isActive: false,
    hoursElapsed: 0,
    timeline: [],
    // 统计摘要
    achievedCount: 0,
    totalCount: 0,
    progressPercent: 0
  },

  onLoad() {
    this.loadTimeline()
  },

  onShow() {
    this.loadTimeline()
    // 异步从服务端刷新时间线数据
    this.refreshFromServer()
  },

  loadTimeline() {
    const record = storage.getQuitRecord()
    if (!record || !record.quitDate) {
      this.setData({ isActive: false })
      return
    }

    const duration = calc.calcQuitDuration(record.quitDate)
    const hoursElapsed = duration.hours // 已经是总小时数
    const milestones = calc.getHealthMilestones()

    let achievedCount = 0
    const timeline = milestones.map(m => {
      const achieved = hoursElapsed >= m.hours
      if (achieved) achievedCount++

      let timeLeft = ''
      if (!achieved) {
        const remaining = m.hours - hoursElapsed
        timeLeft = calc.formatDuration(remaining)
      }

      return {
        ...m,
        achieved,
        timeLeft,
        daysFromNow: m.hours < 24
          ? `${m.hours}小时`
          : `${Math.round(m.hours / 24)}天`
      }
    })

    this.setData({
      isActive: true,
      hoursElapsed,
      timeline,
      achievedCount,
      totalCount: milestones.length,
      progressPercent: Math.round((achievedCount / milestones.length) * 100)
    })
  },

  /**
   * 从服务端异步刷新时间线数据
   * 服务端返回的里程碑状态更准确（带已达成/未达成标记）
   */
  async refreshFromServer() {
    try {
      const res = await api.getHealthTimeline()
      if (res && res.milestones && res.milestones.length > 0) {
        // 用服务端数据更新时间线（含达成状态）
        const timeline = res.milestones.map(m => ({
          ...m,
          achieved: m.achieved,
          daysFromNow: m.hours < 24
            ? `${m.hours}小时`
            : `${Math.round(m.hours / 24)}天`
        }))
        const achievedCount = timeline.filter(m => m.achieved).length
        this.setData({
          timeline,
          achievedCount,
          progressPercent: Math.round((achievedCount / timeline.length) * 100)
        })
      }
    } catch (err) {
      console.warn('[Health] 刷新服务端时间线失败:', err.message)
    }
  },

  // 分享
  onShareAppMessage() {
    const record = storage.getQuitRecord()
    const days = record ? calc.calcQuitDuration(record.quitDate).days : 0
    return {
      title: `我戒烟${days}天了，身体正在恢复中！`,
      path: '/pages/health/health'
    }
  }
})
