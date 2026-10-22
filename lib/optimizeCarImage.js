export const MAX_CAR_UPLOAD_BYTES = 192 * 1024

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* Safari/format fallback. */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally { URL.revokeObjectURL(url) }
}

export async function optimizeCarImage(file) {
  const image = await decodeImage(file)
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('ไม่สามารถย่อรูปได้ กรุณาเลือกไฟล์ JPG อื่น')
    for (const width of [1280, 960, 640]) {
      const scale = Math.min(1, width / Math.max(image.width, image.height))
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      for (const type of ['image/webp', 'image/jpeg']) {
        for (const quality of [0.74, 0.6, 0.46]) {
          context.fillStyle = '#fff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality))
          if (!blob || blob.type !== type || blob.size > MAX_CAR_UPLOAD_BYTES) continue
          const extension = type === 'image/webp' ? 'webp' : 'jpg'
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type, lastModified: Date.now() })
        }
      }
    }
    throw new Error('ย่อรูปไม่สำเร็จ กรุณาเลือกไฟล์ JPG อื่น ระบบจะไม่อัปโหลดรูปขนาดใหญ่โดยอัตโนมัติ')
  } finally { image.close?.() }
}
