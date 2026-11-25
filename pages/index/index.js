const { cloud } = require('../../utils/cloud')
const { notes, publishShare } = require('../../utils/notes-store')

const PRIORITY_CLASS = { '高': 'priority-high', '普通': 'priority-normal', '低': 'priority-low' }

function decorate(note) {
    return { ...note, priorityClass: PRIORITY_CLASS[note.priority] || 'priority-normal' }
}

function isTodayOrOverdue(note) {
    if (!note.dueAt || note.done) return false
    const due = new Date(note.dueAt).getTime()
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return due < todayStart.getTime() + 86400000
}

Page({
    data: {
        authState: 'checking',
        loggingIn: false,
        wechatLoggingIn: false,
        loginError: '',
        loadError: '',
        user: null,
        allNotes: [],
        todayNotes: [],
        filter: '全部',
        filters: ['全部', '工作', '个人', '学习', '其他'],
        shareCode: '',
    },

    async onShow() {
        await this.restore()
    },

    async restore() {
        this.setData({ authState: 'checking', loginError: '' })
        const callback = await getApp().authReady
        const { data: session, error } = callback.error
            ? callback
            : await cloud.auth.getSession()

        if (error || !session) {
            this.setData({
                authState: 'signed-out',
                user: null,
                allNotes: [],
                todayNotes: [],
                loginError: error ? error.message : '',
            })
            return
        }
        this.setData({ authState: 'signed-in', user: session.user })
        await this.loadNotes()
    },

    onWechatLogin() {
        this.setData({ wechatLoggingIn: true, loginError: '' })
        wx.login({
            success: async ({ code }) => {
                if (!code) {
                    this.setData({ wechatLoggingIn: false, loginError: '微信登录失败，请重试' })
                    return
                }
                try {
                    const appid = wx.getAccountInfoSync().miniProgram.appId
                    const { data: session, error } = await cloud.auth.signInWithWechat(code, appid)
                    if (error || !session) {
                        this.setData({
                            wechatLoggingIn: false,
                            loginError: error ? error.message : '微信登录失败，请重试',
                        })
                        return
                    }
                    this.setData({ authState: 'signed-in', user: session.user, wechatLoggingIn: false })
                    await this.loadNotes()
                } catch (e) {
                    console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
                        stage: 'wechat-login-handler',
                        message: e instanceof Error ? e.message : '微信登录失败，请重试',
                    }))
                    this.setData({ wechatLoggingIn: false, loginError: '微信登录失败，请重试' })
                }
            },
            fail: (error) => {
                console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
                    stage: 'wx.login',
                    message: error.errMsg,
                }))
                this.setData({ wechatLoggingIn: false, loginError: error.errMsg || '微信登录失败' })
            },
        })
    },

    async onLogin() {
        this.setData({ loggingIn: true, loginError: '' })
        const { error } = await cloud.auth.signInWithWorkBuddyMiniProgram({
            redirectPath: 'pages/index/index',
        })
        this.setData({
            loggingIn: false,
            loginError: error && error.code !== 'cancelled' ? error.message : '',
        })
    },

    async loadNotes() {
        this.setData({ loadError: '' })
        const { data, error } = await notes.list()
        if (error) {
            this.setData({ loadError: error.message || '加载失败', allNotes: [], todayNotes: [] })
            return
        }
        const all = (data || []).map(decorate)
        const today = all.filter(isTodayOrOverdue)
        this.setData({ allNotes: all, todayNotes: today })
    },

    onFilterTap(e) {
        this.setData({ filter: e.currentTarget.dataset.value })
    },

    onAdd() {
        wx.navigateTo({ url: '/pages/edit/edit' })
    },

    onEdit(e) {
        wx.navigateTo({ url: '/pages/edit/edit?id=' + e.currentTarget.dataset.id })
    },

    async onToggleDone(e) {
        const note = this.data.allNotes.find((n) => String(n.id) === String(e.currentTarget.dataset.id))
        if (!note) return
        await notes.update(note.id, { done: !note.done })
        await this.loadNotes()
    },

    async onShare(e) {
        const note = this.data.allNotes.find((n) => String(n.id) === String(e.currentTarget.dataset.id))
        if (!note) return
        const { data, error } = await publishShare(note)
        if (error) {
            wx.showToast({ title: error.message || '分享失败', icon: 'none' })
            return
        }
        wx.showModal({
            title: '分享码已生成',
            content: '把下面这串码发给对方，对方在「共享备忘」页输入即可查看：\n\n' + data.token,
            confirmText: '复制',
            success: (res) => {
                if (res.confirm) wx.setClipboardData({ data: data.token })
            },
        })
        await this.loadNotes()
    },

    onOpenShared() {
        wx.navigateTo({ url: '/pages/shared/shared' })
    },

    async onLogout() {
        await cloud.auth.signOut()
        await this.restore()
    },
})
