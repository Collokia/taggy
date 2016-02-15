void function () {
  'use strict';

  var $ = document.querySelector.bind(document);

  window.examples = [

    taggy($('#free'), {}),

    taggy($('#fixed'), {
      autocomplete: {
        noMatches: 'No results found.',
        suggestions: function (data) {
          return Promise.resolve([{
            title: 'scala',
            list: [
              { tagId: 'dev:scala', descriptionText: 'atmosphere-scala-world', taxonomy: 'devWorld' },
              { tagId: 'dev:scala-wow', descriptionText: 'atmosphere-scala-wow-saw', taxonomy: 'devWorld' },
              { tagId: 'dev:scala-chat', descriptionText: 'atmosphere-scala-chat', taxonomy: 'devWorld' }
            ]
          }, {
            title: 'mobile',
            list: [
              { tagId: 'dev:android', descriptionText: 'dev-android', taxonomy: 'devWorld' }
            ]
          }, {
            title: 'java',
            list: [
              { tagId: 'dev:java', descriptionText: 'dev-java', taxonomy: 'langs' },
              { tagId: 'dev:jvm', descriptionText: 'dev-jvm', taxonomy: 'other' }
            ]
          }]);
        },
        predictNextSearch (o) {
          return 'dev-';
        }
      },
      parseText: 'descriptionText',
      parseValue: 'descriptionText',
      free: false
    }),

    taggy($('#sourced'), {
      autocomplete: {
        noMatches: 'No results found.',
        suggestions: function (data) {
          return new Promise((resolve, reject) => {
            setTimeout(function () {
              resolve([{
                list: [
                  'apples', 'bananas', 'carrots', 'peanuts', 'lettuce'
                ]
              }]);
            }, 500);
          });
        }
      }
    }),

    taggy($('#random'), {
      autocomplete: {
        noMatches: 'No results found.',
        suggestions: function (data) {
          return Promise.resolve([{ list: Array
            .apply(null, { length: 10 })
            .map(x => Math.random().toString().slice(2))
          }]);
        }
      }
    }),

    taggy($('#invalid'))
  ];
}();
