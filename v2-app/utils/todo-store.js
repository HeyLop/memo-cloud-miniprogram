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
        title: row.title || '未命名',
        content: row.content || '',
        zone: row.zone || 'work',
        priority: row.priority || 'normal',
        dueAt: row.due_at || '',
        dueText: formatDateTime(row.due_at),
        done: !!row.done,
        parseMeta: row.parse_meta || null,
        createdAt: row.created_at,
    }
}

const notes = createTableAccess(cloud, {
    table: 'notes',
    columns: ['id', 'title', 'content', 'zone', 'priority', 'due_at', 'done', 'parse_meta', 'created_at'],
    fromRow: mapNote,
    toRow(payload) {
        const row = {}
        if (typeof payload.title === 'string' && payload.title.trim()) row.title = payload.title.trim()
        if (typeof payload.content === 'string') row.content = payload.content
        if (payload.zone === 'work' || payload.zone === 'life') row.zone = payload.zone
        if (['high', 'normal', 'low'].indexOf(payload.priority) >= 0) row.priority = payload.priority
        if (typeof payload.dueAt === 'string' && payload.dueAt) row.due_at = payload.dueAt
        if (typeof payload.done === 'boolean') row.done = payload.done
        if (payload.parseMeta && typeof payload.parseMeta === 'object') row.parse_meta = payload.parseMeta
        // text 是 v1 遗留的 NOT NULL 列（无默认值）：新建记录必须写入，否则 insert 违反约束。
        row.text = row.title || ''
        return row
    },
    orderBy: { column: 'created_at', ascending: false },
})

module.exports = { notes, mapNote, formatDateTime }
