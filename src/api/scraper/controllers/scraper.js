'use strict';

const { sanitizeEntity } = require('strapi-utils');

/**
 *  scraper controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::scraper.scraper', ({ strapi }) => ({
	/**
     * Retrieve a record.
     *
     * @return {Object}
     */

	async findOne(ctx) {
		const { slug } = ctx.params;

		const entity = await strapi.services.scraper.findOne({ slug });
		return sanitizeEntity(entity, { model: strapi.models.scraper });
	},
}));
