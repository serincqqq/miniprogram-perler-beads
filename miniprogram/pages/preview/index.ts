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
    scrollViewHeight: 400,

    tempFilePath: '',
    displayImageWidth: 200,
    displayImageHeight: 200,

    imageData: [] as any[][],
    usedColors: [] as ColorInfo[],
    colorReplacements: {} as Record<string, string>,
    showReplaceDialog: false,
    selectedColor: null as ColorInfo | null,
    newColor: '',
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    const navHeight = (sysInfo.statusBarHeight || 20) + this.data.navBarHeight;
    const colorPaletteHeight = 160; // 估算调色板和导出按钮总高度

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      scrollViewHeight: sysInfo.windowHeight - navHeight - colorPaletteHeight
    });

    const sourceData = wx.getStorageSync('previewImageData');
    if (!sourceData || !sourceData.imageData || sourceData.imageData.length === 0) {
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
    wx.setStorageSync('previewImageData_backup', sourceData);

    const usedColors = (sourceData.usedColors || []).map((code: string) => ({
      code,
      hex: beadPalette[code],
    })).filter((color: { hex: string; }) => color.hex);

    const displayWidth = sourceData.width * 1.2;
    const displayHeight = sourceData.height * 1.2;

    this.setData({
      tempFilePath: sourceData.tempFilePath || '',
      displayImageWidth: displayWidth,
      displayImageHeight: displayHeight,
      imageData: sourceData.imageData,
      usedColors: usedColors,
      colorReplacements: {},
    });

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

  watchPreviewImage() {
    const interval = setInterval(() => {
      const updatedData = wx.getStorageSync('previewImageData');
      if (updatedData && updatedData.tempFilePath) {
        clearInterval(interval);
        this.setData({
          tempFilePath: updatedData.tempFilePath,
          displayImageWidth: updatedData.width * 1.2,
          displayImageHeight: updatedData.height * 1.2,
        });
      }
    }, 500);
    setTimeout(() => clearInterval(interval), 15000);
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
  onDeleteColor() {
    const { selectedColor, imageData, usedColors } = this.data;
    if (!selectedColor) return;

    const codeToDelete = selectedColor.code;

    // 1. 更新 imageData，将被删除的色号替换为 null
    const newImageData = imageData.map(row => {
      return row.map(cell => {
        return cell === codeToDelete ? null : cell;
      });
    });

    // 2. 从 usedColors 列表中移除该颜色
    const newUsedColors = usedColors.filter(color => color.code !== codeToDelete);

    // 3. 更新数据并关闭弹窗
    this.setData({
      imageData: newImageData,
      usedColors: newUsedColors,
      showReplaceDialog: false,
      selectedColor: null,
    });

    wx.showToast({ title: `颜色 ${codeToDelete} 已删除`, icon: 'none' });
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

    // 更新 imageData，将旧色号替换为新色号
    const newImageData = this.data.imageData.map(row => {
      return row.map(cell => {
        return cell === selectedColor.code ? newColorCode : cell;
      });
    });

    // 一次性更新所有数据并关闭弹窗
    this.setData({
      imageData: newImageData, // 同时更新 imageData
      colorReplacements: newReplacements,
      usedColors: newUsedColors,
      showReplaceDialog: false,
      selectedColor: null,
      newColorCode: ''
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