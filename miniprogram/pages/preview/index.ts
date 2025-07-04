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
    newColor: '',
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

      const usedColorCodes = previewImageData.usedColors || [];
      const usedColors = usedColorCodes.map((code: string) => ({
        code,
        hex: beadPalette[code],
      })).filter((color: { hex: string; }) => color.hex);

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
  onNewColorInput(e: WechatMiniprogram.Input) {
    this.setData({
      newColorCode: e.detail.value.toUpperCase().trim()
    });
  },
  onConfirmReplace() {
    const { selectedColor, newColorCode, colorReplacements, usedColors } = this.data;

    // 1. 基础校验
    if (!selectedColor) return;
    if (!newColorCode || !beadPalette[newColorCode]) {
      wx.showToast({
        title: '请输入有效的色号',
        icon: 'none'
      });
      return;
    }

    // 2. 更新替换规则表
    const newReplacements = {
      ...colorReplacements,
      [selectedColor.code]: newColorCode
    };

    // 3. 智能更新UI色板
    const newUsedColors = [...usedColors];
    const oldCode = selectedColor.code;

    // 检查替换后的新颜色是否已经存在于色板上
    // 注意：这里要检查的是“原始”色号，而不是已经被替换过的
    const newColorAlreadyExists = newUsedColors.some(color => color.code === newColorCode);

    if (newColorAlreadyExists) {
      // 如果新颜色已存在，则直接从列表中移除旧颜色的色块
      const indexToRemove = newUsedColors.findIndex(color => color.code === oldCode);
      if (indexToRemove !== -1) {
        newUsedColors.splice(indexToRemove, 1);
      }
    } else {
      // 如果新颜色不存在，则找到旧色块并更新它
      const indexToUpdate = newUsedColors.findIndex(color => color.code === oldCode);
      if (indexToUpdate !== -1) {
        newUsedColors[indexToUpdate] = { code: newColorCode, hex: beadPalette[newColorCode] };
      }
    }
    
    // 4. 一次性更新所有数据并关闭弹窗
    this.setData({
      colorReplacements: newReplacements,
      usedColors: newUsedColors, // 更新色板显示
      showReplaceDialog: false,
      selectedColor: null,
      newColorCode: '' // 重置输入框
    });
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