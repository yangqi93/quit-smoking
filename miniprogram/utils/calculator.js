// utils/calculator.js - 计算工具函数

/**
 * 计算戒烟时长
 * @param {string|number} quitDate 戒烟开始时间
 * @returns {object} { days, hours, minutes, totalMinutes }
 */
function calcQuitDuration(quitDate) {
  const start = new Date(quitDate)
  const now = new Date()
  const diff = now - start

  if (diff < 0) {
    return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 }
  }

  const totalMinutes = Math.floor(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const days = Math.floor(hours / 24)

  return { days, hours, minutes, totalMinutes }
}

/**
 * 计算省钱金额
 * @param {number} days 戒烟天数
 * @param {number} cigarettesPerDay 每天抽烟数
 * @param {number} pricePerPack 每包价格
 * @param {number} cigarettesPerPack 每包支数
 * @returns {number} 省下金额
 */
function calcMoneySaved(days, cigarettesPerDay, pricePerPack, cigarettesPerPack) {
  if (!cigarettesPerPack) cigarettesPerPack = 20
  const pricePerCig = pricePerPack / cigarettesPerPack
  return Math.round(cigarettesPerDay * pricePerCig * days * 100) / 100
}

/**
 * 计算少抽烟数
 * @param {number} days 戒烟天数
 * @param {number} cigarettesPerDay 每天抽烟数
 * @returns {number}
 */
function calcCigarettesAvoided(days, cigarettesPerDay) {
  return cigarettesPerDay * days
}

/**
 * 计算重获生命时长（小时）
 * WHO: 每支烟减少约11分钟生命
 * @param {number} cigarettesAvoided 避免的烟支数
 * @returns {number} 小时
 */
function calcLifeRegained(cigarettesAvoided) {
  return Math.round(cigarettesAvoided * 11 / 60 * 10) / 10
}

/**
 * 获取下一个里程碑
 * @param {number} daysQuit 已戒烟天数
 * @returns {object} { title, daysLeft, targetDays }
 */
function getNextMilestone(daysQuit) {
  const milestones = [
    { days: 1, title: '第1天' },
    { days: 3, title: '第3天' },
    { days: 7, title: '一周' },
    { days: 14, title: '两周' },
    { days: 30, title: '一个月' },
    { days: 90, title: '三个月' },
    { days: 180, title: '半年' },
    { days: 365, title: '一年' },
    { days: 730, title: '两年' },
    { days: 1825, title: '五年' },
    { days: 3650, title: '十年' }
  ]

  for (const m of milestones) {
    if (daysQuit < m.days) {
      return { title: m.title, daysLeft: m.days - daysQuit, targetDays: m.days }
    }
  }
  return { title: '传奇', daysLeft: 0, targetDays: daysQuit }
}

/**
 * WHO 健康恢复时间线
 * @returns {Array}
 */
function getHealthMilestones() {
  return [
    { hours: 0, title: '开始戒烟', desc: '心率开始恢复正常', category: 'immediate' },
    { hours: 8, title: '8小时', desc: '血液中一氧化碳降低，氧气恢复正常', category: 'immediate' },
    { hours: 24, title: '24小时', desc: '心脏病发作风险开始降低', category: 'immediate' },
    { hours: 48, title: '48小时', desc: '味觉和嗅觉开始改善', category: 'short' },
    { hours: 72, title: '72小时', desc: '呼吸变得更轻松', category: 'short' },
    { hours: 168, title: '1周', desc: '肺活量开始增加', category: 'short' },
    { hours: 336, title: '2周', desc: '血液循环改善，皮肤变好', category: 'medium' },
    { hours: 720, title: '1个月', desc: '肺功能提升约30%', category: 'medium' },
    { hours: 2160, title: '3个月', desc: '运动耐力明显提升', category: 'medium' },
    { hours: 4320, title: '6个月', desc: '呼吸问题显著减少', category: 'medium' },
    { hours: 8760, title: '1年', desc: '冠心病风险降低50%', category: 'long' },
    { hours: 17520, title: '2年', desc: '心脏病风险接近非吸烟者', category: 'long' },
    { hours: 43800, title: '5年', desc: '中风风险降至非吸烟者水平', category: 'long' },
    { hours: 87600, title: '10年', desc: '肺癌风险降低一半', category: 'long' },
    { hours: 175200, title: '20年', desc: '所有风险接近非吸烟者', category: 'long' }
  ]
}

/**
 * 格式化时长
 * @param {number} hours 小时数
 * @returns {string}
 */
function formatDuration(hours) {
  if (hours < 24) return Math.round(hours) + '小时'
  const days = hours / 24
  if (days < 30) return Math.round(days) + '天'
  const months = days / 30
  if (months < 12) return Math.round(months) + '个月'
  return (months / 12).toFixed(1) + '年'
}

/**
 * 获取戒烟天数对应鼓励语
 * @param {number} days
 * @returns {string}
 */
function getEncouragement(days) {
  if (days === 0) return '今天是你戒烟的第一天，你做到了！'
  if (days === 1) return '最难的第一天已经过去了！'
  if (days < 3) return '坚持住，前三天是关键期！'
  if (days < 7) return '你正在度过尼古丁戒断期，很棒！'
  if (days < 14) return '一周了！你的身体已经开始恢复！'
  if (days < 30) return '两周以上了，你是个真正的勇士！'
  if (days < 90) return '一个月了！肺功能已经提升了30%！'
  if (days < 180) return '三个月了，运动耐力大大提升！'
  if (days < 365) return '半年了，你几乎不再想抽烟了！'
  if (days < 730) return '一年了！冠心病风险降低了50%！'
  return '你是戒烟传奇，致敬！'
}

module.exports = {
  calcQuitDuration,
  calcMoneySaved,
  calcCigarettesAvoided,
  calcLifeRegained,
  getNextMilestone,
  getHealthMilestones,
  formatDuration,
  getEncouragement
}
