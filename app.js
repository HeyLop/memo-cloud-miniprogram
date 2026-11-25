const { cloud } = require('./utils/cloud')

App({
    globalData: {
        appName: '清单备忘',
    },

    onShow(options) {
        this.authReady = cloud.auth.handleWorkBuddyMiniProgramCallback(options)
    },
})
