// app.js
const api = require('./utils/api')
const storage = require('./utils/storage')

App({
  onLaunch() {
    // 检查更新
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        }
      })
    })

    // 先加载本地缓存（秒开）
    this.loadUserData()

    // 自动登录并同步远端数据
    this.initApp()

    // 监听网络状态变化
    this.setupNetworkListener()
  },

  /**
   * 应用初始化：登录 + 拉取远端数据
   */
  async initApp() {
    try {
      // 1. 自动登录（注册/获取用户身份），传入当前昵称和头像
      await api.login()
      console.log('[App] 登录成功')

      // 2. 从服务端拉取用户资料（恢复头像昵称）
      try {
        const profileRes = await api.getProfile()
        if (profileRes && profileRes.user) {
          const serverAvatar = profileRes.user.avatar_url || ''
          const serverNick = profileRes.user.nickname || ''
          if (serverAvatar || serverNick) {
            const userInfo = storage.getUserInfo() || {}
            // 服务端有值且本地没有时，用服务端恢复
            if (serverAvatar && !userInfo.avatarUrl) {
              userInfo.avatarUrl = serverAvatar
            }
            if (serverNick && !userInfo.nickName) {
              userInfo.nickName = serverNick
            }
            if (Object.keys(userInfo).length > 0) {
              storage.saveUserInfo(userInfo)
              this.globalData.userInfo = userInfo
            }
          }
        }
      } catch (profileErr) {
        console.warn('[App] 拉取用户资料失败:', profileErr.message)
      }

      // 3. 从服务端拉取最新戒烟记录
      const serverRes = await api.request('/api/quit-record/active', { silent: true })
      if (serverRes && serverRes.record && serverRes.is_active) {
        const serverRecord = serverRes.record
        const localFormat = {
          quitDate: new Date(serverRecord.quit_date).getTime(),
          cigarettesPerDay: serverRecord.cigarettes_per_day,
          pricePerPack: serverRecord.price_per_pack,
          cigarettesPerPack: serverRecord.cigarettes_per_pack,
          yearsSmoked: serverRecord.years_smoked,
          reason: serverRecord.reason || '',
          createdAt: new Date(serverRecord.created_at).getTime()
        }
        // 服务端数据同步到本地
        storage.saveQuitRecord(localFormat)
        this.globalData.quitRecord = localFormat
        this.globalData.hasActiveRecord = true
        console.log('[App] 已从服务端同步戒烟记录')
      }

      // 4. 如果本地有未同步的数据，推送到服务端
      const localRecord = storage.getQuitRecord()
      if (localRecord && localRecord.quitDate && (!serverRes || !serverRes.is_active)) {
        await api.createQuitRecord(localRecord)
        console.log('[App] 本地数据已同步到服务端')
      }
    } catch (err) {
      console.warn('[App] 初始化失败，使用离线模式:', err.message)
    }
  },

  loadUserData() {
    try {
      const quitRecord = wx.getStorageSync('quitRecord')
      if (quitRecord) {
        this.globalData.quitRecord = quitRecord
        this.globalData.hasActiveRecord = true
      }
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = userInfo
      }
      const settings = wx.getStorageSync('settings')
      if (settings) {
        this.globalData.settings = settings
      }
    } catch (e) {
      console.error('加载用户数据失败', e)
    }
  },

  /**
   * 监听网络状态变化
   * 网络恢复时自动同步本地数据到服务器
   */
  setupNetworkListener() {
    wx.onNetworkStatusChange(res => {
      if (res.isConnected) {
        console.log('[App] 网络已恢复，开始同步数据')
        api.syncAllToServer().catch(err => {
          console.warn('[App] 自动同步失败:', err.message)
        })
      }
    })
  },

  globalData: {
    hasActiveRecord: false,
    quitRecord: null,
    userInfo: null,
    settings: {
      cigarettesPerDay: 20,
      pricePerPack: 20,
      cigarettesPerPack: 20,
      yearsSmoked: 5,
      reminderEnabled: false,
      reminderTime: '09:00'
    },
    // 后端 API 基础地址
    apiBaseUrl: 'http://localhost:8080'
  }
})
