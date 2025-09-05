let time = 0;

export function startChronometer() {    
    time = Date.now();
}

export function stopChronometer() {
    const elapsedTime = Date.now() - time;
    time = 0;
    return elapsedTime;
}