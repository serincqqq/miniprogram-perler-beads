// index.ts
// 获取应用实例

Component({
  data: {
    tempFilePath: '',
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
  },
  methods: {
    // 事件处理函数
    onChooseImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        success: (res) => {  // 使用箭头函数
          this.setData({ tempFilePath: res.tempFiles[0].tempFilePath });
        },
        fail: (err) => {
          console.error('选择失败:', err);
        }
      });
    },
  
  },
})
