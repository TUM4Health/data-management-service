'use strict';

/**
 * scraper custom router
 */

module.exports = {
	routes: [
		{
			method: 'GET',
			path: '/scrapers/:slug',
			handler: 'scraper.findOne',
			config: {
				policies: [],
			},
		},
	],
};
