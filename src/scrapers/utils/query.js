'use strict';

const chalk = require('chalk');

const {
	createOrUpdateEntriesLocalized,
	createOrUpdateEntries,
	getEntry,
	addRelationsToEntry,
	deleteEntries,
} = require('./utils.js');

// Create the entire sports + links table + create relation to individual sport course
const createZHSSport = async (dataGerman, dataEnglish, scraper) => {
	try {
		return await createOrUpdateEntriesLocalized(
			'api::zhs-sport.zhs-sport',
			{
				$and: [
					{
						name: dataGerman.name,
					},
					{
						locale: 'de',
					},
				],
			},
			['localizations'],
			dataGerman,
			dataEnglish,
		);
	} catch (e) {
		console.log(e);
	}
};

// Create individual sports course together with event schedule, sets the relation to the individual sports location
const createZHSSportCourse = async (dataGerman, dataEnglish, relationData, scraper) => {
	try {
		const entryID = await createOrUpdateEntriesLocalized(
			'api::zhs-sport-course.zhs-sport-course',
			{
				$and: [
					{
						heading: dataGerman.heading,
					},
					{
						description: dataGerman.description,
					},
					{
						locale: 'de',
					},
				],
			},
			['localizations'],
			dataGerman,
			dataEnglish,
		);

		return await addRelationsToEntry(
			'api::zhs-sport-course.zhs-sport-course',
			{
				id: entryID,
			},
			relationData,
		);
	} catch (e) {
		console.log(e);
	}
};

// Add relations to a ZHS Sport course
const addRelationZHSSportCourse = async (sportCourseID, relationData) => {
	try {
		return await addRelationsToEntry(
			'api::zhs-sport-course.zhs-sport-course',
			{
				id: sportCourseID,
			},
			relationData,
		);
	} catch (e) {
		console.log(e);
	}
};

// Creates the sports offerings table and links it to the individual sports course
const createZHSSportCourseOffering = async (data, scraper) => {
	try {
		return await createOrUpdateEntries(
			'api::zhs-sport-course-offering.zhs-sport-course-offering',
			{ courseNumber: data.courseNumber },
			data,
		);
	} catch (e) {
		console.log(e);
	}
};

// Adds relations to a ZHS Sport course offering
const addRelationZHSSportCourseOffering = async (sportCourseOfferingID, relationData) => {
	try {
		return await addRelationsToEntry(
			'api::zhs-sport-course-offering.zhs-sport-course-offering',
			{
				id: sportCourseOfferingID,
			},
			relationData,
		);
	} catch (e) {
		console.log(e);
	}
};

// Create a ZHS Sport Course Cost entry and link it to the individual sport course offering
const createZHSSportCourseCost = async (data, relationData, scraper) => {
	try {
		const entryID = await createOrUpdateEntries(
			'api::zhs-sport-course-cost.zhs-sport-course-cost',
			{
				costShort: data.costShort,
			},
			data,
		);

		return await addRelationsToEntry(
			'api::zhs-sport-course-cost.zhs-sport-course-cost',
			{
				id: entryID,
			},
			relationData,
		);
	} catch (e) {
		console.log(e);
	}
};

// Create ZHS Sport Course Event and link it to the individual sport course offering
const createZHSSportsCourseEvent = async (data, relationData, scraper) => {
	try {
		const entryID = await createOrUpdateEntries(
			'api::zhs-sport-course-event.zhs-sport-course-event',
			{
				$and: [
					{
						day: data.day,
					},
					{
						date: data.date,
					},
					{
						time: data.time,
					},
					{
						zhs_sport_location: relationData.zhs_sport_location[0],
					},
				],
			},
			data,
		);

		return await addRelationsToEntry(
			'api::zhs-sport-course-event.zhs-sport-course-event',
			{
				id: entryID,
			},
			relationData,
		);
	} catch (e) {
		console.log(e);
	}
};

// Gets a specific ZHS Sport Location
const getZHSSportLocation = async (data, scraper) => {
	try {
		return await getEntry(
			'api::zhs-sport-location.zhs-sport-location',
			{
				link: data.locationLink,
			},
			['id'],
		);
	} catch (e) {
		console.log(e);
	}
};

// Creates a specific ZHS Sport Location entrys
const createZHSSportLocation = async (data, scraper) => {
	try {
		return await createOrUpdateEntries(
			'api::zhs-sport-location.zhs-sport-location',
			{
				$and: [
					{
						name: data.name,
					},
					{
						link: data.link,
					},
				],
			},
			data,
		);
	} catch (e) {
		console.log(e);
	}
};

// Delete all outdated entires that were last modifier before the last update
const deleteOutdatedEntries = async (beginScrapeTimestamp, scraper) => {
	try {
		const relations = [
			'api::zhs-sport.zhs-sport',
			'api::zhs-sport-course.zhs-sport-course',
			'api::zhs-sport-course-offering.zhs-sport-course-offering',
			'api::zhs-sport-location.zhs-sport-location',
			'api::zhs-sport-course-event.zhs-sport-course-event',
			'api::zhs-sport-course-cost.zhs-sport-course-cost',
		];

		let deletedEntries = 0;

		for await (const relation of relations) {
			deletedEntries += await deleteEntries(
				relation,
				{
					updated_at: {
						$lt: beginScrapeTimestamp,
					},
				},
			);
		}

		return deletedEntries;
	} catch (e) {
		console.log(e);
	}
};

module.exports = {
	createZHSSport,
	createZHSSportCourse,
	addRelationZHSSportCourse,
	createZHSSportCourseOffering,
	addRelationZHSSportCourseOffering,
	createZHSSportCourseCost,
	createZHSSportsCourseEvent,
	createZHSSportLocation,
	getZHSSportLocation,
	deleteOutdatedEntries,
};
