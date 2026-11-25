const { notes } = require('../../utils/notes-store')
const { SUBSCRIBE_TEMPLATE_IDS } = require('../../utils/config')

const CATEGORIES = ['工作', '个人', '学习', '其他']
const PRIORITIES = ['高', '普通', '低']

Page({
    data: {
        id: null,
        title: '',
        content: '',
        category: '工作',
        priority: '普通',
        dueDate: '',
        dueTime: '',
        categories: CATEGORIES,
        priorities: PRIORITIES,
        saving: false,
    },

    async onLoad(options) {
        if (options.id) {
            const { data, error } = await notes.list()
            const note = error ? null : (data || []).find((n) => String(n.id) === options.id)
            if (note) {
                let dueDate = ''
                let dueTime = ''
                if (note.dueAt) {
                    const d = new Date(note.dueAt)
                    const pad = (n) => (n < 10 ? '0' + n : '' + n)
                    dueDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
                    dueTime = pad(d.getHours()) + ':' + pad(d.getMinutes())
                }
                this.setData({
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    category: note.category,
                    priority: note.priority,
                    dueDate,
                    dueTime,
                })
                wx.setNavigationBarTitle({ title: '编辑备忘' })
            }
        }
    },

    onTitleInput(e) { this.setData({ title: e.detail.value }) },
    onContentInput(e) { this.setData({ content: e.detail.value }) },
    onDateChange(e) { this.setData({ dueDate: e.detail.value }) },
    onTimeChange(e) { this.setData({ dueTime: e.detail.value }) },

    onCategoryTap(e) { this.setData({ category: e.currentTarget.dataset.value }) },
    onPriorityTap(e) { this.setData({ priority: e.currentTarget.dataset.value }) },

    requestSubscribe() {
        if (!this.data.dueDate || SUBSCRIBE_TEMPLATE_IDS.length === 0) return
        wx.requestSubscribeMessage({
            tmplIds: SUBSCRIBE_TEMPLATE_IDS,
            success() {},
            fail() {},
        })
    },

    async onSave() {
        const { title, content, category, priority, dueDate, dueTime, id } = this.data
        if (!title.trim()) {
            wx.showToast({ title: '请输入标题', icon: 'none' })
            return
        }
        let dueAt = ''
        if (dueDate) {
            dueAt = dueTime ? dueDate + 'T' + dueTime + ':00+08:00' : dueDate + 'T09:00:00+08:00'
        }
        this.setData({ saving: true })
        const payload = { title, content, category, priority, dueAt }
        const result = id
            ? await notes.update(id, payload)
            : await notes.create(payload)
        this.setData({ saving: false })
        if (result.error || (!id && !result.data)) {
            wx.showToast({ title: (result.error && result.error.message) || '保存失败', icon: 'none' })
            return
        }
        this.requestSubscribe()
        wx.showToast({ title: '已保存到云端', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
    },

    async onDelete() {
        if (!this.data.id) return
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除这条备忘？',
                content: '删除后无法恢复',
                success: (res) => resolve(res.confirm),
            })
        })
        if (!confirm) return
        const { error } = await notes.remove(this.data.id)
        if (error) {
            wx.showToast({ title: error.message || '删除失败', icon: 'none' })
            return
        }
        wx.navigateBack()
    },
})
