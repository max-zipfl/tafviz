import { csvParse, autoType } from "https://cdn.skypack.dev/d3-dsv@3"
import { Visualizer } from "./visualization.js"
import { getMinMax2D, sleep } from "./utils.js"
import { props } from "./config.js"

// HTML references

const fileInputEl = document.getElementById('data-file-input')
const speedInputEl = document.getElementById('speed-slider')
const speedLabelEl = document.getElementById('speed-label')
const canvas = document.getElementById('stream')

// Global variables
let speed = parseFloat(speedInputEl.value)

// Data handling

/**
 * Read and parse a CSV file from a browser's FileReader
 * @returns Array of objects
 */
async function readCsv() {
    const input = fileInputEl.files[0]
    const reader = new FileReader()

    return new Promise((resolve, reject) => {
        reader.onload = (e) => {
            const data = csvParse(e.target.result, autoType)
            resolve(data)
        }
        reader.readAsText(input)
    })
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

// UI binding

async function run(e) {
    e.preventDefault()

    console.log('reading csv')
    const data = await readCsv()
    const dataGrouped = groupByFrames(data)

    console.log('processing csv')
    const [minX, minY, maxX, maxY] = getMinMax2D(data, props.x, props.y)
    viz.setDataBounds(minX * 1.5, minY * 1.1, maxX * 1.5, maxY * 1.1)

    console.log('visualizing data')
    const uniqueFrames = Object.keys(dataGrouped).toSorted((a, b) => parseInt(a) - parseInt(b))
    
    for (let i = 0; i < uniqueFrames.length; i++) {
        const frameId = uniqueFrames[i]
        const nextFrameId = i < uniqueFrames.length - 1 ? uniqueFrames[i+1] : null

        if (!dataGrouped[frameId].length) continue

        viz.drawFrame(dataGrouped[frameId])

        if (nextFrameId) {
            const t0 = dataGrouped[frameId][0][props.ts]
            const t1 = dataGrouped[nextFrameId].length ? dataGrouped[nextFrameId][0][props.ts] : 100

            await sleep((t1 - t0) / speed)
        }
    }
}

function setSpeed(e) {
    speed = parseFloat(typeof e === 'number' ? e : e.target.value)
    speedLabelEl.innerText = speed.toString()
}

// Initial stuff

setSpeed(speed)

// Exports

window.taf = {
    run,
    setSpeed,
}