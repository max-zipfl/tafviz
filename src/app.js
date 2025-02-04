import { Visualizer } from "./visualization.js"
import { DragHandler, getMinMax2D, sleep } from "./utils.js"
import { crs, props } from "./config.js"

// HTML references

const csvInputEl = document.getElementById('data-csv-input')
const mapInputEl = document.getElementById('data-geojson-input')
const originInputEl = document.getElementById('origin-input')
const caseIdInputEl = document.getElementById('caseid-input')
const speedInputEl = document.getElementById('speed-slider')
const speedLabelEl = document.getElementById('speed-label')
const frameCountEl = document.getElementById('frame-count')
const collapseBtn = document.getElementById('collapse-control')
const controlsContent = document.getElementById('controls-content')
const canvas = document.getElementById('stream')

// Global variables
let speed = parseFloat(speedInputEl.value)
let paused = false
let running = false
let loaded = false

// Data handling

/**
 * Read scenario origin point in lat / lon coordinates
 * @returns 
 */
function readOrigin() {
    return originInputEl.value.split(',').map(s => s.trim()).map(parseFloat)
}

function readCaseId() {
    return parseInt(caseIdInputEl.value) || 0
}

/**
 * Read and parse a CSV file from a browser's FileReader
 * @param {array} ref GNSS reference / scenario origin point in 2D (optional, omit for local coordinates)
 * @returns Array of objects
 */
async function readCsv(ref) {
    const input = csvInputEl.files[0]
    const reader = new FileReader()

    ref = ref ? reproject([ref.reverse()])[0] : ref

    return new Promise((resolve, reject) => {
        reader.onload = (e) => {
            const data = d3.csvParse(e.target.result, d3.autoType)

            if (ref) {
                data.forEach(d => {
                    d[props.x] = d[props.x] + ref[0]
                    d[props.y] = d[props.y] + ref[1]
                })
            }
            resolve(data)
        }
        reader.readAsText(input)
    })
}

/**
 * Reads a GeoJSON of polylines from a browser's FileReader and returns the raw lines
 * @returns Array of polylines (defined by 2D points)
 */
async function readGeoJSON() {
    const input = mapInputEl.files[0]
    const reader = new FileReader()

    return new Promise((resolve, reject) => {
        reader.onload = (e) => {
            let data = JSON.parse(e.target.result)
            data = data.features.map(f => f.geometry.coordinates)  // lines
            data = data.map(l => reproject(l, crs, 'EPSG:3857'))
            resolve(data)
        }
        reader.readAsText(input)
    })
}

function filterCase(data, caseId = 0) {
    return data.filter(d => !d.hasOwnProperty(props.caseId) || d[props.caseId] === null || d[props.caseId] === caseId)
}

/**
 * Reprojects a list of coordinates into another CRS.
 * @param {array} coords List of coordinates
 * @param {string} crsSrc Source CRS
 * @param {string} crsDst Target CRS
 * @returns Projected coordinates
 */
function reproject(coords, crsSrc = 'EPSG:4326', crsDst = 'EPSG:3857') {
    return coords.map(c => proj4(crsSrc, crsDst, c))
}

/**
 * Group a dataset by frame ids
 * @param {array} data Flat obstacle dataset
 * @returns Object list grouped by frames
 */
function groupByFrames(data) {
    const dataGrouped = {}
    data.forEach(d => {
        const frameId = parseInt(d[props.frameId])
        if (!dataGrouped[frameId]) {
            dataGrouped[frameId] = []
        }
        dataGrouped[frameId].push(d)
    })
    return dataGrouped
}

// Drawing

const viz = new Visualizer(canvas, props)
const dragHandler = new DragHandler((delta) => viz.adjustOffset(delta))

// UI binding

async function run(e) {
    e.preventDefault()

    if (running) return
    loaded = false

    let map
    let ref
    let data
    let dataGrouped

    try {
        console.log('reading map data')
        map = await readGeoJSON()
    } catch (e) { }

    if (map) {
        ref = readOrigin()
        if (ref.length < 2) {
            alert('Failed to parse origin point. You need to specify one when wanting to visualize on a map.')
            return
        }
    }

    try {
        console.log('reading csv')
        data = await readCsv(ref)  // local or global coordinates depending on whether map is used
        data = filterCase(data, readCaseId())
        dataGrouped = groupByFrames(data)
    } catch (e) {
        alert('Failed to read scenario CSV data')
        return
    }

    console.log('processing csv')
    const [dataMinX, dataMinY, dataMaxX, dataMaxY] = getMinMax2D(data, props.x, props.y)
    const [mapMinX, mapMinY, mapMaxX, mapMaxY] = map ? getMinMax2D(map.flat(1), 0, 1) : [dataMinX, dataMinY, dataMaxX, dataMaxY]
    const [minX, minY, maxX, maxY] = [Math.min(dataMinX, mapMinX), Math.min(dataMinY, mapMinY), Math.max(dataMaxX, mapMaxX), Math.max(dataMaxY, mapMaxY)]
    viz.setDataBounds(minX, minY, maxX, maxY)
    viz.resizeFitData()

    console.log('visualizing data')
    const uniqueFrames = Object.keys(dataGrouped).toSorted((a, b) => parseInt(a) - parseInt(b))

    running = true
    loaded = true

    for (let i = 0; i < uniqueFrames.length; i++) {
        if (paused) {
            // poor-man's pause
            await sleep(100)
            i--
            continue
        }

        const frameId = uniqueFrames[i]
        const nextFrameId = i < uniqueFrames.length - 1 ? uniqueFrames[i + 1] : null

        if (!dataGrouped[frameId].length) continue

        viz.drawFrame(dataGrouped[frameId])
        if (map) viz.drawMap(map)
        frameCountEl.innerText = `t=${frameId} (${Math.round((i / uniqueFrames.length) * 100)} %)`

        if (nextFrameId) {
            const t0 = dataGrouped[frameId][0][props.ts]
            const t1 = dataGrouped[nextFrameId].length ? dataGrouped[nextFrameId][0][props.ts] : 100

            await sleep((t1 - t0) / speed)
        }
    }

    console.log('scenario finished')
    running = false
}

function setSpeed(e) {
    speed = parseFloat(typeof e === 'number' ? e : e.target.value)
    speedLabelEl.innerText = speed.toString()
}

function toggle() {
    if (!loaded) return
    paused = !paused
}

function collapseControls() {
    const isCollapsed = controlsContent.style.display === 'none'
    controlsContent.style.display = isCollapsed ? 'block' : 'none'
    collapseBtn.innerHTML = isCollapsed ? '&#11205;' : '&#11206;'
}

// Listeners

canvas.addEventListener('wheel', (e) => viz.adjustZoom(e.deltaY))
canvas.addEventListener('mousedown', (e) => dragHandler.onStart(e))
canvas.addEventListener('mousemove', (e) => dragHandler.onDrag(e))
canvas.addEventListener('mouseup', (e) => dragHandler.onStop(e))

// Initial stuff

setSpeed(speed)

// Exports

window.taf = {
    run,
    setSpeed,
    toggle,
    collapseControls,
}