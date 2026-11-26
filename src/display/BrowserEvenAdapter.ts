// ---------------------------------------------------------------------------
// BrowserEvenAdapter — drop-in replacement for the SDK EvenAppBridge when the
// page runs outside the Even App WebView (desktop dev / demo / CI).
//
// It renders the REAL container objects the app pushes (createStartUp /
// rebuild / textUpgrade / updateImageRawData) into a 576x288 "lens" DOM, and
// lets the companion UI synthesize the same OS events the firmware emits.
// ---------------------------------------------------------------------------

import { grey4ToImageData } from './sparkline'
import type { BridgeLike } from '../types'

interface TextDef {
  xPosition?: number
  yPosition?: number
  width?: number
  height?: number
  borderWidth?: number
  borderColor?: number
  borderRadius?: number
  paddingLength?: number
  containerID?: number
  containerName?: string
  isEventCapture?: number
  zOrderIndex?: number
  content?: string
  textColor?: number
}

interface ListDef extends Omit<TextDef, 'content'> {
  itemContainer?: { itemCount?: number; itemWidth?: number; itemName?: string[] }
}

interface ImageDef {
  xPosition?: number
  yPosition?: number
  width?: number
  height?: number
  containerID?: number
  containerName?: string
  zOrderIndex?: number
}

interface PageDef {
  containerTotalNum?: number
  listObject?: ListDef[]
  textObject?: TextDef[]
  imageObject?: ImageDef[]
  menuObject?: { menuItems?: Array<{ itemName?: string; itemID?: number }> }
}

type EvCallback = Parameters<BridgeLike['onEvenHubEvent']>[0]

const BRIGHTNESS_OPACITY = [0.35, 0.55, 0.72, 0.88, 1]

export class BrowserEvenAdapter implements BridgeLike {
  private lens: HTMLElement
  private listeners = new Set<EvCallback>()
  private page: PageDef | null = null
  private audioOpen = false
  private pcmTimer: ReturnType<typeof setInterval> | null = null
  private imageNodes = new Map<number, HTMLCanvasElement>()
  private menuItems: Array<{ itemName?: string; itemID?: number }> = []
  onPageChange: ((page: PageDef | null) => void) | null = null
  onAudioChange: ((open: boolean) => void) | null = null

  constructor(lens: HTMLElement) {
    this.lens = lens
  }

  get menu(): Array<{ itemName?: string; itemID?: number }> {
    return this.menuItems
  }

  private emit(evt: Parameters<EvCallback>[0]) {
    for (const cb of this.listeners) cb(evt)
  }

  /** Simulate a touch/ring/system event from the companion UI. */
  injectEvent(
    kind: 'text' | 'list' | 'sys' | 'menu',
    payload: {
      eventType?: number
      containerID?: number
      currentSelectItemIndex?: number
      eventSource?: number
      itemID?: number
    },
  ) {
    if (kind === 'text') this.emit({ textEvent: payload })
    else if (kind === 'list') this.emit({ listEvent: payload })
    else if (kind === 'sys') this.emit({ sysEvent: payload })
    else this.emit({ menuItemClickEvent: { itemID: payload.itemID } })
  }

  async createStartUpPageContainer(container: unknown): Promise<number> {
    this.page = container as PageDef
    this.menuItems = this.page.menuObject?.menuItems ?? []
    this.renderPage()
    return 0
  }

  async rebuildPageContainer(container: unknown): Promise<boolean> {
    this.page = container as PageDef
    this.menuItems = this.page.menuObject?.menuItems ?? []
    this.renderPage()
    return true
  }

  async textContainerUpgrade(container: {
    containerID: number
    containerName: string
    content?: string
    textColor?: number
  }): Promise<boolean> {
    const el = this.lens.querySelector<HTMLElement>(
      `[data-cid="${container.containerID}"]`,
    )
    if (el) {
      if (container.content !== undefined) {
        el.dataset.content = container.content
        el.textContent = container.content
      }
      if (container.textColor !== undefined) {
        el.style.opacity = String(BRIGHTNESS_OPACITY[container.textColor] ?? 1)
      }
    }
    const def = this.page?.textObject?.find(t => t.containerID === container.containerID)
    if (def && container.content !== undefined) def.content = container.content
    return true
  }

  async updateImageRawData(data: {
    containerID: number
    containerName: string
    imageData: number[] | Uint8Array | string | ArrayBuffer
  }): Promise<string> {
    const canvas = this.imageNodes.get(data.containerID)
    const def = this.page?.imageObject?.find(i => i.containerID === data.containerID)
    if (!canvas || !def) return 'imageException'
    const w = def.width ?? 128
    const h = def.height ?? 40
    let bytes: Uint8Array
    if (data.imageData instanceof Uint8Array) bytes = data.imageData
    else if (data.imageData instanceof ArrayBuffer) bytes = new Uint8Array(data.imageData)
    else if (Array.isArray(data.imageData)) bytes = Uint8Array.from(data.imageData)
    else if (typeof data.imageData === 'string') {
      try {
        const bin = atob(data.imageData)
        bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
      } catch {
        return 'imageException'
      }
    } else return 'imageException'

    const expected = (w * h) / 2
    if (bytes.length !== expected) {
      // Fallback: treat as RGBA-ish buffer of w*h (4-bit impossible); still draw best effort
      const img = new ImageData(w, h)
      for (let i = 0; i < Math.min(bytes.length, w * h); i++) {
        const v = bytes[i]
        const o = i * 4
        img.data[o] = v * 0.35
        img.data[o + 1] = v
        img.data[o + 2] = v * 0.45
        img.data[o + 3] = v > 8 ? 255 : 0
      }
      canvas.getContext('2d')?.putImageData(img, 0, 0)
      return 'success'
    }
    canvas.getContext('2d')?.putImageData(grey4ToImageData(bytes, w, h), 0, 0)
    return 'success'
  }

  async audioControl(isOpen: boolean, _source?: unknown): Promise<boolean> {
    this.audioOpen = isOpen
    this.onAudioChange?.(isOpen)
    if (isOpen) {
      // stream synthetic silent PCM frames so the app's audio path ticks
      this.pcmTimer = setInterval(() => {
        const pcm = new Uint8Array(640)
        for (let i = 0; i < 640; i++) pcm[i] = 128 + Math.round(30 * Math.sin(i / 8 + Date.now() / 90))
        this.emit({ audioEvent: { audioPcm: pcm, source: 'glasses' } })
      }, 40)
    } else if (this.pcmTimer) {
      clearInterval(this.pcmTimer)
      this.pcmTimer = null
    }
    return true
  }

  async shutDownPageContainer(exitMode?: number): Promise<boolean> {
    this.audioControl(false)
    this.lens.innerHTML = ''
    this.page = null
    this.menuItems = []
    if (exitMode === 1) {
      // system exit confirmation — simulated inline
      const dialog = document.createElement('div')
      dialog.className = 'g2-exit-dialog'
      dialog.innerHTML = '<div>Exit app?</div>'
      const yes = document.createElement('button')
      yes.textContent = 'Exit'
      const no = document.createElement('button')
      no.textContent = 'Cancel'
      dialog.appendChild(yes)
      dialog.appendChild(no)
      yes.onclick = () => {
        dialog.remove()
        this.emit({ sysEvent: { eventType: 7 } }) // SYSTEM_EXIT_EVENT
      }
      no.onclick = () => {
        dialog.remove()
      }
      this.lens.appendChild(dialog)
    } else {
      this.emit({ sysEvent: { eventType: 7 } })
    }
    return true
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    try {
      localStorage.setItem(`telepulse:${key}`, value)
      return true
    } catch {
      return false
    }
  }

  async getLocalStorage(key: string): Promise<string> {
    try {
      return localStorage.getItem(`telepulse:${key}`) ?? ''
    } catch {
      return ''
    }
  }

  onEvenHubEvent(callback: EvCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // -------------------------------------------------------------------------
  private renderPage() {
    const page = this.page
    if (!page) return
    this.lens.innerHTML = ''
    this.imageNodes.clear()

    type Node = { def: TextDef | ListDef | ImageDef; kind: 'text' | 'list' | 'image'; order: number }
    const nodes: Node[] = []
    page.textObject?.forEach((t, i) => nodes.push({ def: t, kind: 'text', order: i }))
    page.listObject?.forEach((l, i) => nodes.push({ def: l, kind: 'list', order: 100 + i }))
    page.imageObject?.forEach((im, i) => nodes.push({ def: im, kind: 'image', order: 200 + i }))

    const usesZ = nodes.some(n => (n.def as TextDef).zOrderIndex !== undefined)
    if (usesZ) {
      nodes.sort(
        (a, b) =>
          ((a.def as TextDef).zOrderIndex ?? a.order) - ((b.def as TextDef).zOrderIndex ?? b.order),
      )
    }

    for (const node of nodes) {
      const d = node.def
      const el = document.createElement('div')
      el.className = `g2-ct g2-${node.kind}`
      el.dataset.cid = String(d.containerID)
      el.dataset.name = String(d.containerName)
      el.style.left = `${(d.xPosition ?? 0) / 5.76}%`
      el.style.top = `${(d.yPosition ?? 0) / 2.88}%`
      el.style.width = `${(d.width ?? 0) / 5.76}%`
      el.style.height = `${(d.height ?? 0) / 2.88}%`
      const bw = (d as TextDef).borderWidth ?? 0
      if (bw > 0 && node.kind !== 'image') {
        const bc = ((d as TextDef).borderColor ?? 5) / 15
        el.style.border = `${Math.min(bw, 2)}px solid rgba(70,255,140,${0.25 + bc * 0.7})`
        el.style.borderRadius = `${(d as TextDef).borderRadius ?? 0}px`
        el.style.padding = `${((d as TextDef).paddingLength ?? 0) / 5.76}%`
      }
      if (node.kind === 'text') {
        el.textContent = (d as TextDef).content ?? ''
        el.dataset.content = (d as TextDef).content ?? ''
        const tc = (d as TextDef).textColor
        el.style.opacity = tc === undefined ? '1' : String(BRIGHTNESS_OPACITY[tc] ?? 1)
      } else if (node.kind === 'list') {
        const items = (d as ListDef).itemContainer?.itemName ?? []
        el.innerHTML = items.map((it, i) => `<div class="g2-list-item${i === 0 ? ' sel' : ''}">${it}</div>`).join('')
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = d.width ?? 128
        canvas.height = d.height ?? 40
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.imageRendering = 'pixelated'
        el.appendChild(canvas)
        this.imageNodes.set(d.containerID ?? 0, canvas)
      }
      if ((d as TextDef).isEventCapture === 1) el.dataset.capture = '1'
      this.lens.appendChild(el)
    }
    this.onPageChange?.(page)
  }
}
