'use strict';

const {
	setAllScrapersCurrentlyRunning,
} = require('./scrapers/utils/utils.js');

module.exports = {
	/**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
	register(/* { strapi } */) { },

	/**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
	bootstrap({ strapi }) {
		// Set the scraper to currently not running
		setAllScrapersCurrentlyRunning(false);
	},
};
