'use client'

import { useEffect, useRef } from 'react'
import { BarcodeFormat, QRCodeWriter } from '@zxing/library'
import { Icon } from '@iconify/react'

const LABEL_PIXELS = 827 // 7 ซม. ที่ 300 DPI โดยประมาณ
const QR_PIXELS = 610

function drawQrCode(canvas, value, size) {
  const matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, size, size, new Map())
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = false
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.fillStyle = '#000000'
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix.get(x, y)) context.fillRect(x, y, 1, 1)
    }
  }
}

export default function CarQrLabel({ car, onClose }) {
  const qrCanvasRef = useRef(null)
  const qrPath = `/?car_id=${car?.id || ''}`

  useEffect(() => {
    if (!car) return
    const url = `${window.location.origin}${qrPath}`
    drawQrCode(qrCanvasRef.current, url, QR_PIXELS)
  }, [car, qrPath])

  if (!car) return null

  const downloadLabel = () => {
    const canvas = document.createElement('canvas')
    canvas.width = LABEL_PIXELS
    canvas.height = LABEL_PIXELS
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, LABEL_PIXELS, LABEL_PIXELS)
    context.strokeStyle = '#111111'
    context.lineWidth = 5
    context.strokeRect(3, 3, LABEL_PIXELS - 6, LABEL_PIXELS - 6)

    context.fillStyle = '#111111'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '700 52px Arial, sans-serif'
    context.fillText(car.plate_number, LABEL_PIXELS / 2, 68)
    context.drawImage(qrCanvasRef.current, 108, 108, QR_PIXELS, QR_PIXELS)
    context.font = '700 34px Arial, sans-serif'
    context.fillText('สแกนเพื่อนำรถออก/คืนรถ', LABEL_PIXELS / 2, 770)

    const link = document.createElement('a')
    link.download = `QR-${String(car.plate_number).replace(/[^\p{L}\p{N}-]+/gu, '_')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <style jsx global>{`
        @media print {
          @page { size: 7cm 7cm; margin: 0; }
          body * { visibility: hidden !important; }
          .car-qr-print-area, .car-qr-print-area * { visibility: visible !important; }
          .car-qr-print-area { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: white !important; }
          .car-qr-label { width: 7cm !important; height: 7cm !important; border: 0.4mm solid #111 !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="w-full max-w-[520px] rounded-[26px] bg-[#f8f3fa] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-[19px] font-bold text-[#4b1560]">QR ประจำรถ</h2><p className="text-[11px] text-[#765c7c]">ป้ายพิมพ์จริงขนาด 7 × 7 ซม.</p></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eadfed] text-[#702082]" aria-label="ปิด"><Icon icon="ph:x-bold" width="16" height="16" /></button>
        </div>

        <div className="car-qr-print-area flex justify-center rounded-[20px] bg-white p-4">
          <div className="car-qr-label flex h-[7cm] w-[7cm] flex-col items-center justify-between border-[1.5px] border-black bg-white px-[0.18cm] py-[0.12cm] text-black shadow-[0_8px_30px_rgba(0,0,0,.12)]">
            <p className="w-full truncate text-center text-[16px] font-bold leading-tight">{car.plate_number}</p>
            <canvas ref={qrCanvasRef} className="h-[5.45cm] w-[5.45cm]" aria-label={`QR Code รถ ${car.plate_number}`} />
            <p className="text-center text-[12px] font-bold leading-tight">สแกนเพื่อนำรถออก/คืนรถ</p>
          </div>
        </div>

        <p className="mt-3 break-all rounded-[12px] bg-white px-3 py-2 text-[10px] text-[#765c7c]">QR จะเปิดหน้า {qrPath} บนโดเมนที่ใช้งานอยู่</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={downloadLabel} className="flex items-center justify-center gap-2 rounded-[14px] bg-[#f1e6f4] py-3 text-[13px] font-bold text-[#702082]"><Icon icon="ph:download-simple-bold" width="18" height="18" />ดาวน์โหลด PNG</button>
          <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-[14px] bg-[#702082] py-3 text-[13px] font-bold text-white"><Icon icon="ph:printer-bold" width="18" height="18" />พิมพ์ 7 × 7 ซม.</button>
        </div>
      </div>
    </div>
  )
}
