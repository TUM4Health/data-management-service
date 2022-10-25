module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/survey-response-select-accumulated',
      handler: 'survey-response-select-accumulated.fetchAccumulatedSurveySelects',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    {
      method: 'DELETE',
      path: '/survey-select-delete',
      handler: 'survey-response-select-accumulated.deleteAllSurveySelects',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
