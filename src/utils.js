export function getMinMax2D(data, keyX='x', keyY='y') {
    const minX = Math.min(...data.map(p => p[keyX]))
    const maxX = Math.max(...data.map(p => p[keyX]))
    const minY = Math.min(...data.map(p => p[keyY]))
    const maxY = Math.max(...data.map(p => p[keyY]))

    return [ minX, minY, maxX, maxY ]
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}