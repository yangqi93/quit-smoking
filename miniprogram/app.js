// app.js
const config = require('./config')
const api = require('./utils/api')
const storage = require('./utils/storage')
const theme = require('./utils/theme')

App({
  onLaunch() {
    // 初始化主题
    this._initTheme()

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
      // 1. 自动登录（带重试，应对 Docker 启动时端口未就绪）
      await this._retryLogin()
      console.log('[App] 登录成功')

      // 2. 从服务端拉取用户资料（恢复头像昵称）
      try {
        const profileRes = await api.getProfile({ silent: true })
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
   * 初始化主题
   */
  _initTheme() {
    const mode = theme.getMode()
    const cls = theme.resolveThemeClass(mode)
    this.globalData.themeMode = mode
    this.globalData.themeClass = cls

    // 应用主题到系统栏
    theme.applySystemBars(mode)

    // 监听系统主题变化（仅在 auto 模式下生效）
    wx.onThemeChange(({ theme: sysTheme }) => {
      if (theme.getMode() === 'auto') {
        const newCls = sysTheme === 'dark' ? 'theme-dark' : ''
        if (this.globalData.themeClass !== newCls) {
          this.globalData.themeClass = newCls
          this.globalData.themeMode = 'auto'
          // 更新系统栏 + 通知页面（直接传入 sysTheme 避免 getSystemInfoSync 不同步）
          theme.applySystemBars('auto', sysTheme)
          this._notifyThemeChange(newCls)
        }
      }
    })
  },

  /**
   * 通知各页面主题已变化
   */
  _notifyThemeChange(cls) {
    const pages = getCurrentPages()
    pages.forEach(page => {
      if (page.updatePageTheme) {
        page.updatePageTheme(cls)
      } else {
        // fallback: 直接 setData
        page.setData({ themeClass: cls || '' })
      }
    })
  },

  /**
   * 带退避重试的登录
   * 解决服务器 Docker 启动时 HTTP 端口尚未监听导致的 ERR_CONNECTION_REFUSED
   */
  async _retryLogin(maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          console.log(`[App] 登录重试第 ${i} 次，等待 ${baseDelay * i}ms...`)
          await new Promise(r => setTimeout(r, baseDelay * i))
        }
        await api.login()
        return
      } catch (err) {
        if (i === maxRetries - 1) throw err
        console.warn(`[App] 登录失败，准备重试:`, err.message)
      }
    }
  },

  /**
   * 应用初始化：登录 + 拉取远端数据
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
    themeMode: 'auto',
    themeClass: '',
    settings: {
      cigarettesPerDay: 20,
      pricePerPack: 20,
      cigarettesPerPack: 20,
      yearsSmoked: 5,
      reminderEnabled: false,
      reminderTime: '09:00'
    }
  }
})
