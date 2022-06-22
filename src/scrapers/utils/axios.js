const axios = require('axios');
const axiosRetry = require('axios-retry');
const http = require('http');

const MAX_REQUESTS_COUNT = 3; // Max number of retries, set to 3 as ZHS website is not stable
const INTERVAL_MS = 100;
let PENDING_REQUESTS = 0;

// create new axios instance
const instance = axios.create({
	baseURL: '/',
	timeout: 8000,
	httpAgent: new http.Agent({ keepAlive: true }),
});

/**
 * Axios Request Interceptor
 */
instance.interceptors.request.use((config) => new Promise((resolve, reject) => {
	const interval = setInterval(() => {
		if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
			PENDING_REQUESTS++;
			clearInterval(interval);
			resolve(config);
		}
	}, INTERVAL_MS);
}));

/**
 * Axios Response Interceptor
 */
instance.interceptors.response.use((response) => {
	PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
	return Promise.resolve(response);
}, (error) => {
	PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
	return Promise.reject(error);
});

/**
 * Axios Retry Interceptor
 */
axiosRetry(instance, {
	retries: 10,
	retryDelay: (retryCount, error) => {
		const retryDelay = (error.message === 'ETIMEDOUT') ? 15000 : (2000 * retryCount);
		console.log(`Retry attempt: ${retryCount}`);
		console.log(`Retry delay: ${retryDelay} ms`);
		return retryDelay; // time interval between retries
	},
	retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error)
            || error.code === 'ECONNABORTED',
});

module.exports = instance;
