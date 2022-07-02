const axios = require('axios');
const axiosRetry = require('axios-retry');
const http = require('http');

const MAX_REQUESTS_COUNT = 1; // Max number of retries, set to 3 as ZHS website is not stable
const INTERVAL_MS = 300;	// Cooldown interval until a new request is fired
const TIMOUT_MS = 8000;		// Maximum timeinterval until a timeout error is thrown
const RETRY_DELAY_TIMEOUT = 15000;		// Time period waited until a timeout occures
const RETRY_DELAY_STANDARD = 2000;		// Time period in case of a normal error (so no timeout)
const MAXIMUM_RETRIES = 10;		// Maximum amout of retries in case of error
let PENDING_REQUESTS = 0;

// create new axios instance
const axiosInstance = axios.create({
	baseURL: '/',
	timeout: TIMOUT_MS,
	httpAgent: new http.Agent({ keepAlive: true }),
});

/**
 * Axios Request Interceptor
 */
axiosInstance.interceptors.request.use((config) => new Promise((resolve, reject) => {
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
axiosInstance.interceptors.response.use((response) => {
	PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
	return Promise.resolve(response);
}, (error) => {
	PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
	return Promise.reject(error);
});

/**
 * Axios Retry Interceptor
 */
axiosRetry(axiosInstance, {
	retries: MAXIMUM_RETRIES,
	retryDelay: (retryCount, error) => {
		const retryDelay = (error.message === 'ETIMEDOUT') ? RETRY_DELAY_TIMEOUT : (RETRY_DELAY_STANDARD * retryCount);
		console.log(`Retry attempt: ${retryCount}`);
		console.log(`Retry delay: ${retryDelay} ms`);
		return retryDelay; 	// time interval between retries
	},
	retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error)
		|| error.code === 'ECONNABORTED',
});

module.exports = axiosInstance;
