'use strict';

/**
 * scraper service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::scraper.scraper');
