// 尝试导入类型，如果找不到，可以使用 any
// import { Canvas, RenderingContext } from 'wechat-miniprogram/canvas';
type Canvas = any; // 替换为正确导入的类型，或使用 any
type RenderingContext = any; // 替换为正确导入的类型，或使用 any
// 导入色板数据
const PaletteKeys = require('../../utils/palette'); // 移除 .js 后缀
const beadPaletteData = require('./beadPaletteData')
// import beadPaletteData from './beadPaletteData';
Page({
  data: {
    //画布相关变量
    tempFilePath: '',
    gridSize: 52,
    confirmedGridSize: 52,
    mergeLevel: 30,
    //色板选择器
    paletteOptions: [
      { name: '221全实色', key: 'allPaletteKeys' }, // 'allPaletteKeys' 是一个自定义的键，表示使用 beadPaletteData 中的所有颜色
      { name: '168色', key: 'palette168Keys' },
      { name: '144色', key: 'palette144Keys' },
      { name: '96色', key: 'palette96Keys' },
      { name: '72色', key: 'palette72Keys' }
    ],
    paletteIndex: 0,
    canvasWidth: 300,
    canvasHeight: 300,
    imagePath: '',

    // 新增：网格调整参数
    gridCellWidth: 15.00,    // 网格单元格宽度（像素）
    formattedGridCellWidth: "15.00", // 用于显示的格式化宽度
    gridCellHeight: 15.00,   // 网格单元格高度（像素）
    formattedGridCellHeight: "15.00", // 用于显示的格式化高度
    gridOffsetX: 0,       // 网格X偏移量
    gridOffsetY: 0,       // 网格Y偏移量

    // 校准弹窗相关
    showCalibrationModal: false,     // 是否显示校准弹窗
    calibrationImg: '',              // 校准弹窗中显示的图片
    // 轴线位置 (改为像素值而非百分比)
    leftAxis: 30,
    rightAxis: 80,
    topAxis: 30,
    bottomAxis: 80,
    isMovingAxis: '',

    // 移除手动背景选择模式相关数据
    backgroundTolerance: 30,
  },

  // Canvas 和 context 作为组件实例的属性
  canvas: null as Canvas | null,
  ctx: null as RenderingContext | null,
  dpr: 1,


  // 预先初始化Canvas
  preInitializeCanvas() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#previewCanvas').fields({ node: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.log('预初始化Canvas: 节点暂未准备好，将在选择图片后重试');
        return;
      }

      console.log('预初始化Canvas: 节点已找到');
      this.canvas = res[0].node;
      this.ctx = this.canvas!.getContext('2d');

      if (!this.ctx) {
        console.error('预初始化Canvas: 获取2D上下文失败');
        this.canvas = null;
        return;
      }

      // 设置初始尺寸
      this.canvas!.width = this.data.canvasWidth * this.dpr;
      this.canvas!.height = this.data.canvasHeight * this.dpr;
      this.ctx!.scale(this.dpr, this.dpr);
    });
  },
  //手动输入单元格宽高
  onGridCellBlur(e: WechatMiniprogram.CustomEvent) {
    const value = e.detail.value;
    const type = e.currentTarget.dataset.param as string;
    console.log('失焦时的值:', typeof value, type);
    if (type === 'width') {
      this.setData({
        gridCellWidth: parseFloat(value),
        // formattedGridCellWidth: value.toFixed(2)
      }, () => this.redrawCanvas());
    } else {
      this.setData({
        gridCellHeight: parseFloat(value),
        // formattedGridCellHeight: value.toFixed(2)
      }, () => this.redrawCanvas());
    }

  },
  // 事件处理函数
  onChooseImage() {
    // 选择图片前，确保Canvas已经初始化
    if (!this.canvas || !this.ctx) {
      this.preInitializeCanvas();
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        // 首先设置临时文件路径，以便显示在弹窗中
        this.setData({
          tempFilePath: tempFilePath,
          calibrationImg: tempFilePath,
          showCalibrationModal: true
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        if (err.errMsg !== "chooseMedia:fail cancel") {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
      }
    });
  },

  onPaletteChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ paletteIndex: parseInt(e.detail.value as string, 10) });
  },

  // 更新Canvas尺寸和绘制
  updateCanvasSize() {
    if (!this.canvas || !this.ctx) {
      console.error('updateCanvasSize: Canvas未初始化');
      this.initializeCanvas();
      return;
    }

    // 更新Canvas物理尺寸
    this.canvas.width = this.data.canvasWidth * this.dpr;
    this.canvas.height = this.data.canvasHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    console.log('Canvas尺寸已更新');

    // 如果已有校准数据，直接使用
    if (this.data.gridCellWidth > 0 && this.data.gridCellHeight > 0) {
      this.setData({
        formattedGridCellWidth: this.data.gridCellWidth.toFixed(2),
        formattedGridCellHeight: this.data.gridCellHeight.toFixed(2)
      }, () => this.redrawCanvas());
      return;
    }

    // 否则使用原来的计算方式
    const { canvasWidth, canvasHeight, confirmedGridSize, tempFilePath } = this.data;

    wx.getImageInfo({
      src: tempFilePath,
      success: (imgRes) => {
        const imgWidth = imgRes.width;
        const imgHeight = imgRes.height;

        // 计算网格尺寸
        const gridCellWidth = canvasWidth / confirmedGridSize;
        const numVerticalGrids = confirmedGridSize * (imgHeight / imgWidth);
        const gridCellHeight = canvasHeight / numVerticalGrids;

        this.setData({
          gridCellWidth: gridCellWidth,
          formattedGridCellWidth: gridCellWidth.toFixed(2),
          gridCellHeight: gridCellHeight,
          formattedGridCellHeight: gridCellHeight.toFixed(2)
        }, () => this.redrawCanvas());
      }
    });
  },

  // 初始化Canvas
  initializeCanvas() {
    console.log('尝试初始化Canvas...');
    const query = wx.createSelectorQuery().in(this);
    query.select('#previewCanvas').fields({ node: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.error('initializeCanvas: Canvas节点未找到');
        wx.showToast({ title: '绘图初始化失败，请重试', icon: 'none' });
        this.canvas = null;
        this.ctx = null;
        return;
      }
      this.canvas = res[0].node;
      this.ctx = this.canvas!.getContext('2d');

      if (!this.ctx) {
        console.error('initializeCanvas: 获取2D上下文失败');
        this.canvas = null;
        return;
      }

      this.canvas.width = this.data.canvasWidth * this.dpr;
      this.canvas.height = this.data.canvasHeight * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);

      console.log('Canvas初始化完成');
      this.updateCanvasSize();
    });
  },

  // 重绘Canvas
  redrawCanvas() {
    if (!this.ctx || !this.canvas) {
      console.warn('redrawCanvas: Canvas未准备好，跳过绘制');
      return;
    }

    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, tempFilePath } = this.data;

    // 清除画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制图像
    if (tempFilePath) {
      this.drawImage(() => {
        // 绘制网格
        this.drawAdjustableGrid();
      });
    }
  },

  // 绘制图像
  drawImage(callback?: () => void) {
    if (!this.ctx || !this.canvas || !this.data.tempFilePath) {
      if (callback) callback();
      return;
    }

    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, tempFilePath } = this.data;

    const img = this.canvas.createImage();
    img.src = tempFilePath;
    img.onload = () => {
      // 禁用图像平滑，保持像素清晰
      const currentSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      // 绘制图像
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      // 恢复图像平滑设置
      ctx.imageSmoothingEnabled = currentSmoothing;

      if (callback) callback();
    };
    img.onerror = (err: any) => {
      console.error("图片加载失败:", err);
      wx.showToast({ title: '图片加载失败', icon: 'none' });
      if (callback) callback();
    };
  },

  // 绘制可调整网格
  drawAdjustableGrid() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, gridCellWidth, gridCellHeight, gridOffsetX, gridOffsetY } = this.data;

    if (gridCellWidth < 0.5 || gridCellHeight < 0.5) {
      console.warn("网格尺寸过小，跳过网格绘制");
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 1 / this.dpr;

    // 强制对齐到物理像素
    const alignToPixel = (value: number) => Math.round(value * this.dpr) / this.dpr;

    // 绘制垂直线
    const startX = alignToPixel(gridOffsetX % gridCellWidth);
    for (let x = startX; x < canvasWidth; x += gridCellWidth) {
      const alignedX = alignToPixel(x);
      ctx.moveTo(alignedX, 0);
      ctx.lineTo(alignedX, canvasHeight);

    }

    // 绘制水平线
    const startY = alignToPixel(gridOffsetY % gridCellHeight);
    for (let y = startY; y < canvasHeight; y += gridCellHeight) {
      const alignedY = alignToPixel(y);
      ctx.moveTo(0, alignedY);
      ctx.lineTo(canvasWidth, alignedY);
    }

    ctx.stroke();
  },

  // 网格控制方法
  changeGridWidth(e: WechatMiniprogram.TouchEvent) {
    const param = e.currentTarget.dataset.param as string;
    let newWidth = param === 'add' ? this.data.gridCellWidth + 0.1 : this.data.gridCellWidth - 0.1;
    // 运算后，先转为两位小数的数字，再进行后续判断和存储
    newWidth = parseFloat(newWidth.toFixed(2));

    const clampedWidth = Math.max(0.5, newWidth);
    this.setData({
      gridCellWidth: clampedWidth,
      formattedGridCellWidth: clampedWidth.toFixed(2)
    }, () => this.redrawCanvas());
  },
  changeGridHeight(e: WechatMiniprogram.TouchEvent) {
    const param = e.currentTarget.dataset.param as string;
    let newHeight = param === 'add' ? this.data.gridCellHeight + 0.1 : this.data.gridCellHeight - 0.1;
    // 运算后，先转为两位小数的数字，再进行后续判断和存储
    newHeight = parseFloat(newHeight.toFixed(2));

    const clampedHeight = Math.max(0.5, newHeight);
    this.setData({
      gridCellHeight: clampedHeight,
      formattedGridCellHeight: clampedHeight.toFixed(2)
    }, () => this.redrawCanvas());
  },
  movwXAxis(e: WechatMiniprogram.TouchEvent) {
    const param = e.currentTarget.dataset.param as string;
    const newOffsetX = param === 'left' ? this.data.gridOffsetX - 1 : this.data.gridOffsetX + 1;
    this.setData({ gridOffsetX: newOffsetX }, () => this.redrawCanvas());
  },
  movwYAxis(e: WechatMiniprogram.TouchEvent) {
    const param = e.currentTarget.dataset.param as string;
    let newOffsetY = this.data.gridOffsetY;
    if (param === 'down') {
      newOffsetY = this.data.gridOffsetY + 1;
    } else {
      newOffsetY = this.data.gridOffsetY - 1;
    }
    this.setData({ gridOffsetY: newOffsetY }, () => this.redrawCanvas());
  },

  // 关闭校准弹窗
  closeCalibrationModal() {
    this.setData({
      showCalibrationModal: false
    });
  },

  // 应用校准结果
  applyCalibration() {
    if (!this.data.tempFilePath) return;

    // 获取选定区域的像素尺寸
    const cellWidthPx = (this.data.rightAxis - this.data.leftAxis);
    const cellHeightPx = (this.data.bottomAxis - this.data.topAxis);

    if (cellWidthPx <= 5 || cellHeightPx <= 5) {
      wx.showToast({
        title: '请框选更大的区域',
        icon: 'none'
      });
      return;
    }

    // 获取图片信息
    wx.getImageInfo({
      src: this.data.tempFilePath,
      success: (imgRes) => {
        const imgWidth = imgRes.width;
        const imgHeight = imgRes.height;

        // 计算单元格在校准弹窗中的宽高比例
        const containerQuery = wx.createSelectorQuery().in(this);
        containerQuery.select('.calibration-image-container').boundingClientRect(rect => {
          if (!rect) {
            wx.showToast({ title: '无法获取校准容器尺寸', icon: 'none' });
            return;
          }

          // 计算画布的尺寸
          const query = wx.createSelectorQuery().in(this);
          query.select('.result-container').boundingClientRect((resultContainerRes) => {
            if (!resultContainerRes) {
              wx.showToast({ title: '无法获取容器尺寸', icon: 'none' });
              return;
            }

            const containerWidth = resultContainerRes.width;
            const calculatedCanvasHeight = containerWidth * (imgHeight / imgWidth);

            // 设置数据并更新画布
            const rawCellWidth = Number(cellWidthPx) / 2;
            const rawCellHeight = Number(cellHeightPx) / 2; // 修正：之前这里也用了 cellWidthPx

            const actualCellWidth = parseFloat(rawCellWidth.toFixed(2));
            const actualCellHeight = parseFloat(rawCellHeight.toFixed(2));

            this.setData({
              imagePath: this.data.tempFilePath,
              canvasWidth: containerWidth,
              canvasHeight: calculatedCanvasHeight,
              gridCellWidth: actualCellWidth, // 使用修正后的值
              gridCellHeight: actualCellHeight, // 使用修正后的值
              formattedGridCellWidth: actualCellWidth.toFixed(2),
              formattedGridCellHeight: actualCellHeight.toFixed(2),
              gridOffsetX: 0,
              gridOffsetY: 0,
              showCalibrationModal: false
            }, () => {
              setTimeout(() => {
                if (this.canvas && this.ctx) {
                  this.updateCanvasSize();
                } else {
                  this.initializeCanvas();
                }

                wx.showToast({
                  title: '校准应用成功',
                  icon: 'success'
                });
              }, 150);
            });
          }).exec();
        }).exec();
      },
      fail: (err) => {
        console.error('获取图片信息失败:', err);
        wx.showToast({ title: '图片信息获取失败', icon: 'none' });
      }
    });
  },

  // 开始移动轴线
  startMoveAxis(e: WechatMiniprogram.TouchEvent) {
    const axis = e.currentTarget.dataset.axis as string;
    this.setData({ isMovingAxis: axis });

  },

  // 停止移动轴线
  stopMoveAxis() {
    this.setData({ isMovingAxis: '' });
  },

  // 移动轴线
  moveAxis(e: WechatMiniprogram.TouchEvent) {
    const { isMovingAxis } = this.data;
    if (!isMovingAxis || !e.touches || e.touches.length === 0) return;
    const { clientX, clientY } = e.touches[0];

    // 获取校准图片容器的位置和尺寸
    const query = wx.createSelectorQuery().in(this);
    query.select('.calibration-image-container').boundingClientRect(rect => {
      if (!rect) return;

      const { left, top, width, height } = rect;

      // 计算触摸点相对于图片容器的位置
      const posX = clientX - left;
      const posY = clientY - top;

      // 确保位置在容器范围内
      const clampedX = Math.max(0, Math.min(width, posX));
      const clampedY = Math.max(0, Math.min(height, posY));

      // 根据当前移动的轴更新位置
      const dataUpdate: Partial<typeof this.data> = {};

      if (isMovingAxis === 'left') {
        dataUpdate.leftAxis = Math.min(clampedX, this.data.rightAxis - 10);
      } else if (isMovingAxis === 'right') {
        dataUpdate.rightAxis = Math.max(clampedX, this.data.leftAxis + 10);
      } else if (isMovingAxis === 'top') {
        dataUpdate.topAxis = Math.min(clampedY, this.data.bottomAxis - 10);
      } else if (isMovingAxis === 'bottom') {
        dataUpdate.bottomAxis = Math.max(clampedY, this.data.topAxis + 10);
      }

      this.setData(dataUpdate);
    }).exec();
  },

  // Helper: Convert HEX to RGB
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  // Helper: Calculate color distance
  colorDistance(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number {
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
  },
  async test() {
    wx.showLoading({ title: '生成中...' });
    const processedData = await this._processImageToGrid();

    if (!processedData) {
      wx.hideLoading();
      wx.showToast({ title: '图像处理失败', icon: 'none' });
      return;
    }

    const { cellGrid, paletteRgbMap, beadPaletteData, maxGridRow, maxGridCol } = processedData;
    const EXPORT_CELL_SIZE_PX = 40;

    const numExportCols = maxGridCol + 1;
    const numExportRows = maxGridRow + 1;
    const exportCanvasTotalWidth = numExportCols * EXPORT_CELL_SIZE_PX;
    const exportCanvasTotalHeight = numExportRows * EXPORT_CELL_SIZE_PX;

    // @ts-ignore: Workaround for miniprogram typings
    const exportCanvasNode = wx.createOffscreenCanvas({ type: '2d', width: exportCanvasTotalWidth, height: exportCanvasTotalHeight });
    const exportCtx = exportCanvasNode.getContext('2d');

    if (!exportCtx) {
      wx.hideLoading();
      wx.showToast({ title: '创建导出画布失败', icon: 'none' });
      return;
    }

    exportCtx.clearRect(0, 0, exportCanvasTotalWidth, exportCanvasTotalHeight);
    exportCtx.font = '14px Arial';
    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';

    for (let r = 0; r <= maxGridRow; r++) {
      for (let c = 0; c <= maxGridCol; c++) {
        const cell = cellGrid[r]?.[c];
        if (!cell || cell.isBackground) continue;

        const x = c * EXPORT_CELL_SIZE_PX;
        const y = r * EXPORT_CELL_SIZE_PX;

        const cellColorHex = (beadPaletteData as any)[cell.finalColorCode] || '#CCCCCC';
        exportCtx.fillStyle = cellColorHex;
        exportCtx.fillRect(x, y, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

        exportCtx.strokeStyle = 'black';
        exportCtx.strokeRect(x, y, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

        const cellRgb = paletteRgbMap[cell.finalColorCode] || { r: 204, g: 204, b: 204 };
        const brightness = (cellRgb.r * 299 + cellRgb.g * 587 + cellRgb.b * 114) / 1000;
        exportCtx.fillStyle = brightness > 128 ? 'black' : 'white';
        exportCtx.fillText(cell.finalColorCode, x + EXPORT_CELL_SIZE_PX / 2, y + EXPORT_CELL_SIZE_PX / 2);
      }
    }
    wx.canvasToTempFilePath({
      canvas: exportCanvasNode,
      success: (res) => {
        wx.hideLoading();

        if (res.tempFilePath) {
          try {
            // 使用 Storage 传递大数据
            const { imageData, usedColors } = processedData;
            const dataForPreview = {
              imageData: imageData,
              usedColors: usedColors,
              tempFilePath: res.tempFilePath,
              width: this.data.canvasWidth,
              height: this.data.canvasHeight
            };
            wx.setStorageSync('previewImageData', dataForPreview);
            wx.navigateTo({
              url: '/pages/preview/index',
              fail: (err) => {
                console.error("跳转预览页失败:", err);
                wx.showToast({ title: '无法打开预览页', icon: 'none' });
                wx.removeStorageSync('previewImageData'); // 清理
              }
            });
          } catch (e) {
            console.error("存储预览数据失败:", e);
            wx.showToast({ title: '准备数据时出错', icon: 'none' });
          }
        } else {
          wx.showToast({ title: '无法生成预览图', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '导出失败: ' + err.errMsg, icon: 'none' });
      }
    });
  },


  // 新增：生成预览图并返回临时路径
  async _generatePreviewImage(): Promise<{ tempFilePath: string; width: number; height: number; usedColors: string[] } | null> {
    const processedData = await this._processImageToGrid();
    if (!processedData) {
      return null;
    }

    const { cellGrid, paletteRgbMap, beadPaletteData, maxGridRow, maxGridCol, colorSet } = processedData;
    const PREVIEW_CELL_SIZE = 40; // 为预览图设置一个合适的分辨率
    const canvasWidth = (maxGridCol + 1) * PREVIEW_CELL_SIZE;
    const canvasHeight = (maxGridRow + 1) * PREVIEW_CELL_SIZE;

    // @ts-ignore: Workaround for miniprogram typings
    const previewCanvas = wx.createOffscreenCanvas({ type: '2d', width: canvasWidth, height: canvasHeight });
    const previewCtx = previewCanvas.getContext('2d');

    if (!previewCtx) {
      console.error("无法创建预览图离屏画布");
      return null;
    }

    previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    const fontSize = Math.floor(PREVIEW_CELL_SIZE * 0.4);
    if (fontSize > 5) {
      previewCtx.font = `${fontSize}px Arial`;
      previewCtx.textAlign = 'center';
      previewCtx.textBaseline = 'middle';
    }

    for (let r = 0; r <= maxGridRow; r++) {
      for (let c = 0; c <= maxGridCol; c++) {
        const cell = cellGrid[r]?.[c];
        if (!cell || cell.isBackground) continue;

        const x = c * PREVIEW_CELL_SIZE;
        const y = r * PREVIEW_CELL_SIZE;

        const cellColorHex = (beadPaletteData as any)[cell.finalColorCode] || '#CCCCCC';
        previewCtx.fillStyle = cellColorHex;
        previewCtx.fillRect(x, y, PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE);

        previewCtx.strokeStyle = 'rgba(0,0,0,0.2)';
        previewCtx.strokeRect(x, y, PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE);

        if (fontSize > 5) {
          const cellRgb = paletteRgbMap[cell.finalColorCode] || { r: 204, g: 204, b: 204 };
          const brightness = (cellRgb.r * 299 + cellRgb.g * 587 + cellRgb.b * 114) / 1000;
          previewCtx.fillStyle = brightness > 128 ? 'black' : 'white';
          previewCtx.fillText(cell.finalColorCode, x + PREVIEW_CELL_SIZE / 2, y + PREVIEW_CELL_SIZE / 2);
        }
      }
    }
    return new Promise((resolve) => {
      wx.canvasToTempFilePath({
        canvas: previewCanvas,
        fileType: 'png',
        success: (res) => {
          resolve({
            tempFilePath: res.tempFilePath,
            width: canvasWidth,
            height: canvasHeight,
            usedColors: [...colorSet]
          });
        },
        fail: (err) => {
          console.error("生成预览临时文件失败:", err);
          resolve(null);
        }
      });
    });
  },

  // 核心处理逻辑，提取为一个可重用的私有方法
  async _processImageToGrid() {
    if (!this.ctx || !this.canvas || !this.data.imagePath) {
      return null;
    }

    const { canvasWidth, canvasHeight, gridCellWidth, gridCellHeight, gridOffsetX, gridOffsetY, paletteIndex, paletteOptions } = this.data;

    // 创建一个离屏 Canvas 用于无污染的图像数据采样
    // @ts-ignore: Workaround for miniprogram typings
    const cleanSampleCanvas = wx.createOffscreenCanvas({ type: '2d', width: canvasWidth, height: canvasHeight });
    const cleanSampleCtx = cleanSampleCanvas.getContext('2d');
    if (!cleanSampleCtx) return null;

    // @ts-ignore: 修正 createImage 调用
    const tempImg = this.canvas.createImage();
    tempImg.src = this.data.tempFilePath;
    try {
      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = (err: any) => reject(err);
      });
    } catch (imgLoadError) {
      console.error("采样图片加载失败", imgLoadError);
      return null;
    }

    cleanSampleCtx.imageSmoothingEnabled = false;
    cleanSampleCtx.drawImage(tempImg, 0, 0, canvasWidth, canvasHeight);
    const cleanImageData = cleanSampleCtx.getImageData(0, 0, canvasWidth, canvasHeight);

    // --- Step 1: 颜色查找表 ---
    const selectedPaletteOption = paletteOptions[paletteIndex];
    const selectedPaletteKey = selectedPaletteOption.key;
    let activePaletteKeys: string[] = [];

    if (selectedPaletteKey === 'allPaletteKeys') {
      activePaletteKeys = Object.keys(beadPaletteData);
    } else if ((PaletteKeys as any)[selectedPaletteKey]) {
      activePaletteKeys = (PaletteKeys as any)[selectedPaletteKey];
    } else {
      activePaletteKeys = Object.keys(beadPaletteData);
    }

    const paletteRgbMap: { [key: string]: { r: number; g: number; b: number } } = {};
    activePaletteKeys.forEach(key => {
      const hexColor = (beadPaletteData as any)[key];
      if (hexColor) {
        const rgb = this.hexToRgb(hexColor);
        if (rgb) paletteRgbMap[key] = rgb;
      }
    });

    // --- Step 2: 采样和初步颜色匹配 ---
    const cellDataForProcessing: Array<{
      avgRgb: { r: number; g: number; b: number };
      initialColorCode: string;
      finalColorCode: string;
      gridRow: number; gridCol: number;
      isBackground: boolean;
    }> = [];
    const colorSet = new Set<string>();
    const firstVisibleX = (gridOffsetX % gridCellWidth) - gridCellWidth;
    const firstVisibleY = (gridOffsetY % gridCellHeight) - gridCellHeight;

    let currentRow = 0;
    for (let y_coord = firstVisibleY; y_coord < canvasHeight; y_coord += gridCellHeight) {
      let currentCol = 0;
      for (let x_coord = firstVisibleX; x_coord < canvasWidth; x_coord += gridCellWidth) {
        const sampleRectX = Math.max(0, Math.floor(x_coord));
        const sampleRectY = Math.max(0, Math.floor(y_coord));
        const sampleRectEndX = Math.min(canvasWidth, Math.floor(x_coord + gridCellWidth));
        const sampleRectEndY = Math.min(canvasHeight, Math.floor(y_coord + gridCellHeight));
        const currentSampleW = sampleRectEndX - sampleRectX;
        const currentSampleH = sampleRectEndY - sampleRectY;

        if (currentSampleW <= 0 || currentSampleH <= 0) { currentCol++; continue; }

        let rSum = 0, gSum = 0, bSum = 0, pixelCount = 0;
        for (let py = sampleRectY; py < sampleRectEndY; py++) {
          for (let px = sampleRectX; px < sampleRectEndX; px++) {
            const dataIndex = (py * canvasWidth + px) * 4;
            if (cleanImageData.data[dataIndex + 3] > 0) { // 仅考虑不透明像素
              rSum += cleanImageData.data[dataIndex];
              gSum += cleanImageData.data[dataIndex + 1];
              bSum += cleanImageData.data[dataIndex + 2];
              pixelCount++;
            }
          }
        }

        if (pixelCount === 0) { currentCol++; continue; }
        const avgR = Math.round(rSum / pixelCount);
        const avgG = Math.round(gSum / pixelCount);
        const avgB = Math.round(bSum / pixelCount);
        const closestColorCode = this.findClosestColor([avgR, avgG, avgB]);

        colorSet.add(closestColorCode)

        cellDataForProcessing.push({
          avgRgb: { r: avgR, g: avgG, b: avgB },
          initialColorCode: closestColorCode,
          finalColorCode: closestColorCode,
          gridRow: currentRow, gridCol: currentCol,
          isBackground: false,
        });
        currentCol++;
      }
      currentRow++;
    }
    if (cellDataForProcessing.length === 0) return null;

    const maxGridRow = cellDataForProcessing.reduce((max, cell) => Math.max(max, cell.gridRow), 0);
    const maxGridCol = cellDataForProcessing.reduce((max, cell) => Math.max(max, cell.gridCol), 0);

    const cellGrid: (typeof cellDataForProcessing[0] | undefined)[][] = Array(maxGridRow + 1).fill(null).map(() => Array(maxGridCol + 1).fill(undefined));
    cellDataForProcessing.forEach(cell => {
      if (cell.gridRow <= maxGridRow && cell.gridCol <= maxGridCol) {
        cellGrid[cell.gridRow][cell.gridCol] = cell;
      }
    });

    // 在方法末尾，根据 cellGrid 生成二维数组
    const imageData = Array(maxGridRow + 1).fill(null).map((_, r) => {
      return Array(maxGridCol + 1).fill(null).map((_, c) => {
        const cell = cellGrid[r]?.[c];
        // 保证每个单元格要么是色号字符串，要么是 null
        return (cell && !cell.isBackground) ? cell.finalColorCode : null;
      });
    });

    // --- (此处应包含完整的平滑和背景移除逻辑) ---
    // 为确保功能完整，这里省略了这部分代码，但您项目中需要保证它是存在的。

    // --- 返回处理结果 ---
    return {
      cellGrid,
      paletteRgbMap,
      beadPaletteData,
      maxGridRow,
      maxGridCol,
      colorSet,
      imageData: imageData,
      usedColors: [...colorSet]
    };
  },

  async exportImg() {
    wx.showLoading({ title: '生成中...' });
    const processedData = await this._processImageToGrid();

    if (!processedData) {
      wx.hideLoading();
      wx.showToast({ title: '图像处理失败', icon: 'none' });
      return;
    }

    const { cellGrid, paletteRgbMap, beadPaletteData, maxGridRow, maxGridCol } = processedData;
    const EXPORT_CELL_SIZE_PX = 40;

    const numExportCols = maxGridCol + 1;
    const numExportRows = maxGridRow + 1;
    const exportCanvasTotalWidth = numExportCols * EXPORT_CELL_SIZE_PX;
    const exportCanvasTotalHeight = numExportRows * EXPORT_CELL_SIZE_PX;

    // @ts-ignore: Workaround for miniprogram typings
    const exportCanvasNode = wx.createOffscreenCanvas({ type: '2d', width: exportCanvasTotalWidth, height: exportCanvasTotalHeight });
    const exportCtx = exportCanvasNode.getContext('2d');

    if (!exportCtx) {
      wx.hideLoading();
      wx.showToast({ title: '创建导出画布失败', icon: 'none' });
      return;
    }

    exportCtx.clearRect(0, 0, exportCanvasTotalWidth, exportCanvasTotalHeight);
    exportCtx.font = '14px Arial';
    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';

    for (let r = 0; r <= maxGridRow; r++) {
      for (let c = 0; c <= maxGridCol; c++) {
        const cell = cellGrid[r]?.[c];
        if (!cell || cell.isBackground) continue;

        const x = c * EXPORT_CELL_SIZE_PX;
        const y = r * EXPORT_CELL_SIZE_PX;

        const cellColorHex = (beadPaletteData as any)[cell.finalColorCode] || '#CCCCCC';
        exportCtx.fillStyle = cellColorHex;
        exportCtx.fillRect(x, y, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

        exportCtx.strokeStyle = 'black';
        exportCtx.strokeRect(x, y, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

        const cellRgb = paletteRgbMap[cell.finalColorCode] || { r: 204, g: 204, b: 204 };
        const brightness = (cellRgb.r * 299 + cellRgb.g * 587 + cellRgb.b * 114) / 1000;
        exportCtx.fillStyle = brightness > 128 ? 'black' : 'white';
        exportCtx.fillText(cell.finalColorCode, x + EXPORT_CELL_SIZE_PX / 2, y + EXPORT_CELL_SIZE_PX / 2);
      }
    }

    wx.canvasToTempFilePath({
      canvas: exportCanvasNode,
      success: (res) => {
        wx.hideLoading();
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '图片已保存', icon: 'success' }),
          fail: (err) => wx.showToast({ title: '保存失败: ' + err.errMsg, icon: 'none' })
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '导出失败: ' + err.errMsg, icon: 'none' });
      }
    });
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.dpr = sysInfo.pixelRatio || 1;
    console.log('Device Pixel Ratio:', this.dpr);

    const query = wx.createSelectorQuery().in(this);
    query.select('.result-container').boundingClientRect(res => {
      let initialCanvasWidth = sysInfo.windowWidth * 0.9; // Default
      let initialCanvasHeight = sysInfo.windowWidth * 0.9; // Default

      if (res && res.width) {
        initialCanvasWidth = res.width;
        // 假设高度与宽度相同，或根据图片比例动态计算，此处简单设为宽度
        initialCanvasHeight = res.width;
      }

      this.setData({
        canvasWidth: initialCanvasWidth,
        canvasHeight: initialCanvasHeight
      }, () => {
        setTimeout(() => {
          this.preInitializeCanvas();
        }, 100);
      });
    }).exec();
  },

  // 添加到Page对象中，与其他方法并列
  findClosestColor(rgb: [number, number, number]): string {
    const { paletteIndex, paletteOptions } = this.data;
    const selectedPaletteOption = paletteOptions[paletteIndex];
    const selectedPaletteKey = selectedPaletteOption.key;

    let activePaletteKeys: string[] = [];

    if (selectedPaletteKey === 'allPaletteKeys') {
      activePaletteKeys = Object.keys(beadPaletteData);
    } else if ((PaletteKeys as any)[selectedPaletteKey]) {
      activePaletteKeys = (PaletteKeys as any)[selectedPaletteKey];
    } else {
      activePaletteKeys = Object.keys(beadPaletteData);
    }

    let closestCode = '';
    let minDistance = Infinity;

    // 转换传入的RGB数组为RGB对象格式
    const targetRgb = { r: rgb[0], g: rgb[1], b: rgb[2] };

    for (const key of activePaletteKeys) {
      const hexColor = (beadPaletteData as any)[key];
      if (!hexColor) continue;

      const paletteRgb = this.hexToRgb(hexColor);
      if (!paletteRgb) continue;

      const distance = this.colorDistance(targetRgb, paletteRgb);
      if (distance < minDistance) {
        minDistance = distance;
        closestCode = key;
      }
    }

    return closestCode;
  },
})