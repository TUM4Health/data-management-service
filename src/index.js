'use strict';

const {
  mainScrape,
  mainScrapeCleanup
} = require('./scrapers/zhsofferings.js')

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    mainScrape() // TODO: Delete this once a proper cronjob is setted
  },
};
