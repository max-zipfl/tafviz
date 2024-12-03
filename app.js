import { csvParse, autoType } from "https://cdn.skypack.dev/d3-dsv@3"
import { Visualizer } from "./visualization.js"
import { getMinMax2D, sleep } from "./utils.js"
import { props } from "./config.js"

// HTML references

const fileInputEl = document.getElementById('data-file-input')
const canvas = document.getElementById('stream')

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
        if (!dataGrouped[d[props.frameId]]) {
            dataGrouped[d[props.frameId]] = []
        }
        dataGrouped[d[props.frameId]].push(d)
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
    const minFrame = Math.min(...data.map(d => d[props.frameId]))
    const maxFrame = Math.max(...data.map(d => d[props.frameId]))

    for (let i = minFrame; i <= maxFrame; i++) {
        viz.drawFrame(dataGrouped[i])
        await sleep(100)
    }
}

// Exports

window.taf = {
    run
}