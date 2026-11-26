const { cloud } = require('./utils/cloud')

App({
    globalData: {
        appName: '待办 v2',
    },

    onShow(options) {
        this.authReady = cloud.auth.handleWorkBuddyMiniProgramCallback(options)
    },
})
