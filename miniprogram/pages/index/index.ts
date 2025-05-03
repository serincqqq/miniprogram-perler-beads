// 尝试导入类型，如果找不到，可以使用 any
// import { Canvas, RenderingContext } from 'wechat-miniprogram/canvas';
type Canvas = any; // 替换为正确导入的类型，或使用 any
type RenderingContext = any; // 替换为正确导入的类型，或使用 any

Page({
  data: {
    // 初始化 imagePath 为空
    imagePath: '',
    canvasWidth: 0, // 初始宽度为 0
    canvasHeight: 0, // 初始高度为 0
    // --- 恢复使用用户输入的格子数 ---
    confirmedGridSize: 32, // 提供一个更合理的像素画默认值
    gridSize: 24,         // 临时输入值
  },

  // --- 恢复 onGridSizeInput 和 confirmGridSize ---
  onGridSizeInput(e: WechatMiniprogram.Input) {
    let value = parseInt(e.detail.value, 10);
    if (isNaN(value)) {
      value = this.data.confirmedGridSize;
    } else if (value < 1) {
      value = 1;
    } else if (value > 200) { // 可以根据需要调整上限
      value = 200;
    }
    this.setData({ gridSize: value });
    return value.toString();
  },

  // 确认格子数后，如果已有图片则重绘
  confirmGridSize() {
    this.setData({ confirmedGridSize: this.data.gridSize }, () => {
      if (this.data.imagePath) { // 仅在有图时重绘
        wx.nextTick(() => {
          this.initializeAndDrawCanvas(); // 使用新的 confirmedGridSize 重新绘制
        });
      }
      wx.showToast({ title: '格子数已确认', icon: 'success', duration: 1000 });
    });
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        // 1. 获取图片信息
        wx.getImageInfo({
          src: tempFilePath,
          success: (imgRes) => {
            const imgWidth = imgRes.width;
            const imgHeight = imgRes.height;

            // 2. 获取容器宽度
            const query = wx.createSelectorQuery().in(this); // 在 Page 中使用 .in(this) 或省略
            query.select('.result-container').boundingClientRect((containerRes) => {
              if (!containerRes) {
                wx.showToast({ title: '无法获取容器尺寸', icon: 'none' });
                return;
              }
              const containerWidth = containerRes.width;

              // 3. 计算画布高度以保持比例
              const calculatedCanvasHeight = containerWidth * (imgHeight / imgWidth);

              // 4. 更新数据，触发 WXML 渲染 Canvas
              this.setData({
                imagePath: tempFilePath,
                canvasWidth: containerWidth, // 画布逻辑宽度等于容器宽度
                canvasHeight: calculatedCanvasHeight // 计算得到的高度
              }, () => {
                // 5. 在 WXML 更新后，初始化并绘制 Canvas
                wx.nextTick(() => {
                  // 调用初始化绘制，使用 data 中当前的 confirmedGridSize
                  this.initializeAndDrawCanvas();
                });
              });

            }).exec(); // 执行查询
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

  // 初始化并绘制 Canvas (核心修改)
  initializeAndDrawCanvas() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#previewCanvas').fields({ node: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.error('Canvas 节点获取失败:', res);
        // 此时 canvas 应该已存在，如果失败可能是其他问题
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      const canvas = res[0].node as Canvas;
      const ctx = canvas.getContext('2d') as RenderingContext;
      const dpr = wx.getSystemInfoSync().pixelRatio;
      // --- 获取用户确认的格子数 ---
      const { canvasWidth, canvasHeight, imagePath, confirmedGridSize } = this.data;

      if (!imagePath || confirmedGridSize <= 0) {
        console.error("无法绘制：图片路径为空或确认的格子数无效");
        return;
      }

      // --- 关键：禁用图像平滑 ---
      ctx.imageSmoothingEnabled = false;

      // 设置 Canvas 物理尺寸
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      ctx.scale(dpr, dpr);

      // --- 获取图片的原始宽高比，用于计算垂直格子数 ---
      wx.getImageInfo({
        src: imagePath,
        success: (imgRes) => {
          const imgWidth = imgRes.width;
          const imgHeight = imgRes.height;

          if (imgWidth <= 0 || imgHeight <= 0) {
            console.error("图片原始尺寸无效:", imgWidth, imgHeight);
            wx.showToast({ title: '图片尺寸无效', icon: 'none' });
            return;
          }

          // --- 计算格子尺寸基于 confirmedGridSize ---
          const gridPixelWidth = canvasWidth / confirmedGridSize;
          // 计算垂直方向应有的格子数 (保持图片比例)
          const numVerticalGrids = confirmedGridSize * (imgHeight / imgWidth);
          // 计算垂直格子高度
          const gridPixelHeight = canvasHeight / numVerticalGrids;

          console.log(`Using confirmedGridSize=${confirmedGridSize}`);
          console.log(`Calculated Grid Size: gridW=${gridPixelWidth.toFixed(2)}, gridH=${gridPixelHeight.toFixed(2)}`);
          console.log(`Calculated Vertical Grids: ${numVerticalGrids.toFixed(2)}`);

          // 先绘制图片
          this.drawImage(canvas, ctx, canvasWidth, canvasHeight, () => {
            console.log('drawImage callback executed. Drawing grid and numbers based on user grid size.');
            // 使用计算出的格子尺寸和行列数绘制
            // 注意：行列数现在是 confirmedGridSize 和 numVerticalGrids
            this.drawGridLines(ctx, canvasWidth, canvasHeight, gridPixelWidth, gridPixelHeight, confirmedGridSize, numVerticalGrids);
            // this.addNumbersToGrid(ctx, canvasWidth, canvasHeight, gridPixelWidth, gridPixelHeight, confirmedGridSize, numVerticalGrids);
          });
        },
        fail: (err) => {
          console.error("获取图片信息失败，无法绘制精确网格:", err);
          wx.showToast({ title: '无法读取图片尺寸', icon: 'none' });
          this.drawImage(canvas, ctx, canvasWidth, canvasHeight); // 仍尝试绘制图片
        }
      });
    });
  },

  // 绘制图片 (添加平滑禁用)
  drawImage(canvas: Canvas, ctx: RenderingContext, width: number, height: number, callback?: () => void) {
    const img = canvas.createImage();
    img.src = this.data.imagePath;
    img.onload = () => {
      // console.log("drawImage: img.onload triggered.");
      ctx.clearRect(0, 0, width, height);
      // --- 再次确保绘制图片时禁用平滑 ---
      const currentSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false; // 禁用
      ctx.drawImage(img, 0, 0, width, height);
      ctx.imageSmoothingEnabled = currentSmoothing; // 恢复

      if (callback) {
        // console.log("drawImage: Executing callback...");
        callback();
      }
    };
    img.onerror = (err: any) => {
      console.error("图片加载失败:", err);
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    };
  },

  // 绘制网格线 (接收格子宽高和计算出的行列数)
  // 注意：传入的 numCols 和 numRows 可能不是整数
  drawGridLines(ctx: RenderingContext, width: number, height: number, gridW: number, gridH: number, numCols: number, numRows: number) {
    // console.log(`Entering drawGridLines: gridW=${gridW.toFixed(2)}, gridH=${gridH.toFixed(2)}, cols=${numCols.toFixed(2)}, rows=${numRows.toFixed(2)}`);
    // 调整判断条件，因为现在 gridW/gridH 可能较大
    if (gridW < 0.5 || gridH < 0.5) { // 可以设置一个更小的阈值，比如 0.5 像素
      console.warn("drawGridLines: Calculated grid dimensions too small, skipping.", gridW, gridH);
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 0, 0,1)';
    const dpr = wx.getSystemInfoSync().pixelRatio || 1;
    ctx.lineWidth = 1 / dpr;

    // 绘制垂直线，使用 Math.ceil 确保覆盖边缘
    const colsToDraw = Math.ceil(numCols);
    for (let i = 1; i < colsToDraw; i++) { // 画内部线
      const x = i * gridW;
      if (x <= width) { // 避免超出画布
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    // 绘制水平线
    const rowsToDraw = Math.ceil(numRows);
    for (let i = 1; i < rowsToDraw; i++) { // 画内部线
      const y = i * gridH;
      if (y <= height) { // 避免超出画布
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
    }
    ctx.stroke();
  },

  // 添加网格编号 (接收格子宽高和计算出的行列数)
  // 注意：传入的 numCols 和 numRows 可能不是整数
  addNumbersToGrid(ctx: RenderingContext, width: number, height: number, gridW: number, gridH: number, numCols: number, numRows: number) {
    // console.log(`Entering addNumbersToGrid: gridW=${gridW.toFixed(2)}, gridH=${gridH.toFixed(2)}, cols=${numCols.toFixed(2)}, rows=${numRows.toFixed(2)}`);
    // 调整判断条件
    if (gridW < 4 || gridH < 4) { // 格子太小不方便显示数字
      console.warn("addNumbersToGrid: Grid dimensions too small for numbers, skipping.", gridW, gridH);
      return;
    }

    let number = 1;
    const fontSize = Math.max(6, Math.min(gridW * 0.3, gridH * 0.3, 10));
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';

    // 使用 Math.floor 确保只在完整的格子里绘制编号
    const colsToNumber = Math.floor(numCols);
    const rowsToNumber = Math.floor(numRows);

    for (let row = 0; row < rowsToNumber; row++) {
      for (let col = 0; col < colsToNumber; col++) {
        const x = col * gridW;
        const y = row * gridH;
        ctx.fillText(
          number.toString(),
          x + gridW / 2,
          y + gridH / 2
        );
        number++;
      }
    }
    // console.log("addNumbersToGrid: Finished drawing numbers.");
  }
});