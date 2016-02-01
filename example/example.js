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
        return 'dev-';
      }
    },
    parseText: 'descriptionText',
    free: false
  });

  taggy($('#sourced'), {
    autocomplete: {
      source: function (data) {
        return new Promise((resolve, reject) => {
          setTimeout(function () {
            resolve([
              'apples', 'bananas', 'carrots', 'peanuts', 'lettuce'
            ])
          }, 500);
        });
      }
    }
  });

  taggy($('#random'), {
    autocomplete: {
      source: function (data) {
        return Promise.resolve(Array
          .apply(null, { length: 10 })
          .map(x => Math.random().toString().slice(2))
        );
      }
    }
  });

  taggy($('#free'), {});
}();
