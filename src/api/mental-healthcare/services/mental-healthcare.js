'use strict';

/**
 * mental-healthcare service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::mental-healthcare.mental-healthcare');
