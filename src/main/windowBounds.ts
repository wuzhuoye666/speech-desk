export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowBounds extends WorkArea {}

/** Keep restored window bounds visible after a display/layout change. */
export function fitBoundsToWorkArea(bounds: WindowBounds, workArea: WorkArea): WindowBounds {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height
  return {
    width,
    height,
    x: Math.max(workArea.x, Math.min(bounds.x, maxX)),
    y: Math.max(workArea.y, Math.min(bounds.y, maxY))
  }
}
