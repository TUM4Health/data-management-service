module.exports = ({ env }) => ({
  host: env('HOST', '130.61.218.40'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
