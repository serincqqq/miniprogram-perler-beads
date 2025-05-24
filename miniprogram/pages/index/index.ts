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

    // 新增：手动选择背景模式
    manualBackgroundMode: false,
    selectedBackgroundColor: '',
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
  onGridCellBlur(e) {
    const value = e.detail.value;
    const type = e.currentTarget.dataset.param as string;
    console.log('失焦时的值:', typeof value, type);
    if (type === 'width') {
      this.setData({
        gridCellWidth: parseFloat(value),
        // formattedGridCellWidth: value.toFixed(2)
      }, () => this.redrawCanvas());
    } else {
      console.log('ddd')
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
    console.log('fff')
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

  // 添加手动选择背景的方法
  toggleBackgroundSelectionMode() {
    this.setData({
      manualBackgroundMode: !this.data.manualBackgroundMode
    });

    if (this.data.manualBackgroundMode) {
      wx.showToast({
        title: '点击选择背景区域',
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '已退出背景选择模式',
        icon: 'none'
      });
    }
  },

  // 处理点击事件
  handleCanvasTouch(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.manualBackgroundMode) return;

    // 获取触摸点相对于页面的坐标
    const { clientX, clientY } = e.touches[0];

    if (!this.ctx || !this.canvas) {
      wx.showToast({
        title: '画布未准备好',
        icon: 'none'
      });
      return;
    }

    try {
      // 获取 canvas 元素的位置信息
      const query = wx.createSelectorQuery();
      query.select('#previewCanvas')
        .boundingClientRect()
        .exec((res) => {
          if (!res || !res[0]) {
            wx.showToast({
              title: '无法获取画布位置',
              icon: 'none'
            });
            return;
          }

          // 计算触摸点相对于画布的坐标
          const canvasRect = res[0];
          const x = clientX - canvasRect.left;
          const y = clientY - canvasRect.top;

          console.log('Canvas位置:', canvasRect);
          console.log('点击位置 - 原始:', clientX, clientY);
          console.log('点击位置 - 相对画布:', x, y);

          // 检查坐标是否在画布范围内
          if (x < 0 || y < 0 || x >= this.data.canvasWidth || y >= this.data.canvasHeight) {
            wx.showToast({
              title: '点击位置超出画布范围',
              icon: 'none'
            });
            return;
          }

          // 获取点击位置对应的网格单元格
          const gridCol = Math.floor((x - this.data.gridOffsetX) / this.data.gridCellWidth);
          const gridRow = Math.floor((y - this.data.gridOffsetY) / this.data.gridCellHeight);

          console.log('选中网格:', gridRow, gridCol);
          
          try {
            // 获取单元格的平均颜色，排除网格线
            const GRID_LINE_WIDTH = 1; // 假设网格线宽度为1px，如果不同请修改
            const cellX = this.data.gridOffsetX + gridCol * this.data.gridCellWidth;
            const cellY = this.data.gridOffsetY + gridRow * this.data.gridCellHeight;

            // 计算实际采样区域（排除网格线）
            // 我们从单元格的(1,1)像素开始，到(width-1, height-1)结束，以避开边缘的网格线
            const sampleX = Math.ceil(cellX + GRID_LINE_WIDTH);
            const sampleY = Math.ceil(cellY + GRID_LINE_WIDTH);
            // 确保宽度和高度至少为1，并且减去两倍的网格线宽度
            const sampleWidth = Math.max(1, Math.floor(this.data.gridCellWidth - (GRID_LINE_WIDTH * 2)));
            const sampleHeight = Math.max(1, Math.floor(this.data.gridCellHeight - (GRID_LINE_WIDTH * 2)));
            
            console.log('单元格原始坐标:', cellX, cellY);
            console.log('单元格原始尺寸:', this.data.gridCellWidth, this.data.gridCellHeight);
            console.log('采样区域:', {
              x: sampleX,
              y: sampleY,
              width: sampleWidth,
              height: sampleHeight
            });

            // 确保采样区域有效
            if (sampleWidth <= 0 || sampleHeight <= 0) {
              wx.showToast({
                title: '网格太小无法取色',
                icon: 'none'
              });
              console.warn('采样区域无效:', sampleWidth, sampleHeight, '单元格尺寸:', this.data.gridCellWidth, this.data.gridCellHeight);
              return;
            }

            // 获取中心区域的像素数据（排除边缘的网格线）
            const imageData = this.ctx.getImageData(
              sampleX,
              sampleY,
              sampleWidth,
              sampleHeight
            );
            const data = imageData.data;

            // 计算平均RGB
            let rSum = 0, gSum = 0, bSum = 0, pixelCount = 0;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // 忽略完全透明的像素
              if (a > 0) {
                rSum += r;
                gSum += g;
                bSum += b;
                pixelCount++;
              }
            }

            if (pixelCount === 0) {
              wx.showToast({
                title: '选中区域无有效像素',
                icon: 'none'
              });
              return;
            }

            const avgR = Math.round(rSum / pixelCount);
            const avgG = Math.round(gSum / pixelCount);
            const avgB = Math.round(bSum / pixelCount);

            console.log('平均颜色RGB:', avgR, avgG, avgB);

            // 找到最接近的色板颜色
            const closestColorCode = this.findClosestColor([avgR, avgG, avgB]);

            this.setData({
              selectedBackgroundColor: closestColorCode,
              manualBackgroundMode: false // 自动退出选择模式
            });

            wx.showToast({
              title: `已选择背景色: ${closestColorCode}`,
              icon: 'none'
            });
          } catch (error) {
            console.error('获取像素颜色错误细节:', error);
            wx.showToast({
              title: '获取单元格颜色失败',
              icon: 'none'
            });
          }
        });
    } catch (error) {
      console.error('获取画布位置失败:', error);
      wx.showToast({
        title: '获取颜色失败',
        icon: 'none'
      });
    }
  },

  async exportImg() {
    if (!this.ctx || !this.canvas || !this.data.imagePath) {
      wx.showToast({ title: '请先选择并校准图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成中...' });

    const { canvasWidth, canvasHeight, gridCellWidth, gridCellHeight, gridOffsetX, gridOffsetY, paletteIndex, paletteOptions } = this.data;
    const EXPORT_CELL_SIZE_PX = 40; // 导出的每个格子的固定像素尺寸
    const MERGE_TOLERANCE_FACTOR = 0.25;
    const REGION_MERGE_DIST = 20; // 可调，越大合并越激进

    // --- 第一步：收集所有单元格的颜色和位置信息 ---
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

    const mainCanvasNode = this.canvas;
    if (!mainCanvasNode) {
      wx.hideLoading();
      wx.showToast({ title: '主画布未准备好', icon: 'none' });
      return;
    }
    const mainCanvasPhysicalWidth = mainCanvasNode.width;
    const mainCanvasPhysicalHeight = mainCanvasNode.height;
    const mainCanvasImageData = this.ctx!.getImageData(0, 0, mainCanvasPhysicalWidth, mainCanvasPhysicalHeight);

    const cellDataForProcessing: Array<{
      avgRgb: { r: number; g: number; b: number };
      initialColorCode: string;
      finalColorCode: string;
      gridRow: number; gridCol: number;
      isBackground: boolean; // 新增：标记是否为背景
      originalX: number; originalY: number; originalW: number; originalH: number;
    }> = [];

    const firstVisibleX = (gridOffsetX % gridCellWidth) - gridCellWidth;
    const firstVisibleY = (gridOffsetY % gridCellHeight) - gridCellHeight;

    let currentRow = 0;
    for (let y_coord = firstVisibleY; y_coord < canvasHeight; y_coord += gridCellHeight, currentRow++) {
      let currentCol = 0;
      for (let x_coord = firstVisibleX; x_coord < canvasWidth; x_coord += gridCellWidth, currentCol++) {
        const cellLogicalX = x_coord;
        const cellLogicalY = y_coord;
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
        const currentAvgRgb = { r: avgR, g: avgG, b: avgB };

        let closestCode = 'N/A';
        if (Object.keys(paletteRgbMap).length > 0) {
          let minDistance = Infinity;
          for (const code in paletteRgbMap) {
            const dist = this.colorDistance(currentAvgRgb, paletteRgbMap[code]);
            if (dist < minDistance) {
              minDistance = dist;
              closestCode = code;
            }
          }
        }
        cellDataForProcessing.push({
          avgRgb: currentAvgRgb,
          initialColorCode: closestCode,
          finalColorCode: closestCode,
          gridRow: currentRow, gridCol: currentCol,
          isBackground: false, // 初始化为非背景
          originalX: sampleX, originalY: sampleY, originalW: sampleW, originalH: sampleH
        });
      }
    }

    if (cellDataForProcessing.length === 0) {
      wx.hideLoading();
      wx.showToast({ title: '没有可导出的单元格', icon: 'none' });
      return;
    }

    // --- 第二步：邻域颜色平滑处理 ---
    const maxGridRow = cellDataForProcessing.reduce((max, cell) => Math.max(max, cell.gridRow), 0);
    const maxGridCol = cellDataForProcessing.reduce((max, cell) => Math.max(max, cell.gridCol), 0);

    const cellGrid: (typeof cellDataForProcessing[0] | undefined)[][] = Array(maxGridRow + 1).fill(null).map(() => Array(maxGridCol + 1).fill(undefined));
    cellDataForProcessing.forEach(cell => {
      if (cell.gridRow <= maxGridRow && cell.gridCol <= maxGridCol) {
        cellGrid[cell.gridRow][cell.gridCol] = cell;
      }
    });

    for (const cell of cellDataForProcessing) {
      const { gridRow, gridCol, avgRgb, initialColorCode } = cell;
      if (initialColorCode === 'N/A' || !paletteRgbMap[initialColorCode]) {
        cell.finalColorCode = initialColorCode; continue;
      }
      const neighborOffsets = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      const neighborInitialCodes: string[] = [];
      for (const offset of neighborOffsets) {
        const nr = gridRow + offset[0], nc = gridCol + offset[1];
        if (nr >= 0 && nr <= maxGridRow && nc >= 0 && nc <= maxGridCol && cellGrid[nr][nc]) {
          const neighborCell = cellGrid[nr][nc]!;
          if (neighborCell.initialColorCode !== 'N/A') neighborInitialCodes.push(neighborCell.initialColorCode);
        }
      }
      if (neighborInitialCodes.length === 0) { cell.finalColorCode = initialColorCode; continue; }
      const codeCounts: { [code: string]: number } = {};
      let maxCount = 0, dominantNeighborCode = neighborInitialCodes[0];
      neighborInitialCodes.forEach(nc => {
        codeCounts[nc] = (codeCounts[nc] || 0) + 1;
        if (codeCounts[nc] > maxCount) { maxCount = codeCounts[nc]; dominantNeighborCode = nc; }
      });
      if (dominantNeighborCode && dominantNeighborCode !== initialColorCode && paletteRgbMap[dominantNeighborCode]) {
        const distToInitial = this.colorDistance(avgRgb, paletteRgbMap[initialColorCode]);
        const distToDominant = this.colorDistance(avgRgb, paletteRgbMap[dominantNeighborCode]);
        if (distToDominant < distToInitial * (1 + MERGE_TOLERANCE_FACTOR)) cell.finalColorCode = dominantNeighborCode;
        else cell.finalColorCode = initialColorCode;
      } else cell.finalColorCode = initialColorCode;
    }

    // --- 第三步：区域合并 ---
    // 1. 构建二维格子数组
    const gridRows = maxGridRow + 1;
    const gridCols = maxGridCol + 1;
    const regionVisited: boolean[][] = Array(gridRows).fill(null).map(() => Array(gridCols).fill(false));

    // 2. 区域合并
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (regionVisited[r][c]) continue;
        const startCell = cellGrid[r][c];
        if (!startCell) continue;

        // 区域BFS
        const queue: { r: number, c: number }[] = [{ r, c }];
        const regionCells: { r: number, c: number }[] = [];
        const colorCount: { [key: string]: number } = {};
        regionVisited[r][c] = true;

        while (queue.length > 0) {
          const { r: cr, c: cc } = queue.shift()!;
          const cell = cellGrid[cr][cc];
          if (!cell) continue;
          regionCells.push({ r: cr, c: cc });
          colorCount[cell.finalColorCode] = (colorCount[cell.finalColorCode] || 0) + 1;

          // 只考虑上下左右
          const neighbors = [
            { nr: cr - 1, nc: cc },
            { nr: cr + 1, nc: cc },
            { nr: cr, nc: cc - 1 },
            { nr: cr, nc: cc + 1 }
          ];
          for (const { nr, nc } of neighbors) {
            if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && !regionVisited[nr][nc]) {
              const neighbor = cellGrid[nr][nc];
              if (!neighbor) continue;
              // 距离判断
              const dist = this.colorDistance(
                paletteRgbMap[cell.finalColorCode] || cell.avgRgb,
                paletteRgbMap[neighbor.finalColorCode] || neighbor.avgRgb
              );
              if (dist < REGION_MERGE_DIST) {
                regionVisited[nr][nc] = true;
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }

        // 3. 区域主色归一
        let dominantKey = '';
        let maxCount = 0;
        for (const key in colorCount) {
          if (colorCount[key] > maxCount) {
            maxCount = colorCount[key];
            dominantKey = key;
          }
        }
        if (!dominantKey) dominantKey = startCell.finalColorCode;

        // 4. 区域内所有格子都归为主色
        for (const { r: rr, c: cc } of regionCells) {
          if (cellGrid[rr][cc]) cellGrid[rr][cc]!.finalColorCode = dominantKey;
        }
      }
    }

    // --- 第四步：背景色识别和标记 ---
    // 1. 识别边缘颜色
    let backgroundColorCode = '';

    // 如果有手动选择的背景色，优先使用
    if (this.data.selectedBackgroundColor) {
      backgroundColorCode = this.data.selectedBackgroundColor;
      console.log("使用手动选择的背景色:", backgroundColorCode);
    } else {
      // 添加白色/近似白色背景检测
      // 检查边缘区域是否主要是白色/近似白色
      const edgeCells = [];
      
      // 收集所有边缘单元格
      // 上边缘
      for (let c = 0; c <= maxGridCol; c++) {
        if (cellGrid[0] && cellGrid[0][c]) edgeCells.push(cellGrid[0][c]);
      }
      // 下边缘
      for (let c = 0; c <= maxGridCol; c++) {
        if (cellGrid[maxGridRow] && cellGrid[maxGridRow][c]) edgeCells.push(cellGrid[maxGridRow][c]);
      }
      // 左边缘
      for (let r = 1; r < maxGridRow; r++) {
        if (cellGrid[r] && cellGrid[r][0]) edgeCells.push(cellGrid[r][0]);
      }
      // 右边缘
      for (let r = 1; r < maxGridRow; r++) {
        if (cellGrid[r] && cellGrid[r][maxGridCol]) edgeCells.push(cellGrid[r][maxGridCol]);
      }
      
      // 检查多少比例的边缘是白色或近似白色
      const whiteColorCount = edgeCells.filter(cell => {
        const rgb = paletteRgbMap[cell.finalColorCode];
        if (!rgb) return false;
        
        // 检查是否为白色或近似白色 (高亮度颜色)
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 220; // 亮度阈值, 220以上认为是近似白色
      }).length;
      
      const whiteRatio = whiteColorCount / edgeCells.length;
      console.log(`边缘白色比例: ${whiteRatio.toFixed(2)}, 白色数: ${whiteColorCount}, 总边缘: ${edgeCells.length}`);
      
      // 如果超过70%的边缘是白色或近似白色，那么直接将这些颜色识别为背景
      if (whiteRatio > 0.7) {
        console.log("检测到白色/近似白色背景");
        
        // 构建白色/近似白色颜色列表
        const whiteLikeColors = new Set<string>();
        for (const cell of edgeCells) {
          const rgb = paletteRgbMap[cell.finalColorCode];
          if (!rgb) continue;
          
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          if (brightness > 220) {
            whiteLikeColors.add(cell.finalColorCode);
          }
        }
        
        console.log("识别为背景的颜色:", Array.from(whiteLikeColors));
        
        // 自动将所有白色/近似白色单元格标记为背景
        for (const cell of cellDataForProcessing) {
          if (whiteLikeColors.has(cell.finalColorCode)) {
            cell.isBackground = true;
          }
        }
        
        // 使用其中一个白色作为背景色码
        backgroundColorCode = Array.from(whiteLikeColors)[0];
      } else {
        // 使用原来的最频繁边缘颜色方法
        const colorFrequency: Record<string, number> = {};
        edgeCells.forEach(cell => {
          const colorKey = cell.finalColorCode;
          colorFrequency[colorKey] = (colorFrequency[colorKey] || 0) + 1;
        });
        
        let maxFrequency = 0;
        for (const [colorCode, frequency] of Object.entries(colorFrequency)) {
          if (frequency > maxFrequency) {
            maxFrequency = frequency;
            backgroundColorCode = colorCode;
          }
        }
        
        console.log("检测到的背景色:", backgroundColorCode);
      
        // 2. 从边缘开始进行洪水填充，将连续的背景色区域标记为背景
        const isVisitedForBg: boolean[][] = Array(maxGridRow + 1).fill(null).map(() => Array(maxGridCol + 1).fill(false));
        
        // 改进的颜色相似度判断函数 - 使用容差
        const isColorSimilarToBackground = (colorCode: string) => {
          // 如果完全相同，直接返回 true
          if (colorCode === backgroundColorCode) return true;
        
          // 否则检查颜色距离是否在容差范围内
          const bgRgb = paletteRgbMap[backgroundColorCode];
          const cellRgb = paletteRgbMap[colorCode];
        
          if (!bgRgb || !cellRgb) return false;
        
          const colorDist = this.colorDistance(bgRgb, cellRgb);
          return colorDist <= this.data.backgroundTolerance;
        };
        
        // 修改后的洪水填充函数 - 使用颜色相似度而非严格相等
        const floodFillBackground = (startR: number, startC: number) => {
          if (!cellGrid[startR] || !cellGrid[startR][startC] || isVisitedForBg[startR][startC]) return;
          if (!isColorSimilarToBackground(cellGrid[startR][startC]!.finalColorCode)) return;
        
          const queue: Array<[number, number]> = [[startR, startC]];
          isVisitedForBg[startR][startC] = true;
          cellGrid[startR][startC]!.isBackground = true;
        
          while (queue.length > 0) {
            const [r, c] = queue.shift()!;
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // 右、下、左、上
        
            for (const [dr, dc] of directions) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr <= maxGridRow && nc >= 0 && nc <= maxGridCol &&
                !isVisitedForBg[nr][nc] && cellGrid[nr][nc] &&
                isColorSimilarToBackground(cellGrid[nr][nc]!.finalColorCode)) {
                isVisitedForBg[nr][nc] = true;
                cellGrid[nr][nc]!.isBackground = true;
                queue.push([nr, nc]);
              }
            }
          }
        };
        
        // 从四条边缘开始填充
        for (let c = 0; c <= maxGridCol; c++) {
          floodFillBackground(0, c); // 上边缘
          floodFillBackground(maxGridRow, c); // 下边缘
        }
        for (let r = 0; r <= maxGridRow; r++) {
          floodFillBackground(r, 0); // 左边缘
          floodFillBackground(r, maxGridCol); // 右边缘
        }
      }
    }

    // --- 第五步：创建导出画布并绘制 ---
    const numExportCols = maxGridCol + 1;
    const numExportRows = maxGridRow + 1;
    const exportCanvasTotalWidth = numExportCols * EXPORT_CELL_SIZE_PX;
    const exportCanvasTotalHeight = numExportRows * EXPORT_CELL_SIZE_PX;

    let exportCanvasNode: any;
    let exportCtx: RenderingContext | null = null;
    try {
      exportCanvasNode = wx.createOffscreenCanvas({ type: '2d', width: exportCanvasTotalWidth, height: exportCanvasTotalHeight });
      exportCtx = exportCanvasNode.getContext('2d');
    } catch (e) {
      console.warn("Standard OffscreenCanvas creation failed, trying alternative:", e);
      exportCanvasNode = wx.createOffscreenCanvas();
      if (exportCanvasNode) {
        exportCanvasNode.width = exportCanvasTotalWidth;
        exportCanvasNode.height = exportCanvasTotalHeight;
        exportCtx = exportCanvasNode.getContext('2d');
      }
    }

    if (!exportCtx || !exportCanvasNode) {
      wx.hideLoading();
      wx.showToast({ title: '创建导出画布失败', icon: 'none' });
      return;
    }

    // 设置透明背景
    exportCtx.clearRect(0, 0, exportCanvasTotalWidth, exportCanvasTotalHeight);

    // 先绘制所有格子线（包括背景区域的格子线）
    exportCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; // 稍微透明一点的黑色线条
    exportCtx.lineWidth = 1;

    // 绘制所有的格子线
    for (let r = 0; r <= numExportRows; r++) {
      const y = r * EXPORT_CELL_SIZE_PX;
      exportCtx.beginPath();
      exportCtx.moveTo(0, y);
      exportCtx.lineTo(exportCanvasTotalWidth, y);
      exportCtx.stroke();
    }

    for (let c = 0; c <= numExportCols; c++) {
      const x = c * EXPORT_CELL_SIZE_PX;
      exportCtx.beginPath();
      exportCtx.moveTo(x, 0);
      exportCtx.lineTo(x, exportCanvasTotalHeight);
      exportCtx.stroke();
    }

    // 然后绘制非背景区域的格子内容
    exportCtx.font = '14px Arial';
    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';

    for (const cell of cellDataForProcessing) {
      const exportX = cell.gridCol * EXPORT_CELL_SIZE_PX;
      const exportY = cell.gridRow * EXPORT_CELL_SIZE_PX;

      // 跳过背景格子的填充色和文本，但不跳过格子线（已在上面绘制）
      if (cell.isBackground) continue;

      // 填充格子背景色
      const cellColorHex = paletteRgbMap[cell.finalColorCode] ? (beadPaletteData as any)[cell.finalColorCode] : '#CCCCCC';
      exportCtx.fillStyle = cellColorHex || '#CCCCCC';
      exportCtx.fillRect(exportX, exportY, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

      // 重新绘制非背景格子的边框，让边框更清晰
      exportCtx.strokeStyle = 'black';
      exportCtx.strokeRect(exportX, exportY, EXPORT_CELL_SIZE_PX, EXPORT_CELL_SIZE_PX);

      // 绘制文字（颜色代码）
      const cellRgbForText = paletteRgbMap[cell.finalColorCode] || { r: 204, g: 204, b: 204 };
      const brightness = (cellRgbForText.r * 299 + cellRgbForText.g * 587 + cellRgbForText.b * 114) / 1000;
      exportCtx.fillStyle = brightness > 128 ? 'black' : 'white';
      exportCtx.fillText(cell.finalColorCode, exportX + EXPORT_CELL_SIZE_PX / 2, exportY + EXPORT_CELL_SIZE_PX / 2);
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

  // 背景容差调整
  onBackgroundToleranceChange(e: WechatMiniprogram.SliderChange) {
    this.setData({
      backgroundTolerance: e.detail.value
    });
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