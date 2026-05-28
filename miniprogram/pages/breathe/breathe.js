// pages/breathe/breathe.js - 烟瘾急救呼吸引导页
const storage = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    // 呼吸状态
    isBreathing: false,
    phase: 'ready', // ready / inhale / hold / exhale / done
    phaseText: '准备开始',
    phaseDesc: '当你感到烟瘾来袭时，跟随引导呼吸',
    // 4-7-8 呼吸法
    inhaleTime: 4,
    holdTime: 7,
    exhaleTime: 8,
    // 动画
    circleScale: 1,
    circleOpacity: 0.6,
    // 倒计时
    countdown: 0,
    // 触发场景
    triggers: [
      { id: 'stress', label: '😰 压力大', selected: false },
      { id: 'social', label: '👥 社交场合', selected: false },
      { id: 'boredom', label: '😴 无聊', selected: false },
      { id: 'habit', label: '🔄 习惯性', selected: false },
      { id: 'other', label: '🤔 其他', selected: false }
    ],
    selectedTrigger: '',
    // 完成次数
    completedRounds: 0,
    totalRounds: 3
  },

  // 选择触发场景
  onSelectTrigger(e) {
    const id = e.currentTarget.dataset.id
    const triggers = this.data.triggers.map(t => ({
      ...t,
      selected: t.id === id
    }))
    this.setData({ triggers, selectedTrigger: id })
  },

  // 开始呼吸
  onStartBreathe() {
    if (this.data.isBreathing) return
    this.setData({
      isBreathing: true,
      completedRounds: 0
    })
    this.startInhale()
  },

  // 吸气阶段
  startInhale() {
    this.setData({
      phase: 'inhale',
      phaseText: '慢慢吸气',
      phaseDesc: '通过鼻子缓慢深吸',
      countdown: this.data.inhaleTime,
      circleScale: 1.8,
      circleOpacity: 1
    })
    this.runCountdown(this.data.inhaleTime, () => this.startHold())
  },

  // 屏气阶段
  startHold() {
    this.setData({
      phase: 'hold',
      phaseText: '屏住呼吸',
      phaseDesc: '保持，让氧气充分交换',
      countdown: this.data.holdTime
    })
    this.runCountdown(this.data.holdTime, () => this.startExhale())
  },

  // 呼气阶段
  startExhale() {
    this.setData({
      phase: 'exhale',
      phaseText: '缓慢呼气',
      phaseDesc: '通过嘴巴慢慢吐出',
      countdown: this.data.exhaleTime,
      circleScale: 1,
      circleOpacity: 0.6
    })
    this.runCountdown(this.data.exhaleTime, () => {
      const rounds = this.data.completedRounds + 1
      this.setData({ completedRounds: rounds })

      if (rounds >= this.data.totalRounds) {
        this.onBreatheComplete()
      } else {
        this.startInhale()
      }
    })
  },

  // 倒计时
  runCountdown(seconds, callback) {
    let remaining = seconds
    this.setData({ countdown: remaining })

    this._timer = setInterval(() => {
      remaining--
      this.setData({ countdown: remaining })
      if (remaining <= 0) {
        clearInterval(this._timer)
        callback()
      }
    }, 1000)
  },

  // 呼吸完成
  onBreatheComplete() {
    this.setData({
      phase: 'done',
      phaseText: '🎉 你做到了！',
      phaseDesc: '烟瘾已经过去了，你很棒！',
      isBreathing: false
    })

    // 记录烟瘾（本地 + API 同步）
    if (this.data.selectedTrigger) {
      api.createCraving(this.data.selectedTrigger, 3, 'breathe').catch(err => {
        console.warn('[Breathe] 同步烟瘾记录失败:', err.message)
      })
    }
  },

  // 重新开始
  onReset() {
    if (this._timer) clearInterval(this._timer)
    this.setData({
      isBreathing: false,
      phase: 'ready',
      phaseText: '准备开始',
      phaseDesc: '当你感到烟瘾来袭时，跟随引导呼吸',
      countdown: 0,
      circleScale: 1,
      circleOpacity: 0.6,
      completedRounds: 0
    })
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '4-7-8呼吸法帮我度过了烟瘾！',
      path: '/pages/breathe/breathe'
    }
  }
})
