// D7 智能解析：从一句话抽取 { title, dueAt, zone, needsManual, confidence }
// 策略：本地正则识别常见中文时间表达；复杂表达留给云端 LLM（接口预留，本版先用正则）。
// 原则：解析失败不丢字——原文保留为 title，needsManual=true 让用户补选时间。

const WEEKDAYS = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 }

function pad(n) { return n < 10 ? '0' + n : '' + n }

function toISO(year, month, day, hour, minute) {
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`
}

function dayOffset(base, days) {
    const d = new Date(base)
    d.setDate(d.getDate() + days)
    return d
}

// 解析 "明天下午3点" / "今天晚上8点半" / "周五 10:00" 等，返回 { date, hour, minute, matched } 或 null
function parseTime(text, now) {
    const base = now || new Date()
    let day = null
    let hour = null
    let minute = 0

    // 相对日
    const rel = text.match(/(今天|明天|后天|大后天)/)
    if (rel) {
        const offsets = { '今天': 0, '明天': 1, '后天': 2, '大后天': 3 }
        day = dayOffset(base, offsets[rel[1]])
    }
    // 周X
    let wk = null
    if (!day) {
        wk = text.match(/周([一二三四五六日天])|星期([一二三四五六日天])/)
        if (wk) {
            const target = WEEKDAYS[wk[1] || wk[2]]
            const cur = base.getDay()
            let delta = (target - cur + 7) % 7
            if (delta === 0) delta = 7
            day = dayOffset(base, delta)
        }
    }
    // 时段词
    let period = ''
    const per = text.match(/(上午|中午|下午|晚上|早上)/)
    if (per) { period = per[1] }

    // 时刻：3点 / 3点半 / 15:00 / 15点30分
    const t1 = text.match(/(\d{1,2})[:：](\d{2})/)
    const t2 = text.match(/(\d{1,2})点(半|\d{1,2}分?)?/)
    if (t1) {
        hour = parseInt(t1[1], 10)
        minute = parseInt(t1[2], 10)
    } else if (t2) {
        hour = parseInt(t2[1], 10)
        if (t2[2] === '半') minute = 30
        else if (t2[2]) minute = parseInt(t2[2], 10)
    }
    // 时段修正：下午/晚上<12 加12；晚上12点视为次日0点
    let crossDay = false
    if (hour !== null) {
        if ((period === '下午' || period === '晚上') && hour < 12) hour += 12
        if (period === '晚上' && hour === 12) { hour = 0; crossDay = true }
    }
    if (!day && hour === null) return null

    if (!day) day = dayOffset(base, (hour < base.getHours() || crossDay) ? 1 : 0)
    else if (crossDay) day = dayOffset(day, 1)
    if (hour === null) hour = 9
    if (hour > 23 || minute > 59) return null
    const pieces = []
    if (rel) pieces.push(rel[1])
    if (wk) pieces.push(wk[0])
    if (per) pieces.push(per[1])
    if (t1) pieces.push(t1[0])
    else if (t2) pieces.push(t2[0])
    return { date: day, hour, minute, pieces }
}

function stripMatched(text, pieces) {
    let result = text
    ;(pieces || []).forEach((p) => { result = result.split(p).join('') })
    return result.replace(/[，,。\s]+/g, ' ').trim()
}

function parseTodo(text, currentZone, now) {
    const raw = (text || '').trim()
    if (!raw) return { title: '', dueAt: '', zone: currentZone || 'work', needsManual: true, confidence: 0 }
    const time = parseTime(raw, now)
    if (!time) {
        return { title: raw, dueAt: '', zone: currentZone || 'work', needsManual: true, confidence: 0 }
    }
    const dueAt = toISO(time.date.getFullYear(), time.date.getMonth() + 1, time.date.getDate(), time.hour, time.minute)
    const title = stripMatched(raw, time.pieces) || raw
    return {
        title,
        dueAt,
        zone: currentZone || 'work',
        needsManual: false,
        confidence: 0.85,
        parseMeta: { engine: 'local-regex', matched: time.pieces.join('') },
    }
}

module.exports = { parseTodo, parseTime, formatISO: toISO }
