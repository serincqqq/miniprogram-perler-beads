// 尝试导入类型，如果找不到，可以使用 any
// import { Canvas, RenderingContext } from 'wechat-miniprogram/canvas';
type Canvas = any; // 替换为正确导入的类型，或使用 any
type RenderingContext = any; // 替换为正确导入的类型，或使用 any

Component({
  data: {
    tempFilePath: '',
    gridSize: 52,
    confirmedGridSize: 52,
    mergeLevel: 30,
    paletteOptions: ['全色系291色', '简化色系100色'],
    paletteIndex: 0,
    modeOptions: ['卡通 (主色)', '写实 (细节优先)'],
    modeIndex: 0,
    canvasWidth: 300,
    canvasHeight: 300,
    imagePath: '',

    // 新增：网格调整参数
    gridCellWidth: 15,    // 网格单元格宽度（像素）
    gridCellHeight: 15,   // 网格单元格高度（像素）
    gridOffsetX: 0,       // 网格X偏移量
    gridOffsetY: 0,       // 网格Y偏移量

    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
  },

  // Canvas 和 context 作为组件实例的属性
  canvas: null as Canvas | null,
  ctx: null as RenderingContext | null,
  dpr: 1,

  lifetimes: {
    attached() {
      this.dpr = wx.getSystemInfoSync().pixelRatio || 1;
    },

    ready() {
      // 在组件就绪后预初始化Canvas
      setTimeout(() => {
        this.preInitializeCanvas();
      }, 100);
    }
  },

  methods: {
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
        this.ctx = this.canvas.getContext('2d');

        if (!this.ctx) {
          console.error('预初始化Canvas: 获取2D上下文失败');
          this.canvas = null;
          return;
        }

        // 设置初始尺寸
        this.canvas.width = this.data.canvasWidth * this.dpr;
        this.canvas.height = this.data.canvasHeight * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
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

          wx.getImageInfo({
            src: tempFilePath,
            success: (imgRes) => {
              const imgWidth = imgRes.width;
              const imgHeight = imgRes.height;
              const query = wx.createSelectorQuery().in(this);
              query.select('.result-container').boundingClientRect((containerRes) => {
                if (!containerRes) {
                  wx.showToast({ title: '无法获取容器尺寸', icon: 'none' });
                  return;
                }
                const containerWidth = containerRes.width;
                const calculatedCanvasHeight = containerWidth * (imgHeight / imgWidth);

                this.setData({
                  tempFilePath: tempFilePath,
                  imagePath: tempFilePath,
                  canvasWidth: containerWidth,
                  canvasHeight: calculatedCanvasHeight,
                  // 重置网格状态
                  gridOffsetX: 0,
                  gridOffsetY: 0
                }, () => {
                  setTimeout(() => {
                    if (this.canvas && this.ctx) {
                      this.updateCanvasSize();
                    } else {
                      this.initializeCanvas();
                    }
                  }, 150);
                });
              }).exec();
            },
            fail: (err) => {
              console.error('获取图片信息失败:', err);
              wx.showToast({ title: '图片信息获取失败', icon: 'none' });
            }
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
          // 使用用户输入的网格数重新计算网格尺寸
          const { canvasWidth, canvasHeight, confirmedGridSize } = this.data;

          // 获取图片计算比例
          wx.getImageInfo({
            src: this.data.tempFilePath,
            success: (imgRes) => {
              const imgWidth = imgRes.width;
              const imgHeight = imgRes.height;

              // 根据确认的网格数设置网格大小
              const gridCellWidth = canvasWidth / confirmedGridSize;
              const numVerticalGrids = confirmedGridSize * (imgHeight / imgWidth);
              const gridCellHeight = canvasHeight / numVerticalGrids;

              this.setData({
                gridCellWidth: gridCellWidth,
                gridCellHeight: gridCellHeight,
                // 重置偏移，回到原点
                gridOffsetX: 0,
                gridOffsetY: 0
              }, this.redrawCanvas);
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

      // 计算初始网格尺寸
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
            gridCellHeight: gridCellHeight
          }, this.redrawCanvas);
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
        this.ctx = this.canvas.getContext('2d');

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
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // 红色网格线，更醒目
      ctx.lineWidth = 1 / this.dpr;

      // 绘制垂直线
      const startX = gridOffsetX % gridCellWidth;
      for (let x = startX; x < canvasWidth; x += gridCellWidth) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
      }

      // 绘制水平线
      const startY = gridOffsetY % gridCellHeight;
      for (let y = startY; y < canvasHeight; y += gridCellHeight) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
      }

      ctx.stroke();
    },

    // 网格控制方法

    // 增大网格尺寸
    increaseGridSize() {
      if (!this.data.tempFilePath) return;

      const newWidth = this.data.gridCellWidth * 1.1;
      const newHeight = this.data.gridCellHeight * 1.1;

      this.setData({
        gridCellWidth: newWidth,
        gridCellHeight: newHeight
      }, this.redrawCanvas);
    },

    // 减小网格尺寸
    decreaseGridSize() {
      if (!this.data.tempFilePath) return;

      // 防止网格过小
      if (this.data.gridCellWidth < 1 || this.data.gridCellHeight < 1) {
        wx.showToast({ title: '网格已达最小尺寸', icon: 'none' });
        return;
      }

      const newWidth = this.data.gridCellWidth / 1.1;
      const newHeight = this.data.gridCellHeight / 1.1;

      this.setData({
        gridCellWidth: newWidth,
        gridCellHeight: newHeight
      }, this.redrawCanvas);
    },

    // 移动网格位置
    moveGridLeft() {
      if (!this.data.tempFilePath) return;
      this.setData({
        gridOffsetX: this.data.gridOffsetX - 1
      }, this.redrawCanvas);
    },

    moveGridRight() {
      if (!this.data.tempFilePath) return;
      this.setData({
        gridOffsetX: this.data.gridOffsetX + 1
      }, this.redrawCanvas);
    },

    moveGridUp() {
      if (!this.data.tempFilePath) return;
      this.setData({
        gridOffsetY: this.data.gridOffsetY - 1
      }, this.redrawCanvas);
    },

    moveGridDown() {
      if (!this.data.tempFilePath) return;
      this.setData({
        gridOffsetY: this.data.gridOffsetY + 1
      }, this.redrawCanvas);
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
            gridCellHeight: gridCellHeight,
            gridOffsetX: 0,
            gridOffsetY: 0
          }, this.redrawCanvas);
        }
      });
    },
    exportImg() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#previewCanvas').fields({ node: true, size: true }).exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          wx.canvasToTempFilePath({
            canvas,
            success: (res) => {
              const tempFilePath = res.tempFilePath;
              wx.saveImageToPhotosAlbum({
                filePath: tempFilePath,
                success: () => {
                  wx.showToast({
                    title: '图片保存成功',
                    icon: 'success'
                  });
                },
                fail: (err) => {
                  console.error('保存图片失败:', err);
                }
              });
            },
            fail: (err) => {
              console.error('转换为临时文件失败:', err);
            }
          });
        } else {
          console.error('未找到 canvas 元素');
        }
      });
    }
  }
})