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
    gridSize: 20,
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

  // 初始化并绘制 Canvas
  initializeAndDrawCanvas() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#previewCanvas').fields({ node: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) {
            console.error('Canvas 节点获取失败:', res);
            // 此时 canvas 应该已存在，如果失败可能是其他问题
            wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
            return;
        }
        const canvas = res[0].node as Canvas; // 类型断言
        const ctx = canvas.getContext('2d') as RenderingContext; // 类型断言
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const { canvasWidth, canvasHeight } = this.data;

        // 设置 Canvas 物理尺寸
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);

        // 开始绘制
        this.drawImageAndGrid(canvas, ctx, canvasWidth, canvasHeight);
    });
  },

  // 绘制图片和网格 - 添加类型
  drawImageAndGrid(canvas: Canvas, ctx: RenderingContext, width: number, height: number) {
    const img = canvas.createImage();
    img.src = this.data.imagePath;
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      this.drawGridLines(ctx, width, height);
      this.addNumbersToGrid(ctx, width, height);
    };
    img.onerror = (err: any) => { // 添加错误处理类型
        console.error("图片加载失败:", err);
        wx.showToast({ title: '图片加载失败', icon: 'none'});
    };
  },

  // 绘制网格线 - 添加类型
  drawGridLines(ctx: RenderingContext, width: number, height: number) {
    const { gridSize } = this.data;
    if (gridSize <= 0) return; // 防止 gridSize 非法导致死循环

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 1; // 在高清屏上 1px 可能较粗，可考虑 1 / dpr

    // 垂直网格线
    for (let x = gridSize; x < width; x += gridSize) { // 从 gridSize 开始，避免绘制边缘线
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // 水平网格线
    for (let y = gridSize; y < height; y += gridSize) { // 从 gridSize 开始
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  },

  // 添加网格编号 - 添加类型
  addNumbersToGrid(ctx: RenderingContext, width: number, height: number) {
    const { gridSize } = this.data;
    if (gridSize <= 0) return;

    let number = 1;
    // 字体大小稍微调整，避免太大或太小
    const fontSize = Math.max(8, Math.min(gridSize * 0.4, 16)); // 限制字体大小范围
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; // 黑色编号

    // 计算需要多少行多少列
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);


    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * gridSize;
        const y = row * gridSize;
        ctx.fillText(
          number.toString(),
          x + gridSize / 2, // 文字居中于格子
          y + gridSize / 2
        );
        number++;
      }
    }
  }
});