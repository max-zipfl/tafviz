const typeColors = {
    'Car': '#4FC3F7',
    'Unclassified': '#fff9800',
    'Pedestrian': '#BA68C8',
}

export class Visualizer {
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.w = canvas.width
        this.h = canvas.height

        this.min = [0, 0]
        this.max = [this.w, this.h]

        // Initialization
        this.#initCanvas()
    }

    drawFrame(data) {
        /**
         * Draw a single traffic scene defined.
         * @param {array} data Array of objects with required keys: (frame_id, x, y, psi_rad, agent_type)
         */
        this.clear()

        if (!data.length) return

        const frameId = data[0].frame_id
        data.forEach(d => this.drawBox(
            [d.x, d.y],
            [d.length, d.width],
            d.psi_rad,
            typeColors[d.agent_type] || '#ffffff',
        ))
        this.drawFrameCount(frameId)
    }

    setDataBounds(minX, minY, maxX, maxY) {
        this.min = [minX, minY]
        this.max = [maxX, maxY]
    }

    clear() {
        this.#initCanvas()
    }

    #drawBox(c, d, r, color = '#ff0000') {
        /**
         * Draw a bounding box with given center point, dimensions and rotation.
         * @param c Bounding box center point (x, y)
         * @param d Dimensions (x, y)
         * @param r Rotation (around center point) (radians)
         */
        const ctx = this.ctx
        let coords = this.#getBox2d(c, d, r)
        coords = coords.map(p => this.#project(p))
        coords = this.#rotateBox(coords, r)

        ctx.fillStyle = color + '66'
        ctx.strokeStyle = color
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.moveTo(coords[0][0], coords[0][1])
        ctx.lineTo(coords[1][0], coords[1][1])
        ctx.lineTo(coords[2][0], coords[2][1])
        ctx.lineTo(coords[3][0], coords[3][1])
        ctx.lineTo(coords[0][0], coords[0][1])
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
    }

    #drawFrameCount(c) {
        const ctx = this.ctx
        const text = `t=${c}`
        const textMetrics = ctx.measureText(text)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold small-caps 12px mono'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, textMetrics.width + 12, this.canvas.height - 12)
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
        const fl = [c[0] - d[0] / 2, c[1] - d[1] / 2]
        const fr = [c[0] + d[0] / 2, c[1] - d[1] / 2]
        const br = [c[0] + d[0] / 2, c[1] + d[1] / 2]
        const bl = [c[0] - d[0] / 2, c[1] + d[1] / 2]

        return [fl, fr, br, bl]
    }
}