const { cloud } = require('../../utils/cloud')
const { notes } = require('../../utils/todo-store')
const { parseTodo } = require('../../utils/parse-todo')

const PRIORITY_BADGE = { high: 'badge-high', normal: 'badge-normal', low: 'badge-low' }

function decorate(note) {
    const due = note.dueAt ? new Date(note.dueAt).getTime() : 0
    return {
        ...note,
        badgeClass: PRIORITY_BADGE[note.priority] || 'badge-normal',
        isOverdue: !note.done && due > 0 && due < Date.now(),
    }
}

function isTodayOrOverdue(note) {
    if (!note.dueAt || note.done) return false
    const due = new Date(note.dueAt).getTime()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return due < todayStart.getTime() + 86400000
}

function sortByPriorityAndTime(a, b) {
    const rank = { high: 0, normal: 1, low: 2 }
    const pa = rank[a.priority] === undefined ? 1 : rank[a.priority]
    const pb = rank[b.priority] === undefined ? 1 : rank[b.priority]
    if (pa !== pb) return pa - pb
    return (a.dueAt || '').localeCompare(b.dueAt || '')
}

Page({
    data: {
        authState: 'checking',
        loggingIn: false,
        wechatLoggingIn: false,
        loginError: '',
        loadError: '',
        user: null,
        zone: 'work',
        allNotes: [],
        visibleNotes: [],
        todayNotes: [],
        inputText: '',
        draft: null,
    },

    async onShow() {
        await this.restore()
    },

    async restore() {
        this.setData({ authState: 'checking', loginError: '' })
        const callback = (await getApp().authReady) || {}
        const { data: session, error } = callback.error ? callback : await cloud.auth.getSession()
        if (error || !session) {
            this.setData({ authState: 'signed-out', user: null, allNotes: [], visibleNotes: [], todayNotes: [] })
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
                        this.setData({ wechatLoggingIn: false, loginError: error ? error.message : '微信登录失败' })
                        return
                    }
                    this.setData({ authState: 'signed-in', user: session.user, wechatLoggingIn: false })
                    await this.loadNotes()
                } catch (e) {
                    this.setData({ wechatLoggingIn: false, loginError: '微信登录失败，请重试' })
                }
            },
            fail: (error) => {
                this.setData({ wechatLoggingIn: false, loginError: error.errMsg || '微信登录失败' })
            },
        })
    },

    async onLogin() {
        this.setData({ loggingIn: true, loginError: '' })
        const { error } = await cloud.auth.signInWithWorkBuddyMiniProgram({ redirectPath: 'pages/index/index' })
        this.setData({ loggingIn: false, loginError: error && error.code !== 'cancelled' ? error.message : '' })
    },

    async loadNotes() {
        this.setData({ loadError: '' })
        const { data, error } = await notes.list()
        if (error) {
            this.setData({ loadError: error.message || '加载失败', allNotes: [], visibleNotes: [], todayNotes: [] })
            return
        }
        const all = (data || []).map(decorate)
        this.applyZone(all, this.data.zone)
    },

    applyZone(all, zone) {
        const inZone = all.filter((n) => n.zone === zone)
        const today = inZone.filter(isTodayOrOverdue).sort(sortByPriorityAndTime)
        this.setData({ allNotes: all, visibleNotes: inZone, todayNotes: today, zone })
        // D9：导航栏随分区变色（CSS 变量无法穿透原生导航栏）
        wx.setNavigationBarColor({
            frontColor: '#ffffff',
            backgroundColor: zone === 'life' ? '#d9730d' : '#1769e0',
        })
    },

    onZoneSwitch(e) {
        this.applyZone(this.data.allNotes, e.currentTarget.dataset.zone)
    },

    onInput(e) {
        this.setData({ inputText: e.detail.value })
    },

    onAdd() {
        const text = (this.data.inputText || '').trim()
        if (!text) return
        const parsed = parseTodo(text, this.data.zone)
        this.setData({ draft: { ...parsed, rawText: text }, inputText: '' })
    },

    onDraftConfirm() {
        const draft = this.data.draft
        if (!draft) return
        const query = '?draft=' + encodeURIComponent(JSON.stringify(draft))
        this.setData({ draft: null })
        wx.navigateTo({ url: '/pages/edit/edit' + query })
    },

    onDraftCancel() {
        const rawText = this.data.draft ? this.data.draft.rawText : ''
        this.setData({ draft: null, inputText: rawText })
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

    async onLogout() {
        await cloud.auth.signOut()
        await this.restore()
    },
})
