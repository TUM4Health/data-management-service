'use strict';

/**
 *  covid controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::covid.covid');
