import { typeColors } from "./config.js"

const SCROLL_FACTOR = -0.001
const ZOOM_MIN = 0.1
const ZOOM_MAX = 3

export class Visualizer {
    /**
     * Class for drawing scenarios into a canvas
     * @param {HTMLElement} canvas HTML canvas element
     * @param {object} props Dict of CSV column names for required fields.
     */
    constructor(canvas, props) {
        this.props = props
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.w = canvas.width
        this.h = canvas.height
        this.zoom = 1.0
        this.offset = [0, 0]

        this.min = [0, 0]
        this.max = [this.w, this.h]

        this.stateCache = {
            frame: null,
            map: null,
            showLabels: null,
            showOrientation: null,
        }

        this.#initCanvas()
    }
    
    /**
     * Zoom in or out on the canvas by given amount
     * @param {number} delta Zoom adjustment factor (single scalar)
     */
    adjustZoom(delta) {
        const zoom = 1 + delta * SCROLL_FACTOR

        if ((this.zoom + zoom - 1) <= ZOOM_MIN && delta > 0) return
        if ((this.zoom + zoom - 1) >= ZOOM_MAX && delta < 0) return

        this.zoom += zoom - 1

        this.clear()
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2)
        this.ctx.scale(zoom, zoom)
        this.ctx.translate(-this.canvas.width / 2 + this.offset[0], -this.canvas.height / 2 + this.offset[0])
        this.#restoreState()
    }

    /**
     * Drag the canvas horizontally and vertically by the given amount
     * @param {array} delta X- and Y adjustment in pixels
     */
    adjustOffset(delta) {
        // scale translate delta by zoom level to move map approx. the same amount that the cursor had moved
        // TODO: for whatever reason, this compensation is off the more extreme the zoom level is 
        delta = delta.map(d => d / this.zoom)
        this.clear()
        this.ctx.translate(...delta)
        this.#restoreState()
    }

    /**
     * Draw a single traffic scene defined.
     * @param {array} data Array of objects with required keys: (frame_id, x, y, psi_rad, agent_type)
     */
    drawFrame(data, showOrientation = true, showLabels = true) {
        this.clear()
        
        if (!data.length) return
        this.stateCache.frame = data
        this.stateCache.showOrientation = showOrientation
        this.stateCache.showLabels = showLabels

        const frameId = data[0][this.props.frameId]

        data.forEach(d => {
            const center = [d[this.props.x], d[this.props.y]]
            const color = typeColors[d[this.props.type].toLowerCase()] || '#ffffff'

            this.#drawBox(
                center,
                [d[this.props.l], d[this.props.w]],
                d[this.props.yaw],
                color,
                showOrientation,
            )

            if (showLabels) this.#drawIdLabel(d[this.props.trackId], center, color)
        })
    }

    /**
     * Draws map contours given as polylines
     * @param {array} lines 2D coordinates of polyline points
     */
    drawMap(lines) {
        this.stateCache.map = lines
        lines.forEach(l => this.#drawLine(l))
    }

    /**
     * Set minimum and maximum data range found in the data. Required for projecting scenario coordinates to screen coordinates.
     * @param {number} minX 
     * @param {number} minY 
     * @param {number} maxX 
     * @param {number} maxY 
     */
    setDataBounds(minX, minY, maxX, maxY) {
        this.min = [minX, minY]
        this.max = [maxX, maxY]
    }

    /**
     * Resize the HTML canvas element to match the scenario's aspect ratio defined by @see setDataBounds.
     */
    resizeFitData() {
        const dataRangeX = this.max[0] - this.min[0]
        const dataRangeY = this.max[1] - this.min[1]
        const aspectRatio = dataRangeX / dataRangeY
        this.canvas.width = this.h * aspectRatio
        this.w = this.canvas.width
    }

    clear() {
        this.#initCanvas()
    }

    #drawLine(coords, color = '#ffffff') {
        const ctx = this.ctx
        coords = coords.map(p => this.#project(p))

        ctx.strokeStyle = color + '66'
        ctx.lineWidth = 1

        ctx.beginPath()
        ctx.moveTo(coords[0][0], coords[0][1])
        coords.forEach(c => ctx.lineTo(c[0], c[1]))
        ctx.stroke()
    }

    /**
     * Draw a bounding box with given center point, dimensions and rotation.
     * @param c Bounding box center point (x, y)
     * @param d Dimensions (x, y)
     * @param r Rotation (around center point) (radians)
     * @param color Color of the bounding box (white by default)
     */
    #drawBox(c, d, r, color = '#ff0000', showOrientation = true) {
        const ctx = this.ctx
        
        let coords = this.#getBox2d(c, d, r)  // br, bl, fl, fr
        coords = this.#rotateBox(coords, r)
        coords = coords.map(p => this.#project(p))

        const [br, bl, fl, fr] = [...coords]
        const cp = this.#project(c)  // center
        const fl2fr = [fr[0] - fl[0], fr[1] - fl[1]]  // fl -> fr
        const fc = [fl[0] + fl2fr[0] / 2, fl[1] + fl2fr[1] / 2]  // front center
        const cp2fc = [fc[0] - cp[0], fc[1] - cp[1]]  // center -> front center

        const arrow = [
            [fc[0], fc[1]],
            [fc[0] + cp2fc[0] , fc[1] + cp2fc[1]],
            [fl[0] + cp2fc[0] / 2, fl[1] + cp2fc[1] / 2],  // arrow tip left
            [fr[0] + cp2fc[0] / 2, fr[1] + cp2fc[1] / 2],  // arrow tip right
        ]

        ctx.fillStyle = color + '66'
        ctx.strokeStyle = color
        ctx.lineWidth = 2

        // box
        ctx.beginPath()
        ctx.moveTo(coords[0][0], coords[0][1])
        ctx.lineTo(coords[1][0], coords[1][1])
        ctx.lineTo(coords[2][0], coords[2][1])
        ctx.lineTo(coords[3][0], coords[3][1])
        ctx.lineTo(coords[0][0], coords[0][1])
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // arrow
        if (showOrientation) {
            ctx.beginPath()
            ctx.moveTo(...arrow[0])
            ctx.lineTo(...arrow[1])
            ctx.lineTo(...arrow[2])
            ctx.moveTo(...arrow[1])
            ctx.lineTo(...arrow[3])
            ctx.stroke()
        }
    }

    /**
     * Prints an obstacle's ID next to it 
     * @param {int} id The ID
     * @param {array} center The obstacle's position
     * @param {string} color Text color
     */
    #drawIdLabel(id, center, color = '#ffffff') {
        center = this.#project(center)
        const ctx = this.ctx
        const text = id
        ctx.fillStyle = color
        ctx.font = 'normal small-caps 10px mono'
        ctx.fillText(text, center[0] - 12, center[1] - 12)
    }

    /**
     * Project a 2D point onto the canvas
     * @param {array} p Point to project (x, y)
     * @returns Projected coordinates
     */
    #project(p) {
        let pp = [...p]
        pp = [
            ((pp[0] - this.min[0]) / (this.max[0] - this.min[0])) * (this.w - 0) + 0,
            ((pp[1] - this.min[1]) / (this.max[1] - this.min[1])) * (this.h - 0) + 0,
        ]
        pp[1] = this.h - pp[1]  // flip y axis
        return pp
    }

    /**
     * Rotate a point by a given angle around its center point
     * @param {array} p Point (x, y)
     * @param {number} r Rotation angle (radians)
     * @param {array} centroid Rotation center (x, y)
     * @retuens Rotated coordinates
     */
    #rotate(p, r, centroid) {
        let pp = [...p]

        // Translate to origin
        pp[0] -= centroid[0]
        pp[1] -= centroid[1]

        // Rotate
        pp = [
            pp[0] * Math.cos(r) - pp[1] * Math.sin(r),
            pp[0] * Math.sin(r) + pp[1] * Math.cos(r)
        ]

        // Translate back
        pp[0] += centroid[0]
        pp[1] += centroid[1]

        return pp
    }

    /**
     * Rotate a bounding box (defined by its corner points) around its center point
     * @param {array} box 2D corner points (x, y) (tl, tr, br, bl)
     * @param {number} r Rotation angle (radians)
     * @returns Rotated bounding box coordinates
     */
    #rotateBox(box, r) {
        const c = [
            box.reduce((sum, p) => sum + p[0], 0) / box.length,
            box.reduce((sum, p) => sum + p[1], 0) / box.length
        ]
        return box.map(p => this.#rotate(p, r, c))
    }

    #initCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    /**
     * Returns corner points for a bounding box defined by center point, length and width (axis-aligned).
     * @param {array} c Center point (x, y)
     * @param {array} d Dimensions (length, width)
     * @returns Array of corner points (tl, tr, br, bl)
     */
    #getBox2d(c, d) {
        const bl = [c[0] - d[0] / 2, c[1] - d[1] / 2]
        const fl = [c[0] + d[0] / 2, c[1] - d[1] / 2]
        const fr = [c[0] + d[0] / 2, c[1] + d[1] / 2]
        const br = [c[0] - d[0] / 2, c[1] + d[1] / 2]

        return [br, bl, fl, fr]
    }

    #restoreState() {
        if (this.stateCache.frame) this.drawFrame(this.stateCache.frame, this.stateCache.showOrientation, this.stateCache.showLabels)
        if (this.stateCache.map) this.drawMap(this.stateCache.map)
    }
}