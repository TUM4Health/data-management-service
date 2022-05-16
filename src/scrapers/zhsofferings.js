const main = async () => {
    // Fetch the correct scraper thanks to the slug
    const slug = "zhs"
    const scraper = await strapi.query('api::scraper.scraper').findOne({
        slug: slug
    });

    console.log(scraper);

    // If the scraper doesn't exists, is disabled or doesn't have a frequency then we do nothing
    if (scraper == null || !scraper.enabled || !scraper.frequency)
        return
}

exports.main = main;