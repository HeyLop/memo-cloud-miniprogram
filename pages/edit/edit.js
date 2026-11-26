const { notes } = require('../../utils/todo-store')

const PRIORITIES = [
    { value: 'high', label: '高' },
    { value: 'normal', label: '普通' },
    { value: 'low', label: '低' },
]

Page({
    data: {
        id: null,
        title: '',
        content: '',
        zone: 'work',
        priority: 'normal',
        dueDate: '',
        dueTime: '',
        priorities: PRIORITIES,
        parseMeta: null,
        saving: false,
    },

    async onLoad(options) {
        // 草稿预填（来自首页 NLP 解析结果）
        if (options.draft) {
            try {
                const draft = JSON.parse(decodeURIComponent(options.draft))
                const patch = { title: draft.title || '', zone: draft.zone || 'work', parseMeta: draft.parseMeta || null }
                if (draft.dueAt) {
                    const d = new Date(draft.dueAt)
                    const pad = (n) => (n < 10 ? '0' + n : '' + n)
                    patch.dueDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
                    patch.dueTime = pad(d.getHours()) + ':' + pad(d.getMinutes())
                }
                this.setData(patch)
                wx.setNavigationBarTitle({ title: '确认草稿' })
                return
            } catch (e) { /* 草稿解析失败，走普通新建 */ }
        }
        // 编辑已有
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
                    zone: note.zone,
                    priority: note.priority,
                    dueDate,
                    dueTime,
                    parseMeta: note.parseMeta,
                })
                wx.setNavigationBarTitle({ title: '编辑待办' })
            }
        }
    },

    onTitleInput(e) { this.setData({ title: e.detail.value }) },
    onContentInput(e) { this.setData({ content: e.detail.value }) },
    onDateChange(e) { this.setData({ dueDate: e.detail.value }) },
    onTimeChange(e) { this.setData({ dueTime: e.detail.value }) },
    onZoneTap(e) { this.setData({ zone: e.currentTarget.dataset.zone }) },
    onPriorityTap(e) { this.setData({ priority: e.currentTarget.dataset.value }) },

    async onSave() {
        const { title, content, zone, priority, dueDate, dueTime, id, parseMeta } = this.data
        if (!title.trim()) {
            wx.showToast({ title: '请输入标题', icon: 'none' })
            return
        }
        let dueAt = ''
        if (dueDate) {
            dueAt = dueTime ? dueDate + 'T' + dueTime + ':00+08:00' : dueDate + 'T09:00:00+08:00'
        }
        this.setData({ saving: true })
        const payload = { title, content, zone, priority, dueAt }
        if (parseMeta && !id) payload.parseMeta = parseMeta
        const result = id ? await notes.update(id, payload) : await notes.create(payload)
        this.setData({ saving: false })
        if (result.error || (!id && !result.data)) {
            wx.showToast({ title: (result.error && result.error.message) || '保存失败', icon: 'none' })
            return
        }
        // D11：本版不请求订阅授权（推送二期）
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
    },

    async onDelete() {
        if (!this.data.id) return
        const confirm = await new Promise((resolve) => {
            wx.showModal({
                title: '删除这条待办？',
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
