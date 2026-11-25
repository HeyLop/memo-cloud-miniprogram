const { cloud } = require('./cloud')
const { createTableAccess } = require('./workbuddy-data-access')

function formatDateTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function mapNote(row) {
    return {
        id: row.id,
        title: row.title || row.text || '未命名',
        content: row.content || '',
        category: row.category || '工作',
        priority: row.priority || '普通',
        dueAt: row.due_at || '',
        dueText: formatDateTime(row.due_at),
        done: !!row.done,
        shareToken: row.share_token || '',
        createdAt: row.created_at,
    }
}

const notes = createTableAccess(cloud, {
    table: 'notes',
    columns: ['id', 'title', 'content', 'category', 'priority', 'due_at', 'done', 'share_token', 'created_at'],
    fromRow: mapNote,
    toRow(payload) {
        const row = {}
        if (typeof payload.title === 'string' && payload.title.trim()) row.title = payload.title.trim()
        if (typeof payload.content === 'string') row.content = payload.content
        if (typeof payload.category === 'string' && payload.category.trim()) row.category = payload.category.trim()
        if (typeof payload.priority === 'string' && payload.priority.trim()) row.priority = payload.priority.trim()
        if (typeof payload.dueAt === 'string' && payload.dueAt) row.due_at = payload.dueAt
        if (typeof payload.done === 'boolean') row.done = payload.done
        if (typeof payload.shareToken === 'string') row.share_token = payload.shareToken
        row.text = row.title || ''
        return row
    },
    orderBy: { column: 'created_at', ascending: false },
})

function makeShareToken() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let s = ''
    for (let i = 0; i < 10; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return s
}

async function publishShare(note) {
    const token = note.shareToken || makeShareToken()
    const row = {
        token,
        title: note.title || '',
        content: note.content || '',
        category: note.category || '工作',
        priority: note.priority || '普通',
        due_at: note.dueAt || null,
        done: !!note.done,
    }
    const existing = await cloud.database.from('notes_share').select('id').eq('token', token).maybeSingle()
    if (existing && existing.data) {
        const { error } = await cloud.database.from('notes_share').update(row).eq('token', token)
        if (error) return { error }
    } else {
        const { error } = await cloud.database.from('notes_share').insert(row)
        if (error) return { error }
    }
    if (!note.shareToken) {
        await notes.update(note.id, { shareToken: token })
    }
    return { data: { token } }
}

async function getShared(token) {
    if (!token) return { data: null, error: { message: '缺少分享码' } }
    const { data, error } = await cloud.database
        .from('notes_share')
        .select('title, content, category, priority, due_at, done, created_at')
        .eq('token', token)
        .maybeSingle()
    if (error) return { data: null, error }
    if (!data) return { data: null, error: { message: '分享码不存在或已失效' } }
    return { data: mapNote(data) }
}

module.exports = { notes, publishShare, getShared, makeShareToken, formatDateTime }
