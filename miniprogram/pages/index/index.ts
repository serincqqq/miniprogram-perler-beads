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
      { name: '全色系291色', key: 'allPaletteKeys' }, // 'allPaletteKeys' 是一个自定义的键，表示使用 beadPaletteData 中的所有颜色
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

  onGridSizeInput(e: WechatMiniprogram.Input) {
    let value = parseInt(e.detail.value, 10);
    if (isNaN(value)) {
      value = this.data.confirmedGridSize;
    } else if (value < 10) {
      value = 10;
    } else if (value > 200) {
      value = 200;
    }
    this.setData({ gridSize: value });
    return value.toString();
  },

  confirmGridSize() {
    this.setData({ confirmedGridSize: this.data.gridSize }, () => {
      if (this.data.tempFilePath) {
        const { canvasWidth, canvasHeight, confirmedGridSize } = this.data;
        wx.getImageInfo({
          src: this.data.tempFilePath,
          success: (imgRes) => {
            const imgWidth = imgRes.width;
            const imgHeight = imgRes.height;
            const gridCellWidth = canvasWidth / confirmedGridSize;
            const numVerticalGrids = confirmedGridSize * (imgHeight / imgWidth);
            const gridCellHeight = canvasHeight / numVerticalGrids;

            this.setData({
              gridCellWidth: gridCellWidth,
              formattedGridCellWidth: gridCellWidth.toFixed(2),
              gridCellHeight: gridCellHeight,
              formattedGridCellHeight: gridCellHeight.toFixed(2),
              gridOffsetX: 0,
              gridOffsetY: 0
            }, () => this.redrawCanvas());
          }
        });
      }
      wx.showToast({ title: '格子数已确认', icon: 'success', duration: 1000 });
    });
  },

  onMergeLevelChange(e: WechatMiniprogram.SliderChange) {
    this.setData({ mergeLevel: e.detail.value });
  },

  onPaletteChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ paletteIndex: parseInt(e.detail.value as string, 10) });
  },

  onModeChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ modeIndex: parseInt(e.detail.value as string, 10) });
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
    let newWidth = param === 'add' ? this.data.gridCellWidth + 0.2 : this.data.gridCellWidth - 0.2;
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
    let newHeight = param === 'add' ? this.data.gridCellHeight + 0.2 : this.data.gridCellHeight - 0.2;
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
    const param = e.currentTarget.dataset.param as string; // 'down' for up, 'top' for down in UI
    let newOffsetY = this.data.gridOffsetY;
    if (param === 'down') { // UI '↓' means move grid content down, so offset decreases for visual upward movement
      newOffsetY = this.data.gridOffsetY + 1;
    } else { // UI '↑' means move grid content up, so offset increases for visual downward movement
      newOffsetY = this.data.gridOffsetY - 1;
    }
    this.setData({ gridOffsetY: newOffsetY }, () => this.redrawCanvas());
  },


  // 重置网格到初始状态
  resetGrid() {
    if (!this.data.tempFilePath) return;

    const { canvasWidth, canvasHeight, confirmedGridSize } = this.data;

    wx.getImageInfo({
      src: this.data.tempFilePath,
      success: (imgRes) => {
        const imgWidth = imgRes.width;
        const imgHeight = imgRes.height;

        // 重新计算初始网格尺寸
        const gridCellWidth = canvasWidth / confirmedGridSize;
        const numVerticalGrids = confirmedGridSize * (imgHeight / imgWidth);
        const gridCellHeight = canvasHeight / numVerticalGrids;

        this.setData({
          gridCellWidth: gridCellWidth,
          formattedGridCellWidth: gridCellWidth.toFixed(2),
          gridCellHeight: gridCellHeight,
          formattedGridCellHeight: gridCellHeight.toFixed(2),
          gridOffsetX: 0,
          gridOffsetY: 0
        }, () => this.redrawCanvas());
      }
    });
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

          const { width: containerWidth, height: containerHeight } = rect;

          // 根据容器和图片尺寸计算比例
          // 注意：calibrationImage的样式设置了transform: scale(2)，所以这里需要除以2
          const scaleX = imgWidth / (containerWidth / 2);
          const scaleY = imgHeight / (containerHeight / 2);

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

  async exportImg() {
    if (!this.ctx || !this.canvas || !this.data.imagePath) {
      wx.showToast({ title: '请先选择并校准图片', icon: 'none' });
      return;
    }

    // wx.showLoading({ title: '生成中...' });

    const { canvasWidth, canvasHeight, gridCellWidth, gridCellHeight, gridOffsetX, gridOffsetY, paletteIndex, paletteOptions } = this.data;
    const exportScaleFactor = 3; // 图片导出放大倍数，可以调整，例如 2 或 3

    const exportCanvasWidth = canvasWidth * exportScaleFactor;
    const exportCanvasHeight = canvasHeight * exportScaleFactor;
    const selectedPaletteOption = paletteOptions[paletteIndex];
    const selectedPaletteKey = selectedPaletteOption.key;
    let activePaletteKeys: string[] = [];

    if (selectedPaletteKey === 'allPaletteKeys') {
      activePaletteKeys = Object.keys(beadPaletteData);
    } else if ((PaletteKeys as any)[selectedPaletteKey]) {
      activePaletteKeys = (PaletteKeys as any)[selectedPaletteKey];
    } else {
      console.warn(`Palette key "${selectedPaletteKey}" not found, defaulting to all keys.`);
      activePaletteKeys = Object.keys(beadPaletteData);
    }

    const paletteRgbMap: { [key: string]: { r: number; g: number; b: number } } = {};
    activePaletteKeys.forEach(key => {
      const hexColor = (beadPaletteData as any)[key];
      if (hexColor) {
        const rgb = this.hexToRgb(hexColor);
        if (rgb) {
          paletteRgbMap[key] = rgb;
        }
      }
    });

    // 尝试创建 OffscreenCanvas
    let exportCanvasNode: any;
    let exportCtx: RenderingContext | null = null;

    try {
      // 标准方式创建，如果 linter 报错但实际可用，则优先使用
      exportCanvasNode = wx.createOffscreenCanvas({ type: '2d', width: exportCanvasWidth, height: exportCanvasHeight });
      exportCtx = exportCanvasNode.getContext('2d');
    } catch (e) {
      console.warn("Standard OffscreenCanvas creation failed, trying alternative:", e);
      // 兼容性/Linter 严格模式下的备选方案
      exportCanvasNode = wx.createOffscreenCanvas();
      if (exportCanvasNode) {
        exportCanvasNode.width = exportCanvasWidth;
        exportCanvasNode.height = exportCanvasHeight;
        exportCtx = exportCanvasNode.getContext('2d');
      }
    }

    if (!exportCtx || !exportCanvasNode) {
      wx.hideLoading();
      wx.showToast({ title: '创建导出画布失败', icon: 'none' });
      return;
    }


    const img = this.canvas.createImage(); // 使用 wx.createImage()
    img.src = this.data.imagePath;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err: any) => {
        console.error("Export image load error:", err);
        reject(new Error("Failed to load image for export"));
      };
    });

    exportCtx.imageSmoothingEnabled = false;
    exportCtx.drawImage(img, 0, 0, exportCanvasWidth, exportCanvasHeight); // 绘制到放大后的画布

    const mainCanvasPhysicalWidth = this.canvas.width;
    const mainCanvasPhysicalHeight = this.canvas.height;
    const mainCanvasImageData = this.ctx.getImageData(0, 0, mainCanvasPhysicalWidth, mainCanvasPhysicalHeight);

    const cellDataForExport: Array<{ x: number; y: number; width: number; height: number; colorCode: string; cellRgb: { r: number; g: number; b: number } }> = [];
    const firstVisibleX = (gridOffsetX % gridCellWidth) - gridCellWidth;
    const firstVisibleY = (gridOffsetY % gridCellHeight) - gridCellHeight;

    for (let y = firstVisibleY; y < canvasHeight; y += gridCellHeight) {
      for (let x = firstVisibleX; x < canvasWidth; x += gridCellWidth) {
        const cellLogicalX = x;
        const cellLogicalY = y;
        const sampleX = Math.max(0, cellLogicalX);
        const sampleY = Math.max(0, cellLogicalY);
        const sampleEndX = Math.min(canvasWidth, cellLogicalX + gridCellWidth);
        const sampleEndY = Math.min(canvasHeight, cellLogicalY + gridCellHeight);
        const sampleW = sampleEndX - sampleX;
        const sampleH = sampleEndY - sampleY;

        if (sampleW <= 0 || sampleH <= 0) continue;

        const physicalSampleX = Math.floor(sampleX * this.dpr);
        const physicalSampleY = Math.floor(sampleY * this.dpr);
        const physicalSampleW = Math.floor(sampleW * this.dpr);
        const physicalSampleH = Math.floor(sampleH * this.dpr);

        let rSum = 0, gSum = 0, bSum = 0, pixelCount = 0;
        for (let py = physicalSampleY; py < physicalSampleY + physicalSampleH; py++) {
          for (let px = physicalSampleX; px < physicalSampleX + physicalSampleW; px++) {
            if (px < 0 || px >= mainCanvasPhysicalWidth || py < 0 || py >= mainCanvasPhysicalHeight) continue;
            const dataIndex = (py * mainCanvasPhysicalWidth + px) * 4;
            rSum += mainCanvasImageData.data[dataIndex];
            gSum += mainCanvasImageData.data[dataIndex + 1];
            bSum += mainCanvasImageData.data[dataIndex + 2];
            pixelCount++;
          }
        }

        if (pixelCount === 0) continue;
        const avgR = Math.round(rSum / pixelCount);
        const avgG = Math.round(gSum / pixelCount);
        const avgB = Math.round(bSum / pixelCount);
        const currentCellRgb = { r: avgR, g: avgG, b: avgB };

        let closestCode = 'N/A';
        let minDistance = Infinity;
        if (Object.keys(paletteRgbMap).length > 0) {
          for (const code in paletteRgbMap) {
            const dist = this.colorDistance(currentCellRgb, paletteRgbMap[code]);
            if (dist < minDistance) {
              minDistance = dist;
              closestCode = code;
            }
          }
        }
        cellDataForExport.push({ x: sampleX, y: sampleY, width: sampleW, height: sampleH, colorCode: closestCode, cellRgb: currentCellRgb });
      }
    }

    exportCtx.strokeStyle = 'black';
    exportCtx.lineWidth = 1 * exportScaleFactor; // 让线条在放大后视觉上保持一定粗细

    // 调整基础字体大小，并乘以放大倍数
    const baseFontSize = (Math.min(gridCellWidth, gridCellHeight) / 3) * exportScaleFactor;
    exportCtx.font = `${Math.max(5 * exportScaleFactor, Math.floor(baseFontSize))}px Arial`; // 最小字体也放大
    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';

    cellDataForExport.forEach(cell => {
      // 所有绘制坐标和尺寸都要乘以放大倍数
      const ex = cell.x * exportScaleFactor;
      const ey = cell.y * exportScaleFactor;
      const ew = cell.width * exportScaleFactor;
      const eh = cell.height * exportScaleFactor;

      exportCtx.strokeRect(ex, ey, ew, eh);
      const brightness = (cell.cellRgb.r * 299 + cell.cellRgb.g * 587 + cell.cellRgb.b * 114) / 1000;
      exportCtx.fillStyle = brightness > 128 ? 'black' : 'white';
      exportCtx.fillText(cell.colorCode, ex + ew / 2, ey + eh / 2);
    });

    wx.canvasToTempFilePath({
      canvas: exportCanvasNode, // 使用离屏 canvas
      success: (res) => {
        wx.hideLoading();
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '图片已保存', icon: 'success' }),
          fail: (err) => {
            console.error('保存图片失败:', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('导出为临时文件失败:', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
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
})