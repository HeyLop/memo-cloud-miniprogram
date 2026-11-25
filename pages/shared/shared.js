const { getShared } = require('../../utils/notes-store')

Page({
    data: {
        token: '',
        inputCode: '',
        note: null,
        loading: false,
        error: '',
        checked: false,
    },

    onLoad(options) {
        const token = options.code || ''
        this.setData({ token, inputCode: token })
        if (token) this.loadShared(token)
    },

    onCodeInput(e) {
        this.setData({ inputCode: e.detail.value.trim() })
    },

    onLookup() {
        const code = this.data.inputCode
        if (!code) {
            this.setData({ error: '请输入分享码', checked: true })
            return
        }
        this.loadShared(code)
    },

    async loadShared(token) {
        this.setData({ loading: true, error: '', checked: true })
        const { data, error } = await getShared(token)
        this.setData({
            loading: false,
            note: data || null,
            token,
            error: error ? error.message : '',
        })
    },

    onCopyLink() {
        wx.setClipboardData({ data: this.data.token })
    },
})
