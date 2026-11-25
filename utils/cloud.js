const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics')

// publicConfig 由 WorkBuddy 云服务提供，随应用发布保留。
const publicConfig = {
    endpoint: 'https://mp-api.app.workbuddy.host',
    publishableKey: 'wbpk_0CBamvxrwaqn3mYKCHQrVQ_xDek1ApXjGwPbjNgQYFPZoLYuupWE1uN',
    workBuddyOAuthClientId: 'cb_jq6QyEPkOkJXPcpz0JxS_wbapp_0CBamvxrwaqn3mYKCHQrVQ',
}

const cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    workBuddyOAuthClientId: publicConfig.workBuddyOAuthClientId,
    wx: createDiagnosticWx(wx),
})

module.exports = { cloud }
