export function guessUTMZone(lat, lon) {
    return parseInt(((lon+180)/6)%60)+1
}

export function guessUTMProj4(lat, lon) {
    return `+proj=utm +zone=${guessUTMZone(lat, lon)} +datum=WGS84 +units=m +no_defs`
}

export function getMinMax2D(data, keyX = 'x', keyY = 'y') {
    const minX = Math.min(...data.map(p => p[keyX]))
    const maxX = Math.max(...data.map(p => p[keyX]))
    const minY = Math.min(...data.map(p => p[keyY]))
    const maxY = Math.max(...data.map(p => p[keyY]))

    return [minX, minY, maxX, maxY]
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export class DragHandler {
    constructor(cb) {
        this.cb = cb
        this.scale = 1.0
        this.#reset()
    }

    onStart(event) {
        this.dragging = true
        this.dragMarker.x = this.#getEventLocation(event).x
        this.dragMarker.y = this.#getEventLocation(event).y
    }

    onStop(event) {
        this.dragging = false
        this.#reset()
    }

    onDrag(event) {
        if (!this.dragging) return
        const { x, y } = this.#getEventLocation(event)
        const dx = x - this.dragMarker.x
        const dy = y - this.dragMarker.y
        this.dragMarker = { x, y }
        this.cb([dx, dy])
    }

    setScale(s) {
        this.scale = s
    }

    #reset() {
        this.dragging = false
        this.dragMarker = { x: null, y: null }
    }

    #getEventLocation(e) {
        // https://codepen.io/chengarda/pen/wRxoyB
        if (e.touches && e.touches.length == 1) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY }
        } else if (e.clientX && e.clientY) {
            return { x: e.clientX, y: e.clientY }
        }
    }
}