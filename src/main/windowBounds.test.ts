import { describe, expect, it } from 'vitest'
import { fitBoundsToWorkArea } from './windowBounds'

describe('fitBoundsToWorkArea', () => {
  const workArea = { x: 0, y: 0, width: 1707, height: 1019 }

  it('moves a previously saved off-screen prompter window back into view', () => {
    expect(fitBoundsToWorkArea(
      { x: 563, y: 1093, width: 1100, height: 286 },
      workArea
    )).toEqual({ x: 563, y: 733, width: 1100, height: 286 })
  })

  it('preserves bounds that already fit in the current work area', () => {
    const bounds = { x: 320, y: 700, width: 900, height: 240 }
    expect(fitBoundsToWorkArea(bounds, workArea)).toEqual(bounds)
  })

  it('fits oversized saved bounds within a smaller current work area', () => {
    expect(fitBoundsToWorkArea(
      { x: -1920, y: 0, width: 1920, height: 1080 },
      workArea
    )).toEqual(workArea)
  })
})
