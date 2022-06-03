const axios = require('axios');
const axiosRetry = require('axios-retry');
const http = require('http');

const MAX_REQUESTS_COUNT = 5
const INTERVAL_MS = 100
let PENDING_REQUESTS = 0

// create new axios instance
const instance = axios.create({
    baseURL: '/',
    timeout: 8000,
    httpAgent: new http.Agent({ keepAlive: true }),
});

/**
 * Axios Request Interceptor
 */
instance.interceptors.request.use(function (config) {
    return new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
                PENDING_REQUESTS++
                clearInterval(interval)
                resolve(config)
            }
        }, INTERVAL_MS)
    })
})

/**
 * Axios Response Interceptor
 */
instance.interceptors.response.use(function (response) {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
    return Promise.resolve(response)
}, function (error) {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
    return Promise.reject(error)
})

axiosRetry(instance, {
    retries: 10,
    retryDelay: (retryCount) => {
        console.log(`Retry attempt: ${retryCount}`);
        console.log(`Retry delay: ${retryCount * 2} sec`);
        return retryCount * 2000; // time interval between retries
    }
});

module.exports = instance