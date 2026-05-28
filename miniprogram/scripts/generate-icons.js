/**
 * 生成 Tab 栏图标脚本
 *
 * 使用方法：
 *   cd miniprogram/scripts
 *   npm install pngjs  (仅首次需要)
 *   node generate-icons.js
 *
 * 本脚本使用 pngjs 生成 81x81 像素的简约深色主题图标。
 * 未选中色: #8888aa  选中色: #4ecdc4
 * 如需更精美的图标，请替换 images/ 下的文件即可。
 */

const fs = require('fs')
const path = require('path')

// ========== PNG 编码器（纯 Node.js，零依赖） ==========

function crc32(buf) {
  // CRC32 查找表
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1)
      else c = c >>> 1
    }
    table[i] = c
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcData = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([len, typeBytes, data, crcVal])
}

/**
 * 将 RGBA 像素数据编码为 PNG Buffer
 * @param {number} width 图像宽度
 * @param {number} height 图像高度
 * @param {Buffer} rgba 像素数据 (RGBA, 每像素4字节)
 * @returns {Buffer} PNG 文件数据
 */
function encodePNG(width, height, rgba) {
  const zlib = require('zlib')

  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // 位深度
  ihdr[9] = 6   // 颜色类型: RGBA
  ihdr[10] = 0  // 压缩方法
  ihdr[11] = 0  // 过滤方法
  ihdr[12] = 0  // 隔行扫描

  // 添加每行过滤字节 (filter type 0 = None)
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4)
    raw[rowOffset] = 0  // filter type = None
    rgba.copy(raw, rowOffset + 1, y * width * 4, (y + 1) * width * 4)
  }

  // 压缩
  const compressed = zlib.deflateSync(raw)

  // 组装 PNG
  const chunks = [
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]

  return Buffer.concat(chunks)
}

// ========== 绘图辅助 ==========

const SIZE = 81

/**
 * 解析十六进制颜色为 [R, G, B]
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/**
 * 创建指定大小的透明画布
 */
function createCanvas() {
  return new Uint8Array(SIZE * SIZE * 4)
}

/**
 * 设置像素点
 */
function setPixel(canvas, x, y, r, g, b, a) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const idx = (y * SIZE + x) * 4
  canvas[idx] = r
  canvas[idx + 1] = g
  canvas[idx + 2] = b
  canvas[idx + 3] = a
}

/**
 * 画圆形（填充）
 */
function fillCircle(canvas, cx, cy, radius, r, g, b, a) {
  const rr = Math.max(1, radius)
  for (let y = cy - rr; y <= cy + rr; y++) {
    for (let x = cx - rr; x <= cx + rr; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= rr) {
        setPixel(canvas, x, y, r, g, b, a)
      }
    }
  }
}

/**
 * 画空心圆
 */
function strokeCircle(canvas, cx, cy, radius, thickness, r, g, b, a) {
  const outerR = Math.max(1, radius)
  const innerR = Math.max(0, radius - thickness)
  for (let y = cy - outerR; y <= cy + outerR; y++) {
    for (let x = cx - outerR; x <= cx + outerR; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= outerR && dist >= innerR) {
        setPixel(canvas, x, y, r, g, b, a)
      }
    }
  }
}

/**
 * 画填充矩形
 */
function fillRect(canvas, x, y, w, h, r, g, b, a) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(canvas, x + dx, y + dy, r, g, b, a)
    }
  }
}

/**
 * 画圆角矩形
 */
function fillRoundRect(canvas, x, y, w, h, radius, r, g, b, a) {
  const rr = Math.min(radius, w / 2, h / 2)
  // 中间矩形
  fillRect(canvas, x + rr, y, w - 2 * rr, h, r, g, b, a)
  // 左右矩形
  fillRect(canvas, x, y + rr, rr, h - 2 * rr, r, g, b, a)
  fillRect(canvas, x + w - rr, y + rr, rr, h - 2 * rr, r, g, b, a)
  // 四个圆角
  fillCircle(canvas, x + rr, y + rr, rr, r, g, b, a)
  fillCircle(canvas, x + w - rr, y + rr, rr, r, g, b, a)
  fillCircle(canvas, x + rr, y + h - rr, rr, r, g, b, a)
  fillCircle(canvas, x + w - rr, y + h - rr, rr, r, g, b, a)
}

/**
 * 画线段 (Bresenham)
 */
function drawLine(canvas, x0, y0, x1, y1, thickness, r, g, b, a) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let cx = x0, cy = y0

  while (true) {
    // 画粗线
    const ht = Math.floor(thickness / 2)
    fillRect(canvas, cx - ht, cy - ht, thickness, thickness, r, g, b, a)

    if (cx === x1 && cy === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; cx += sx }
    if (e2 < dx) { err += dx; cy += sy }
  }
}

// ========== 图标绘制函数 ==========

const INACTIVE_COLOR = hexToRgb('#8888aa')
const ACTIVE_COLOR = hexToRgb('#4ecdc4')

/**
 * 首页图标 - 房子形状
 */
function drawHomeIcon(color) {
  const [r, g, b] = color
  const canvas = createCanvas()
  const cx = 40, cy = 40

  // 屋顶（三角形）
  for (let y = 14; y <= 36; y++) {
    const progress = (y - 14) / (36 - 14)
    const halfWidth = progress * 24
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      setPixel(canvas, x, y, r, g, b, 255)
    }
  }

  // 房子主体（矩形）
  fillRect(canvas, cx - 16, 36, 32, 26, r, g, b, 255)

  // 门（镂空效果 - 用深色覆盖）
  fillRoundRect(canvas, cx - 5, 46, 10, 16, 2, 15, 15, 26, 255)

  return Buffer.from(canvas)
}

/**
 * 呼吸/急救图标 - 呼吸圈
 */
function drawBreatheIcon(color) {
  const [r, g, b] = color
  const canvas = createCanvas()
  const cx = 40, cy = 40

  // 外圈
  strokeCircle(canvas, cx, cy, 28, 4, r, g, b, 255)

  // 内圈（呼吸圆 - 扩张状态）
  strokeCircle(canvas, cx, cy, 17, 3, r, g, b, 200)

  // 中心小点
  fillCircle(canvas, cx, cy, 5, r, g, b, 255)

  return Buffer.from(canvas)
}

/**
 * 健康图标 - 心形 + 脉搏线
 */
function drawHealthIcon(color) {
  const [r, g, b] = color
  const canvas = createCanvas()
  const cx = 40, cy = 36

  // 心形（简化版本 - 用圆和三角形组合）
  // 左半圆
  fillCircle(canvas, cx - 9, cy - 4, 12, r, g, b, 255)
  // 右半圆
  fillCircle(canvas, cx + 9, cy - 4, 12, r, g, b, 255)
  // 下三角填充
  for (let y = cy; y <= cy + 22; y++) {
    const progress = (y - cy) / 22
    const halfWidth = (1 - progress) * 20
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      setPixel(canvas, x, y, r, g, b, 255)
    }
  }

  // 脉搏线（心电图样式）
  const lineY = cy - 4
  drawLine(canvas, 14, lineY, 28, lineY, 2, 15, 15, 26, 255)
  drawLine(canvas, 28, lineY, 32, lineY - 8, 2, 15, 15, 26, 255)
  drawLine(canvas, 32, lineY - 8, 36, lineY + 10, 2, 15, 15, 26, 255)
  drawLine(canvas, 36, lineY + 10, 40, lineY - 3, 2, 15, 15, 26, 255)
  drawLine(canvas, 40, lineY - 3, 48, lineY, 2, 15, 15, 26, 255)
  drawLine(canvas, 48, lineY, 68, lineY, 2, 15, 15, 26, 255)

  return Buffer.from(canvas)
}

/**
 * 个人中心图标 - 头像轮廓
 */
function drawProfileIcon(color) {
  const [r, g, b] = color
  const canvas = createCanvas()
  const cx = 40

  // 头部（圆）
  fillCircle(canvas, cx, 24, 11, r, g, b, 255)

  // 身体（半圆/弧形）
  for (let y = 44; y <= 68; y++) {
    const progress = (y - 44) / (68 - 44)
    const halfWidth = Math.sqrt(1 - progress * progress * 0.3) * 24
    for (let x = cx - halfWidth; x <= cx + halfWidth; x++) {
      setPixel(canvas, x, y, r, g, b, 255)
    }
  }

  return Buffer.from(canvas)
}

// ========== 主流程 ==========

const OUTPUT_DIR = path.resolve(__dirname, '../images')

const icons = [
  { name: 'tab-home.png', draw: () => drawHomeIcon(INACTIVE_COLOR) },
  { name: 'tab-home-active.png', draw: () => drawHomeIcon(ACTIVE_COLOR) },
  { name: 'tab-breathe.png', draw: () => drawBreatheIcon(INACTIVE_COLOR) },
  { name: 'tab-breathe-active.png', draw: () => drawBreatheIcon(ACTIVE_COLOR) },
  { name: 'tab-health.png', draw: () => drawHealthIcon(INACTIVE_COLOR) },
  { name: 'tab-health-active.png', draw: () => drawHealthIcon(ACTIVE_COLOR) },
  { name: 'tab-profile.png', draw: () => drawProfileIcon(INACTIVE_COLOR) },
  { name: 'tab-profile-active.png', draw: () => drawProfileIcon(ACTIVE_COLOR) },
]

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

console.log('🎨 开始生成 Tab 栏图标...')
console.log(`📁 输出目录: ${OUTPUT_DIR}`)
console.log(`📐 尺寸: ${SIZE}x${SIZE} px`)
console.log('')

for (const icon of icons) {
  const rgba = icon.draw()
  const png = encodePNG(SIZE, SIZE, rgba)
  const filePath = path.join(OUTPUT_DIR, icon.name)
  fs.writeFileSync(filePath, png)
  console.log(`  ✅ ${icon.name} (${png.length} bytes)`)
}

console.log('')
console.log('🎉 所有图标生成完成！')
console.log('💡 如需更精美的图标，可直接替换 images/ 下的 PNG 文件。')
