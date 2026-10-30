/**
 * Иконки KudaClub: оранжевый квадрат #D85A30 и белая «K».
 * Без прозрачности (apple-touch и маски Android обрезают сами).
 */
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORANGE = [0xd8, 0x5a, 0x30, 255]
const WHITE = [255, 255, 255, 255]

function make(size) {
  const png = new PNG({ width: size, height: size })
  const [r, g, b, a] = ORANGE
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r
    png.data[i + 1] = g
    png.data[i + 2] = b
    png.data[i + 3] = a
  }
  return png
}

function setPx(png, x, y, color) {
  const { width, height, data } = png
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const i = (width * y + x) * 4
  data[i] = color[0]
  data[i + 1] = color[1]
  data[i + 2] = color[2]
  data[i + 3] = color[3]
}

function fillRect(png, x0, y0, x1, y1, color) {
  const xa = Math.max(0, Math.round(Math.min(x0, x1)))
  const xb = Math.min(png.width - 1, Math.round(Math.max(x0, x1)))
  const ya = Math.max(0, Math.round(Math.min(y0, y1)))
  const yb = Math.min(png.height - 1, Math.round(Math.max(y0, y1)))
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) setPx(png, x, y, color)
  }
}

function fillCircle(png, cx, cy, radius, color) {
  const r = Math.ceil(radius)
  const r2 = radius * radius
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r2) setPx(png, Math.round(cx + x), Math.round(cy + y), color)
    }
  }
}

function drawThickLine(png, x0, y0, x1, y1, width, color) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const steps = Math.ceil(len)
  const radius = width / 2
  for (let i = 0; i <= steps; i++) {
    fillCircle(png, x0 + (dx * i) / steps, y0 + (dy * i) / steps, radius, color)
  }
}

/** Геометрическая K, inset — доля поля с каждой стороны (0.2 обычная, 0.28 maskable). */
function drawK(png, inset) {
  const S = png.width
  const pad = S * inset
  const left = pad
  const right = S - pad * 0.92
  const top = pad
  const bot = S - pad
  const stemW = S * 0.2
  const armW = S * 0.16
  const join = left + stemW
  const mid = S / 2

  fillRect(png, left, top, join, bot, WHITE)
  drawThickLine(png, join - armW * 0.15, mid, right - armW * 0.35, top + armW * 0.35, armW, WHITE)
  drawThickLine(png, join - armW * 0.15, mid, right - armW * 0.35, bot - armW * 0.35, armW, WHITE)
}

function downscale(src, size) {
  const dst = new PNG({ width: size, height: size })
  const scale = src.width / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * scale)
      const y0 = Math.floor(y * scale)
      const x1 = Math.min(src.width, Math.ceil((x + 1) * scale))
      const y1 = Math.min(src.height, Math.ceil((y + 1) * scale))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (src.width * yy + xx) * 4
          r += src.data[i]
          g += src.data[i + 1]
          b += src.data[i + 2]
          n++
        }
      }
      const di = (size * y + x) * 4
      dst.data[di] = Math.round(r / n)
      dst.data[di + 1] = Math.round(g / n)
      dst.data[di + 2] = Math.round(b / n)
      dst.data[di + 3] = 255
    }
  }
  return dst
}

function writePng(path, png) {
  writeFileSync(path, PNG.sync.write(png))
}

function writeIco(path, png32) {
  const pngBuf = PNG.sync.write(png32)
  const header = Buffer.alloc(6 + 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(32, 6)
  header.writeUInt8(32, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuf.length, 14)
  header.writeUInt32LE(22, 18)
  writeFileSync(path, Buffer.concat([header, pngBuf]))
}

const master = make(512)
drawK(master, 0.2)
const maskable = make(512)
drawK(maskable, 0.28)

const icon512 = master
const icon192 = downscale(master, 192)
const icon96 = downscale(master, 96)
const icon32 = downscale(master, 32)
const apple = downscale(master, 180)
const m512 = maskable
const m192 = downscale(maskable, 192)

const icons = join(ROOT, 'public/icons')
writePng(join(icons, 'icon-512.png'), icon512)
writePng(join(icons, 'icon-192.png'), icon192)
writePng(join(icons, 'icon-96.png'), icon96)
writePng(join(icons, 'icon-512-maskable.png'), m512)
writePng(join(icons, 'icon-192-maskable.png'), m192)
writePng(join(icons, 'apple-touch-icon.png'), apple)
writePng(join(ROOT, 'public/apple-touch-icon.png'), apple)
writeIco(join(ROOT, 'public/favicon.ico'), icon32)
writePng(join(ROOT, 'src/app/icon.png'), icon32)
writePng(join(ROOT, 'src/app/apple-icon.png'), apple)

console.log('icons written: 512/192/96, maskable, apple-touch 180, favicon.ico, app/icon.png')
