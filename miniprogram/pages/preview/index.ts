// pages/preview/index.ts
interface BeadPaletteData {
  [key: string]: string;
}

// const beadPalette: BeadPaletteData = require('../index/beadPaletteData');
const beadPalette = require('../index/beadPaletteData')

interface ColorInfo {
  code: string;
  hex: string;
}

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

    // Color palette related data
    usedColors: [] as ColorInfo[],
    availableColors: [] as ColorInfo[],
    showReplaceDialog: false,
    selectedColor: null as ColorInfo | null,
    colorReplacements: {} as Record<string, string>, // 存储颜色替换映射
    imageData: [] as any[][], // 保存原始图像数据用于导出
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const navHeight = (sysInfo.statusBarHeight || 20) + this.data.navBarHeight;
    const zoomControlsHeight = 50; // 估算的缩放控件高度
    const colorPaletteHeight = 160; // 估算的调色板高度

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      scrollViewHeight: sysInfo.windowHeight - navHeight - zoomControlsHeight - colorPaletteHeight
    });

    const previewImageData = wx.getStorageSync('previewImageData');
    if (previewImageData && previewImageData.tempFilePath) {
      wx.removeStorageSync('previewImageData');

      const initialDisplayWidth = sysInfo.windowWidth;
      const initialZoom = initialDisplayWidth / previewImageData.width;

      const usedColorSet = new Set<string>();
      if (previewImageData.imageData) {
        previewImageData.imageData.flat().forEach((cell: any) => {
          if (cell && typeof cell === 'string') {
            usedColorSet.add(cell);
          }
        });
      }

      const usedColors = [...usedColorSet].map(code => ({
        code,
        hex: beadPalette[code],
      })).filter(color => color.hex);

      // 处理可用的颜色
      const availableColors: ColorInfo[] = Object.entries(beadPalette).map(([code, hex]) => ({
        code,
        hex: hex as string
      }));

      this.setData({
        tempFilePath: previewImageData.tempFilePath,
        originalImageWidth: previewImageData.width,
        zoomLevel: initialZoom,
        usedColors,
        availableColors,
        imageData: previewImageData.imageData
      });
      this.updateZoomPercent();
      console.log('gg', this.data.usedColors)
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

  // 颜色替换相关方法
  onColorBlockTap(e: WechatMiniprogram.TouchEvent) {
    const color = e.currentTarget.dataset.color as ColorInfo;
    this.setData({
      showReplaceDialog: true,
      selectedColor: color
    });
  },

  onReplaceColor(e: WechatMiniprogram.TouchEvent) {
    const newColor = e.currentTarget.dataset.color as ColorInfo;
    const { selectedColor, colorReplacements } = this.data;

    if (selectedColor) {
      // 更新颜色替换映射
      this.setData({
        colorReplacements: {
          ...colorReplacements,
          [selectedColor.code]: newColor.code
        },
        showReplaceDialog: false,
        selectedColor: null
      });
    }
  },

  onCancelReplace() {
    this.setData({
      showReplaceDialog: false,
      selectedColor: null
    });
  },

  // 导出功能
  async onExport() {
    const { imageData, colorReplacements } = this.data;

    if (!imageData) {
      wx.showToast({ title: '无图像数据', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在导出...' });

    try {
      // 应用颜色替换
      const newImageData = imageData.map((row: any[]) => {
        return row.map((cell: any) => {
          if (typeof cell === 'string' && colorReplacements[cell]) {
            return colorReplacements[cell];
          }
          return cell;
        });
      });

      // 保存新的图像数据
      wx.setStorageSync('exportImageData', {
        imageData: newImageData,
        width: imageData[0].length,
        height: imageData.length
      });

      // 返回上一页
      wx.navigateBack({
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '导出成功', icon: 'success' });
        }
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '导出失败', icon: 'none' });
      console.error('Export error:', error);
    }
  }
})