const MAX_SIDE = 1600
const FORMAT_ERROR =
  'This image format is not supported. Please use a screenshot, or a JPEG or PNG photo.'

export async function prepareImage(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(FORMAT_ERROR)
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.88),
  )
  if (!blob) throw new Error('Could not process this image. Please try another one.')

  return new File([blob], 'upload.jpg', { type: 'image/jpeg' })
}