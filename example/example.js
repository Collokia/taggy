void function () {
  'use strict';

  var $ = document.querySelector.bind(document);

  taggy($('#fixed'), {
    autocomplete: {
      suggestions: [
        { tagId: 'dev:android', descriptionText: 'dev-android', taxonomy: 'devWorld' },
        { tagId: 'dev:java', descriptionText: 'dev-java', taxonomy: 'langs' },
        { tagId: 'dev:jvm', descriptionText: 'dev-jvm', taxonomy: 'other' }
      ],
      prefix (fullText) {
        return fullText.split('-')[0];
      }
    },
    parseText: 'descriptionText',
    free: false
  });

  taggy($('#free'), {});
}();
