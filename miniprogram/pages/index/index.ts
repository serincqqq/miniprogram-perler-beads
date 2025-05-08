// 尝试导入类型，如果找不到，可以使用 any
// import { Canvas, RenderingContext } from 'wechat-miniprogram/canvas';
type Canvas = any; // 替换为正确导入的类型，或使用 any
type RenderingContext = any; // 替换为正确导入的类型，或使用 any

Component({
  data: {
    //网格图格子微调相关变量
    mainLeftAxis: 20,
    leftValue: 0.0, // 转换后的当前值
    mainRightAxis: 20,
    rightValue: 0.0,
    mainTopAxis: 20,
    topValue: 0.0,
    mainBottomAxis: 20,
    bottomValue: 0.0,
    prevLeftValue: 20, // 新增：记录上一次左侧滑块的值
    prevRightValue: 20, // 新增：记录上一次右侧滑块的值
    prevTopValue: 20, // 新增：记录上一次顶部滑块的值
    prevBottomValue: 20,// 新增：记录上一次底部滑块的值
    //画布相关变量
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
    gridCellWidth: 15.0,    // 网格单元格宽度（像素）
    gridCellHeight: 15.0,   // 网格单元格高度（像素）
    gridOffsetX: 0,       // 网格X偏移量
    gridOffsetY: 0,       // 网格Y偏移量

    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),

    // 校准弹窗相关
    showCalibrationModal: false,     // 是否显示校准弹窗
    calibrationImg: '',              // 校准弹窗中显示的图片
    // 轴线位置 (改为像素值而非百分比)
    leftAxis: 30,
    rightAxis: 80,
    topAxis: 30,
    bottomAxis: 80,
    isMovingAxis: '',
    calibrationCellWidth: 0,  // 新增：校准后的单元格宽度
    calibrationCellHeight: 0, // 新增：校准后的单元格高度
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

          // 首先设置临时文件路径，以便显示在弹窗中
          this.setData({
            tempFilePath: tempFilePath,
            calibrationImg: tempFilePath,
            // 重置轴线位置
            // leftAxis: 25,
            // rightAxis: 35,
            // topAxis: 25,
            // bottomAxis: 35,
            // 显示校准弹窗
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

      // 如果已有校准数据，直接使用
      if (this.data.gridCellWidth > 0 && this.data.gridCellHeight > 0) {
        this.redrawCanvas();
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
    changeGridWidth(e) {
      const param = e.currentTarget.dataset.param;

      if (param == 'add') {
        console.log('接收到的参数:', typeof this.data.gridCellWidth)
        this.setData({
          gridCellWidth: this.data.gridCellWidth + 0.2

        }, this.redrawCanvas())
      } else {
        this.setData({
          gridCellWidth: this.data.gridCellWidth - 0.2
        }, this.redrawCanvas())
      }
    },
    changeGridHeight(e) {
      const param = e.currentTarget.dataset.param;
      console.log('接收到的参数:', param);
      if (param == 'add') {
        this.setData({
          gridCellHeight: this.data.gridCellHeight + 0.2
        }, this.redrawCanvas())
      } else {
        this.setData({
          gridCellHeight: this.data.gridCellHeight - 0.2
        }, this.redrawCanvas())
      }
    },
    movwXAxis(e) {
      const param = e.currentTarget.dataset.param;
      if (param === 'left') {
        this.setData({
          gridOffsetX: this.data.gridOffsetX - 1
        }, this.redrawCanvas())
      } else {
        this.setData({
          gridOffsetX: this.data.gridOffsetX + 1
        }, this.redrawCanvas())
      }
    },
    movwYAxis(e) {
      const param = e.currentTarget.dataset.param;
      if (param === 'down') {
        this.setData({
          gridOffsetY: this.data.gridOffsetY - 1
        }, this.redrawCanvas())
      } else {
        this.setData({
          gridOffsetY: this.data.gridOffsetY + 1
        }, this.redrawCanvas())
      }
    },
    // 移动网格位置
    onAxisChange(e) {
      if (!this.data.tempFilePath) return;
      const sliderValue = e.detail.value;
      const type = e.currentTarget.dataset.type;

      let dataToUpdate = {
        sliderValue: sliderValue
      };

      let prevValueKey = `prev${type.charAt(0).toUpperCase() + type.slice(1)}Value`;
      let prevValue = this.data[prevValueKey];
      let valueDiff = parseFloat((sliderValue - prevValue).toFixed(1));
      // let valueDiff = sliderValue - prevValue; // 计算滑块值的差值

      switch (type) {
        case 'left':
          dataToUpdate.leftValue = sliderValue - 20.0;

          dataToUpdate.gridCellWidth = this.data.gridCellWidth - valueDiff;
          // dataToUpdate.gridOffsetX = this.data.gridOffsetX - valueDiff;
          dataToUpdate.prevLeftValue = sliderValue; // 更新上一次的值
          break;
        case 'right':
          dataToUpdate.rightValue = sliderValue;
          dataToUpdate.gridCellWidth = (this.data.gridCellWidth + valueDiff);
          // dataToUpdate.gridOffsetX = this.data.gridOffsetX + valueDiff;
          dataToUpdate.prevRightValue = sliderValue; // 更新上一次的值
          break;
        case 'top':
          dataToUpdate.topValue = sliderValue;
          dataToUpdate.gridCellHeight = this.data.gridCellHeight + valueDiff;
          // dataToUpdate.gridOffsetY = this.data.gridOffsetY + valueDiff;
          dataToUpdate.prevTopValue = sliderValue; // 更新上一次的值
          break;
        case 'bottom':
          dataToUpdate.bottomValue = sliderValue;
          dataToUpdate.gridCellHeight = this.data.gridCellHeight - valueDiff;
          // dataToUpdate.gridOffsetY = this.data.gridOffsetY - valueDiff;
          dataToUpdate.prevBottomValue = sliderValue; // 更新上一次的值
          break;
        default:
          break;
      }
      console.log('xx', this.data.gridCellHeight, this.data.gridCellWidth)
      this.setData(dataToUpdate, () => {
        this.redrawCanvas();
      });
    },
    // onMainLeftAxisChange(e) {
    //   if (!this.data.tempFilePath) return;
    //   // this.setData({
    //   //   gridOffsetX: this.data.gridOffsetX - 1
    //   // }, this.redrawCanvas);
    //   const sliderValue = e.detail.value;
    //   // 将 slider 的值转换为以中间位置为 0 的正负数值
    //   const currentValue = sliderValue - 20;
    //   this.setData({
    //     sliderValue: sliderValue,
    //     leftValue: currentValue,
    //     gridCellWidth: this.data.gridCellWidth - (sliderValue - 20)
    //   }, this.redrawCanvas());
    // },

    // onMainRightAxisChange(e) {
    //   const sliderValue = e.detail.value;
    //   // 将 slider 的值转换为以中间位置为 0 的正负数值
    //   const currentValue = sliderValue - 20;
    //   this.setData({
    //     sliderValue: sliderValue,
    //     rightValue: currentValue,
    //     gridCellWidth: this.data.gridCellWidth + (sliderValue - 20)
    //   }, this.redrawCanvas());

    // },



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
      const cellWidth = (this.data.rightAxis - this.data.leftAxis).toFixed(1);
      const cellHeight = (this.data.bottomAxis - this.data.topAxis).toFixed(1);
      console.log('ff', cellWidth, cellHeight)
      // if (cellWidth <= 5.1 || cellHeight <= 5) {
      //   wx.showToast({
      //     title: '请框选更大的区域',
      //     icon: 'none'
      //   });
      //   return;
      // }

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
            console.log('dd', scaleX, scaleY)
            // 计算实际图片中单元格的像素尺寸
            const imgCellWidth = cellWidth * scaleX;
            const imgCellHeight = cellHeight * scaleY;

            // 计算画布的尺寸
            const query = wx.createSelectorQuery().in(this);
            query.select('.result-container').boundingClientRect((resultContainerRes) => {
              if (!resultContainerRes) {
                wx.showToast({ title: '无法获取容器尺寸', icon: 'none' });
                return;
              }

              const containerWidth = resultContainerRes.width;
              const calculatedCanvasHeight = containerWidth * (imgHeight / imgWidth);

              // 计算画布上的单元格尺寸
              const canvasCellWidth = (imgCellWidth / imgWidth) * containerWidth;
              const canvasCellHeight = (imgCellHeight / imgHeight) * calculatedCanvasHeight;

              // 设置数据并更新画布
              this.setData({
                imagePath: this.data.tempFilePath,
                canvasWidth: containerWidth,
                canvasHeight: calculatedCanvasHeight,
                gridCellWidth: cellWidth / 2,
                gridCellHeight: cellWidth / 2,

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
    startMoveAxis(e) {
      const axis = e.currentTarget.dataset.axis;
      this.setData({ isMovingAxis: axis });

    },

    // 停止移动轴线
    stopMoveAxis() {
      this.setData({ isMovingAxis: '' });
    },

    // 移动轴线
    moveAxis(e) {
      const { isMovingAxis } = this.data;
      if (!isMovingAxis) return;

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
        const data: any = {};

        if (isMovingAxis === 'left') {
          data.leftAxis = Math.min(clampedX, this.data.rightAxis - 10);
        } else if (isMovingAxis === 'right') {
          data.rightAxis = Math.max(clampedX, this.data.leftAxis + 10);
        } else if (isMovingAxis === 'top') {
          data.topAxis = Math.min(clampedY, this.data.bottomAxis - 10);
        } else if (isMovingAxis === 'bottom') {
          data.bottomAxis = Math.max(clampedY, this.data.topAxis + 10);
        }

        this.setData(data);
      }).exec();
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