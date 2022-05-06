'use strict';

/**
 * covid router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::covid.covid');
