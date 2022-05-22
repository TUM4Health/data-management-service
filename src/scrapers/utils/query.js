'use strict'

const chalk = require('chalk');

// Create the entire sports + links table + create relation to individual sport course
const createZHSSports = async (name, stars, forks, issues, description, language, template, license, deployLink, scraper) => {

    try {
        const entry = await strapi.query('site-generator').create({
            name: name,
            stars: stars,
            forks: forks,
            issues: issues,
            description: description,
            language: language,
            templates: template,
            license: license,
            deploy_to_netlify_link: deployLink,
            scraper: scraper.id
        })
    } catch (e) {
        console.log(e);
    }
}

// Create individual sports course together with event schedule, sets the relation to the individual sports location
const createZHSSportsCourse = async () => {

}

// Maybe create the event schedule in a different function as it creates another table entry (must be run after creation of course)
const createZHSSportsCourseEvent = async () => {

}

// Create all locations of sports (probably extra scraping call BEFORE the sports course creation?)
// Checks count of locations from scraping to the count of locations in DB, checks all names and coordinates, updates them accordingly
const createZHSLocation = async () => {

}

const updateScraper = async (scraper, report, errors) => {
    await strapi.query('scraper').update({
        id: scraper.id
    }, {
        report: report,
        error: errors,
    });

    console.log(`Job done for: ${chalk.green(scraper.name)}`);
}

module.exports = {
    createZHSSports,
    createZHSSportsCourse,
    createZHSSportsCourseEvent,
    createZHSLocation,
    updateScraper
}