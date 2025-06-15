// pages/preview/index.ts
Page({

  /**
   * Page initial data
   */
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    scrollViewHeight: 500,

    tempFilePath: '',
    originalImageWidth: 0,
    displayImageScale: 1.2,

    zoomLevel: 1.0,
    minZoom: 0.2, // 最小缩放比例
    maxZoom: 3.0, // 最大缩放比例
    zoomPercent: '100',
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const navHeight = (sysInfo.statusBarHeight || 20) + this.data.navBarHeight;
    const zoomControlsHeight = 50; // 估算的缩放控件高度
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      scrollViewHeight: sysInfo.windowHeight - navHeight - zoomControlsHeight
    });

    const previewImageData = wx.getStorageSync('previewImageData');
    if (previewImageData && previewImageData.tempFilePath) {
      wx.removeStorageSync('previewImageData');

      // 计算初始缩放，使其适应屏幕宽度
      const initialDisplayWidth = sysInfo.windowWidth; // 直接使用屏幕宽度
      const initialZoom = initialDisplayWidth / previewImageData.width;

      this.setData({
        tempFilePath: previewImageData.tempFilePath,
        originalImageWidth: previewImageData.width,
        //displayImageWidth: initialDisplayWidth,
        zoomLevel: initialZoom,
      });
      this.updateZoomPercent();
    } else {
      wx.showToast({ title: '无预览数据', icon: 'none' });
      wx.navigateBack();
    }
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },

  zoomIn() {
    this.setData({
      displayImageScale: this.data.displayImageScale + 0.2,
    });
  },

  zoomOut() {
    this.setData({
      displayImageScale: this.data.displayImageScale - 0.2,
    });
  },

  updateZoom(newZoom: number) {
    this.setData({
      zoomLevel: newZoom,
      displayImageScale: this.data.originalImageWidth * newZoom,
    });
    this.updateZoomPercent();
  },

  updateZoomPercent() {
    this.setData({
      zoomPercent: (this.data.zoomLevel * 100).toFixed(0),
    });
  },
})