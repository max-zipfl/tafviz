const TAF_CONFIG = {
    x: 'lon',
    y: 'lat',
    w: 'width',
    l: 'length',
    yaw: 'psi_rad',
    frameId: 'frame_id',
    ts: 'timestamp_ms',
    type: 'agent_type'
}

export const props = {
    ...TAF_CONFIG,
}

export const crs = 'EPSG:4326'