import { useState } from 'react'
import { Info, Keyboard, Monitor, Palette, X } from 'lucide-react'
import type { AppSettings, HotkeySettings, ThemeMode } from '../../../shared/types'

export function SettingsModal({ settings, onChange, onClose }: { settings: AppSettings; onChange: (settings: AppSettings) => void; onClose: () => void }): React.JSX.Element {
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    const themeResult = await window.speechDesk.settings.updateTheme(draft.theme)
    if (!themeResult.ok || !themeResult.data) { setError(themeResult.error ?? '主题保存失败'); return }
    const prompterResult = await window.speechDesk.prompter.updateSettings(draft.prompter)
    if (!prompterResult.ok || !prompterResult.data) { setError(prompterResult.error ?? '提词窗设置保存失败'); return }
    const hotkeyResult = await window.speechDesk.hotkeys.update(draft.hotkeys)
    if (!hotkeyResult.ok || !hotkeyResult.data) { setError(hotkeyResult.error ?? '快捷键保存失败'); return }
    const next = { ...themeResult.data, prompter: prompterResult.data, hotkeys: hotkeyResult.data }
    onChange(next); onClose()
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">偏好设置</p><h2>设置</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
      <div className="settings-section">
        <h3><Palette />外观</h3>
        <label>应用主题<select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as ThemeMode })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
        <label>提词窗主题<select value={draft.prompter.theme} onChange={(event) => setDraft({ ...draft, prompter: { ...draft.prompter, theme: event.target.value as ThemeMode } })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
      </div>
      <div className="settings-section">
        <h3><Monitor />提词窗</h3>
        <Range label="字号" value={draft.prompter.fontScale} min={0.7} max={2.5} step={0.1} suffix="×" onChange={(value) => setDraft({ ...draft, prompter: { ...draft.prompter, fontScale: value } })} />
        <Range label="不透明度" value={draft.prompter.opacity} min={0.45} max={1} step={0.05} suffix="" onChange={(value) => setDraft({ ...draft, prompter: { ...draft.prompter, opacity: value } })} />
        <label className="check-row"><input type="checkbox" checked={draft.prompter.contentProtection} onChange={(event) => setDraft({ ...draft, prompter: { ...draft.prompter, contentProtection: event.target.checked } })} />尽力从屏幕捕获中隐藏</label>
        <label className="check-row"><input type="checkbox" checked={draft.prompter.clickThrough} onChange={(event) => setDraft({ ...draft, prompter: { ...draft.prompter, clickThrough: event.target.checked } })} />演讲开始后默认鼠标穿透</label>
      </div>
      <div className="settings-section hotkey-settings">
        <h3><Keyboard />全局快捷键</h3>
        {(Object.keys(draft.hotkeys) as Array<keyof HotkeySettings>).map((key) => <label key={key}>{hotkeyNames[key]}<input value={draft.hotkeys[key]} onChange={(event) => setDraft({ ...draft, hotkeys: { ...draft.hotkeys, [key]: event.target.value } })} /></label>)}
      </div>
      <div className="privacy-callout"><Info /><span>捕获保护依赖 Windows 和共享软件的实现。机密演讲仍建议共享单个应用窗口或使用双显示器。</span></div>
      {error && <div className="error-banner">{error}</div>}
      <footer><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => void save()}>保存设置</button></footer>
    </section>
  </div>
}

function Range({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }): React.JSX.Element {
  return <label>{label}<div className="range-control"><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><output>{Math.round(value * 100) / 100}{suffix}</output></div></label>
}

const hotkeyNames: Record<keyof HotkeySettings, string> = {
  next: '下一节点', previous: '上一节点', scrollUp: '向上滚动', scrollDown: '向下滚动', toggleVisibility: '显示/隐藏', toggleClickThrough: '锁定/解锁'
}
