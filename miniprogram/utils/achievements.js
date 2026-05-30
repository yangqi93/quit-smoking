// utils/achievements.js - 成就徽章系统

/**
 * 全部成就定义
 * id: 唯一标识（用于持久化）
 * icon: emoji
 * title: 名称
 * desc: 描述
 * category: 'time' | 'money' | 'health' | 'special'
 * condition(stats): 判断是否解锁的函数，stats = { days, moneySaved, cigarettesAvoided, checkins }
 */
const ACHIEVEMENTS = [
  // ── 时间类 ──────────────────────────────────
  {
    id: 'day_1',
    icon: '🌱',
    title: '第一天',
    desc: '完成戒烟第1天',
    category: 'time',
    condition: s => s.days >= 1
  },
  {
    id: 'day_3',
    icon: '🔥',
    title: '三天之约',
    desc: '坚持3天，度过最难的尼古丁戒断期',
    category: 'time',
    condition: s => s.days >= 3
  },
  {
    id: 'day_7',
    icon: '⭐',
    title: '一周战士',
    desc: '坚持整整一周',
    category: 'time',
    condition: s => s.days >= 7
  },
  {
    id: 'day_14',
    icon: '💪',
    title: '两周勇士',
    desc: '坚持两周，血液循环已大幅改善',
    category: 'time',
    condition: s => s.days >= 14
  },
  {
    id: 'day_30',
    icon: '🏆',
    title: '满月达人',
    desc: '一个月！肺功能提升约30%',
    category: 'time',
    condition: s => s.days >= 30
  },
  {
    id: 'day_90',
    icon: '💎',
    title: '季度英雄',
    desc: '三个月，运动耐力明显提升',
    category: 'time',
    condition: s => s.days >= 90
  },
  {
    id: 'day_180',
    icon: '🌟',
    title: '半年传说',
    desc: '半年了，几乎不再有烟瘾',
    category: 'time',
    condition: s => s.days >= 180
  },
  {
    id: 'day_365',
    icon: '👑',
    title: '一年王者',
    desc: '整整一年！冠心病风险降低50%',
    category: 'time',
    condition: s => s.days >= 365
  },
  {
    id: 'day_730',
    icon: '🦁',
    title: '两年雄狮',
    desc: '两年，心脏病风险接近非吸烟者',
    category: 'time',
    condition: s => s.days >= 730
  },
  // ── 金钱类 ──────────────────────────────────
  {
    id: 'money_100',
    icon: '💰',
    title: '省下百元',
    desc: '节省了100元',
    category: 'money',
    condition: s => s.moneySaved >= 100
  },
  {
    id: 'money_500',
    icon: '💵',
    title: '省下五百',
    desc: '节省了500元，够吃一顿好的！',
    category: 'money',
    condition: s => s.moneySaved >= 500
  },
  {
    id: 'money_1000',
    icon: '🤑',
    title: '千元储蓄',
    desc: '节省了1000元！',
    category: 'money',
    condition: s => s.moneySaved >= 1000
  },
  {
    id: 'money_5000',
    icon: '💎',
    title: '万元富翁',
    desc: '节省超过5000元，够买部新手机了！',
    category: 'money',
    condition: s => s.moneySaved >= 5000
  },
  // ── 健康类 ──────────────────────────────────
  {
    id: 'cig_100',
    icon: '🫁',
    title: '百支未燃',
    desc: '避免了100支烟进入肺部',
    category: 'health',
    condition: s => s.cigarettesAvoided >= 100
  },
  {
    id: 'cig_500',
    icon: '🌬️',
    title: '肺部感谢',
    desc: '避免了500支烟进入肺部',
    category: 'health',
    condition: s => s.cigarettesAvoided >= 500
  },
  {
    id: 'cig_1000',
    icon: '🫀',
    title: '千支未燃',
    desc: '避免了1000支烟，心脏感谢你',
    category: 'health',
    condition: s => s.cigarettesAvoided >= 1000
  },
  // ── 打卡类 ──────────────────────────────────
  {
    id: 'checkin_3',
    icon: '✅',
    title: '打卡新手',
    desc: '累计打卡3次',
    category: 'special',
    condition: s => s.checkins >= 3
  },
  {
    id: 'checkin_7',
    icon: '📅',
    title: '打卡达人',
    desc: '累计打卡7次',
    category: 'special',
    condition: s => s.checkins >= 7
  },
  {
    id: 'checkin_30',
    icon: '🗓️',
    title: '打卡王者',
    desc: '累计打卡30次，习惯的力量',
    category: 'special',
    condition: s => s.checkins >= 30
  }
]

/**
 * 根据统计数据计算已解锁的成就
 * @param {object} stats { days, moneySaved, cigarettesAvoided, checkins }
 * @returns {string[]} 已解锁成就的 id 列表
 */
function calcUnlockedIds(stats) {
  return ACHIEVEMENTS
    .filter(a => a.condition(stats))
    .map(a => a.id)
}

/**
 * 获取带解锁状态的完整成就列表（用于 UI 展示）
 * @param {string[]} unlockedIds 已解锁的 id 列表
 * @returns {Array} achievements with `unlocked` field
 */
function getAchievementsWithStatus(unlockedIds) {
  const set = new Set(unlockedIds)
  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: set.has(a.id)
  }))
}

/**
 * 检测新解锁的成就（本次新增）
 * @param {string[]} prevIds 上次已解锁
 * @param {string[]} currentIds 本次已解锁
 * @returns {Array} 新解锁的成就对象列表
 */
function detectNewAchievements(prevIds, currentIds) {
  const prevSet = new Set(prevIds)
  const newIds = currentIds.filter(id => !prevSet.has(id))
  return ACHIEVEMENTS.filter(a => newIds.includes(a.id))
}

module.exports = {
  ACHIEVEMENTS,
  calcUnlockedIds,
  getAchievementsWithStatus,
  detectNewAchievements
}
