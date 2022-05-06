'use strict';

/**
 * covid service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::covid.covid');
