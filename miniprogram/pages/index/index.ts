Page({
  data: {
    imagePath: '/static/test.jpg', // 默认图片路径
    scale: 100,     // 当前缩放比例（100%=原始尺寸）
    gridSize: 10,   // 网格大小（像素）
    minScale: 50,   // 最小缩放比例
    maxScale: 200,   // 最大缩放比例
    offsetX: 0,       // X轴位移（px）
    offsetY: 0,       // Y轴位移（px）
    moveStep: 3   // 每次移动步长（px）
  },

  // 放大图片
  zoomIn() {
    if (this.data.scale >= this.data.maxScale) return;
    this.setData({ scale: this.data.scale + 5 });
    this.updateGridInfo();
  },

  // 缩小图片
  zoomOut() {
    if (this.data.scale <= this.data.minScale) return;
    this.setData({ scale: this.data.scale - 5 });
    this.updateGridInfo();
  },
  moveImage(e) {
    const direction = e.currentTarget.dataset.direction;
    let { offsetX, offsetY, moveStep } = this.data;

    switch (direction) {
      case 'up':
        offsetY -= moveStep;
        break;
      case 'down':
        offsetY += moveStep;
        break;
      case 'left':
        offsetX -= moveStep;
        break;
      case 'right':
        offsetX += moveStep;
        break;
    }

    this.setData({ offsetX, offsetY });
  },

  // 更新网格物理尺寸信息
  updateGridInfo() {
    // 计算每个网格对应的实际尺寸（示例：假设屏幕DPI为96）
    const pxPerInch = 96;
    const inchPerGrid = (this.data.gridSize * (this.data.scale / 100)) / pxPerInch;
    const mmPerGrid = inchPerGrid * 25.4; // 转换为毫米

    // 可以在这里更新显示信息（需额外添加显示元素）
    console.log(`当前每个格子≈${mmPerGrid.toFixed(1)}mm`);
  },

  // 图片选择（可选）
  chooseImage() {
    wx.chooseImage({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => this.setData({ imagePath: res.tempFilePaths[0] })
    });
  }
});