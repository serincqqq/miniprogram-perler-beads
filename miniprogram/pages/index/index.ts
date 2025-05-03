Page({
  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    gridSize: 20,
    imagePath: ''
  },

  // 在页面渲染完成后初始化 Canvas（可选）
  onReady() {
    this.initCanvas();
  },

  // 初始化 Canvas 逻辑
  initCanvas() {
    const query = wx.createSelectorQuery(); // 页面环境直接使用

    // query.select('#previewCanvas').fields({ node: true, size: true }).exec((res) => {
    //   if (!res || !res[0] || !res[0].node) {
    //     console.error('Canvas 节点获取失败:', res);
    //     wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
    //     return;
    //   }
    //   const canvas = res[0].node;
    //   const ctx = canvas.getContext('2d');
    //   console.log('gg', ctx)
    // })

    query.select('#previewCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.error('Canvas 节点获取失败:', res);
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const { width, height } = res[0];

      // 设置 Canvas 物理尺寸
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 存储逻辑尺寸
      this.setData({
        canvasWidth: width,
        canvasHeight: height
      });

      // 如果已有图片，重新绘制
      if (this.data.imagePath) {
        this.drawImageAndGrid(canvas, ctx, width, height);
      }
    });
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ imagePath: tempFilePath }, () => {
          console.log('ff', tempFilePath)
          this.initCanvas(); // 确保在 setData 回调中操作
        });
      },
      fail: console.error
    });
  },

  // 绘制图片和网格
  drawImageAndGrid(canvas, ctx, width, height) {
    const img = canvas.createImage();
    img.src = this.data.imagePath;
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      this.drawGridLines(ctx, width, height);
      this.addNumbersToGrid(ctx, width, height);
    };
    img.onerror = console.error;
  },

  // 绘制网格线（优化版）
  drawGridLines(ctx, width, height) {
    const { gridSize } = this.data;
    ctx.beginPath();
    // 垂直网格线
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // 水平网格线
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // 添加网格编号（优化版）
  addNumbersToGrid(ctx, width, height) {
    const { gridSize } = this.data;
    let number = 1;
    ctx.font = `${gridSize / 2}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        ctx.fillText(
          number.toString(),
          x + gridSize / 2,
          y + gridSize / 2
        );
        number++;
      }
    }
  }
});