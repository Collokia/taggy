# taggy

> Tag input component

# Install

You can get it on GitHub.

```shell
npm install https://github.com/Collokia/taggy
```

# Usage

Taggy demands one thing of you: **the input must have no siblings.**

```html
<div>
  <input id='insigificant' />
</div>
```

# `taggy(input, options={})`

Taggy exposes a function to turn an input into a tag list input. Empty spans will be added on both sides of your input element.

A few options may be provided. They are detailed below.

## `free`

Defaults to `true`. When this flag is turned off, options can only be picked from the autocomplete list, they can't be edited, but they can still be deleted entirely using backspace.

## `deletion`

When `true`, humans will be able to delete individual tags by clicking on an icon.

## `delimiter`

The separator between tags. Defaults to `' '`. Must be a single character.

## `preventInvalid`

This option will prevent tags identified as invalid from being added. By default this is turned off and they just get a `tay-invalid` CSS class.

## `validate(value)`

A method that validates whether the user input `value` constitutes a valid tag. Useful to filter out duplicates. Defaults to the method below, that does exactly that. Note that in the code below, `toy` is the API returned by calling `taggy(el)`.

```js
function validate (value) {
  return toy.findItem(value) === null;
}
```

Note that `tags` is only a copy and modifying it won't affect the list of tags.

## `render(container, item)`

A method that's called whenever a tag should be rendered. Defaults to setting `getText(item)` as the container's text.

## `parseText`

When you have complex data items from autocomplete, you need to set `parseText` to read the value that should be used as a display value.

## `parseValue`

When you have complex data items from autocomplete, you need to set `parseText` to read the value that should be used as each tag's value.

## `autocomplete`

Expects an object that defines how the autocomplete list is configured. Autocomplete options are listed below.

> ### `predictNextSearch(info)`
>
> Runs when a tag is inserted. The returned string is used to pre-fill the text input. Useful to avoid repetitive user input. The suggestion list can be used to choose a prefix based on the previous list of suggestions.
>
> - `info.input` contains the user input at the time a suggestion was selected
> - `info.suggestions` contains the list of suggestions at the time a suggestion was selected
> - `info.selection` contains the suggestion selected by the user
>
> ### `cache`
>
> Can be an object that will be used to store queries and suggestions. You can provide a `cache.duration` as well, which defaults to one day and is specified in seconds. The `cache.duration` is used to figure out whether cache entries are fresh or stale.
>
> You can disable autocomplete caching by setting `cache` to `false`.
>
> ### `limit`
>
> Can be a number that determines the maximum amount of suggestions shown in the autocomplete list.
>
> ### `filter(query, suggestion)`
>
> By default suggestions are filtered using the [`fuzzysearch`](https://github.com/bevacqua/fuzzysearch) algorithm. You can change that and use your own `filter` algorithm instead.
>
> ### `duplicates`
>
> Specifies whether the autocomplete should suggest tags that are already selected.
>
> ### `suggestions`
>
> A `suggestions(data)` should be set to a function that returns a promise. The promise should fulfill to the result for the provided `data.input`.
>
> - `data.input` is a query for which suggestions should be provided
> - `data.limit` is the previously specified `options.limit`
> - `data.values` are the currently selected values
> - `data.previousSelection` is the last suggestion selected by the user
> - `data.previousSuggestions` is the last list of suggestions provided to the user
>
> The expected schema for the promise's fulfillment result is outlined below.
>
> ```js
> [category1, category2, category3]
> ```
>
> Each category is expected to follow the next schema. The `id` is optional, all category objects without an `id` will be treated as if their `id` was `'default'`. Note that categories under the same `id` will be merged together when displaying the autocomplete suggestions.
>
> ```js
> {
>   id: 'here is some category',
>   list: [item1, item2, item3]
> }
> ```
>
> ### `blankSearch`
>
> When this option is set to `true`, the `suggestions(data)` function will be called even when the `input` string is empty.
>
> ### `noMatches`
>
> Defaults to `null`. Set to a string if you want to display an informational message when no suggestions match the provided `input` string. Note that this message won't be displayed when `input` is empty even if `blankSearch` is turned on.
>
> ### `debounce`
>
> The minimum amount of milliseconds that should ellapse between two different calls to `suggestions`. Useful to allow users to type text without firing dozens of queries. Defaults to `300`.
>
> ### `highlighter`
>
> If set to `false`, autocomplete suggestions won't be highlighted based on user input.
>
> ### `highlightCompleteWords`
>
> If set to `false`, autocomplete suggestions won't be highlighted as whole words first. The highlighter will be faster but the UX won't be as close to user expectations.
>
> ### `renderItem`
>
> By default, items are rendered using the text for a `suggestion`. You can customize this behavior by setting `autocomplete.renderItem` to a function that receives `li, suggestion` parameters. The `li` is a DOM element and the `suggestion` is its data object.
>
> ### `renderCategory`
>
> By default, categories are rendered using just their `data.title`. You can customize this behavior by setting `autocomplete.renderCategory` to a function that receives `div, data` parameters. The `div` is a DOM element and the `data` is the full category data object, including the `list` of suggestions. After you customize the `div`, the list of suggestions for the category will be appended to `div`.

## `convertOnBlur`

By default, tags are converted whenever the `blur` event fires on elements other than `input`. Set to `false` to disable.

# Instance API

When you call `taggy(input, options)`, you'll get back a tiny API to interact with the instance. Calling `taggy` repeatedly on the same DOM element will have no effect, and it will return the same API object.

## `.addItem(data)`

Adds an item to the input. The `data` parameter could be a string or a complex object, depending on your instance configuration.

## `.findItem(data)`

Finds an item by its `data` string or object.

## `.findItemIndex(data)`

Return the index of the first item found by its `data` string or object.

## `.findItemByElement(el)`

Finds an item by its `.tay-tag` DOM element.

## `.removeItem(data)`

Removes an item from the input. The item is found using the `data` string or object.

## `.removeItemByElement(el)`

Removes an item from the input. The item is found using a `.tay-tag` DOM element.

## `.value()`

Returns the list of valid tags as an array.

## `.allValues()`

Returns the list of tags as an array including invalid tags.

## `.destroy()`

Removes all event listeners, CSS classes, and DOM elements created by taggy. The input's `value` is set to the output of `.value()`. Once the instance is destroyed it becomes useless, and you'll have to call `taggy(input, options)` once again if you want to restore the behavior.

## Instance Events

The instance API comes with a few events.

Event | Arguments | Description
----|-------|------------
`add` | `data`, `el` | Emitted whenever a new item is added to the list
`remove` | `data` | Emitted whenever an item is removed from the list
`invalid` | `data`, `el` | Emitted whenever an invalid item is added to the list
`autocomplete.beforeUpdate` | none | Emitted before asking the autocomplete for a different list of suggestions, useful to abort AJAX requests that are no longer necessary

You can listen to these events using the following API.

```js
const toy = taggy(el);
toy.on('add', data => console.log(data)); // listen to an event
toy.once('invalid', data => throw new Error('invalid data')); // listener discarded after one execution

toy.on('foo', bar);
toy.off('foo', bar); // removes listener

function bar () {}
```

[1]: http://stackoverflow.com/questions/ask
[2]: https://github.com/bevacqua/rome
[3]: http://ponyfoo.com/articles/stop-breaking-the-web
[4]: http://i.imgur.com/mhy3Fv9.png
