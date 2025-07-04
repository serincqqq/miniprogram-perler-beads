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
    imageData: [], // <--- 给一个明确的初始值
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad() {
    // 1. 设置UI尺寸
    const sysInfo = wx.getSystemInfoSync();
    const navHeight = (sysInfo.statusBarHeight || 20) + this.data.navBarHeight;
    const zoomControlsHeight = 50; // 估算的缩放控件高度
    const colorPaletteHeight = 160; // 估算的调色板高度

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      scrollViewHeight: sysInfo.windowHeight - navHeight - zoomControlsHeight - colorPaletteHeight
    });

    // 2. 从 Storage 获取数据
    const sourceData = wx.getStorageSync('previewImageData');
    
    // 3. 严格校验获取到的数据
    if (!sourceData || !Array.isArray(sourceData.imageData) || sourceData.imageData.length === 0) {
      wx.showToast({
        title: '加载预览数据失败',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
      return;
    }

    // 4. 备份数据 (如果需要的话)
    wx.setStorageSync('previewImageData_backup', sourceData);

    // 5. 解析并准备用于 setData 的数据
    const usedColors = (sourceData.usedColors || []).map((code: string) => ({
      code,
      hex: beadPalette[code],
    })).filter((color: { hex: string; }) => color.hex);

    const availableColors = Object.entries(beadPalette).map(([code, hex]) => ({
      code,
      hex: hex as string
    }));

    const initialZoom = sourceData.width ? (sysInfo.windowWidth / sourceData.width) : 1.0;

    // 6. 一次性将所有数据更新到 this.data
    this.setData({
      tempFilePath: sourceData.tempFilePath || '',
      originalImageWidth: sourceData.width || sysInfo.windowWidth,
      zoomLevel: initialZoom,
      usedColors,
      availableColors,
      imageData: sourceData.imageData, // <--- 核心修复点：直接使用获取到的 imageData
      colorReplacements: {},
    });
    
    console.log('onLoad 之后, this.data.imageData:', this.data.imageData); // 添加调试日志

    this.updateZoomPercent();

    // 7. 监听异步生成的预览图
    if (!this.data.tempFilePath) {
      this.watchPreviewImage();
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
    // 注意：这里要检查的是"原始"色号，而不是已经被替换过的
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

  // 确保这些辅助函数存在
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  getFinalColorCode(code: string, replacements: Record<string, string>): string {
    let finalCode = code;
    const visited = new Set([code]);
    while (replacements[finalCode]) {
      finalCode = replacements[finalCode];
      if (visited.has(finalCode)) {
        console.warn('检测到颜色替换循环!', finalCode);
        return finalCode;
      }
      visited.add(finalCode);
    }
    return finalCode;
  },

  // 导出功能
  async onExport() {
    const { imageData, colorReplacements } = this.data;
    console.log('dd', imageData)
    if (!imageData || !Array.isArray(imageData) || imageData.length === 0 || !Array.isArray(imageData[0]) || imageData[0].length === 0) {
      wx.showToast({ title: '图像数据无效', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在生成图片...' });

    try {
      // 1. 应用最终的颜色替换规则
      const finalImageData = imageData.map((row: (string | null)[]) => {
        return row.map((cell: string | null) => {
          if (cell) {
            return this.getFinalColorCode(cell, colorReplacements);
          }
          return null;
        });
      });

      // 2. 绘制到离屏 Canvas
      const tempFilePath = await this.drawExportImage(finalImageData);
      if (!tempFilePath) {
        throw new Error("生成图片临时文件失败");
      }

      // 3. 保存到相册
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath });

      wx.hideLoading();
      wx.showToast({ title: '图片已保存', icon: 'success' });

      // 4. 更新 Storage 以同步数据到主页
      const backupData = wx.getStorageSync('previewImageData_backup') || {};
      wx.setStorageSync('previewImageData', {
        ...backupData,
        imageData: finalImageData,
        usedColors: [...new Set(finalImageData.flat().filter(c => c))]
      });

    } catch (error: any) {
      wx.hideLoading();
      this.handleExportError(error);
    }
  },

  // 将 Canvas 绘制逻辑提取为独立函数
  async drawExportImage(imageData: (string | null)[][]): Promise<string | null> {
    const sysInfo = wx.getSystemInfoSync();
    const dpr = sysInfo.pixelRatio || 1;
    const cellSizeInRpx = 40; // 导出图像素大小
    const cellSizeInPx = (cellSizeInRpx / 750) * sysInfo.windowWidth;

    const numRows = imageData.length;
    const numCols = imageData[0].length;

    const canvasWidth = numCols * cellSizeInPx;
    const canvasHeight = numRows * cellSizeInPx;

    // @ts-ignore
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: canvasWidth * dpr, height: canvasHeight * dpr });
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const fontSize = Math.max(8, Math.floor(cellSizeInPx * 0.4));
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const colorCode = imageData[r][c];
        if (!colorCode) continue;

        const x = c * cellSizeInPx;
        const y = r * cellSizeInPx;

        const hex = beadPalette[colorCode] || '#CCCCCC';
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, cellSizeInPx, cellSizeInPx);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.strokeRect(x, y, cellSizeInPx, cellSizeInPx);

        const rgb = this.hexToRgb(hex);
        const brightness = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 : 0;
        ctx.fillStyle = brightness > 128 ? 'black' : 'white';
        ctx.fillText(colorCode, x + cellSizeInPx / 2, y + cellSizeInPx / 2);
      }
    }

    const { tempFilePath } = await wx.canvasToTempFilePath({ canvas });
    return tempFilePath;
  },

  // 统一处理导出错误
  handleExportError(error: any) {
    console.error('Export error:', error);
    if (error.errMsg && error.errMsg.includes('auth deny')) {
      wx.showModal({
        title: '授权失败',
        content: '您拒绝了保存到相册的授权，是否前往设置页重新授权？',
        success: (res) => {
          if (res.confirm) {
            wx.openSetting();
          }
        }
      });
    } else {
      wx.showToast({
        title: '导出失败，请稍后重试',
        icon: 'none'
      });
    }
  }
})