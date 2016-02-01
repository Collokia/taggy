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

## `render(container, item)`

A method that's called whenever a tag should be rendered. Defaults to setting `getText(item)` as the container's text.

## `parseText`

When you have complex data items from autocomplete, you need to set `parseText` to read the value that should be used as a display value.

## `parseText`

When you have complex data items from autocomplete, you need to set `parseText` to read the value that should be used as each tag's value.

## `autocomplete`

Expects an object that defines how the autocomplete list is configured. Autocomplete options are listed below.

> ### `prefix(text, previousSuggestions)`
>
> Runs when a tag is inserted. The returned string is used to pre-fill the text input. Useful to avoid repetitive prefixes. The `previousSuggestions` list can be used to choose a prefix based on the previous list of suggestions.
>
> ### `cache`
>
> Can be an object that will be used to store queries and suggestions. You can provide a `cache.duration` as well, which defaults to one day and is specified in seconds. The `cache.duration` is used to figure out whether cache entries are fresh or stale.
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
> Specifies whether the autocomplete list should show tags that are already selected.
>
> ### `suggestions`
>
> A list of suggestions for the autocomplete list. Note that it _can't change over time_.
>
> ### `source`
>
> An alternative to `suggestions` that **can change over time**. `source(data)` should be a function that returns a promise. The promise should fulfill to an array of autocomplete suggestion objects for the provided `data.query`.
>
> - `data.query` is a query for which suggestions should be provided
> - `data.limit` is the previously specified `options.limit`
>
> ### `debounce`
>
> The minimum amount of milliseconds that should ellapse between two different calls to `source`. Useful to allow users to type text without firing dozens of queries. Defaults to `300`.

## `validate(value, tags)`

A method that validates whether the user input `value` constitutes a valid tag, taking into account the currently valid `tags`. Useful to filter out duplicates. Defaults to the method below.

```js
function validate (value, tags) {
  return tags.indexOf(value) === -1;
}
```

Note that `tags` is only a copy and modifying it won't affect the list of tags.

## `convertOnBlur`

By default, tags are converted whenever the `blur` event fires on elements other than `input`. Set to `false` to disable.

# Instance API

When you call `taggy(input, options)`, you'll get back a tiny API to interact with the instance. Calling `taggy` repeatedly on the same DOM element will have no effect, and it will return the same API object.

## `.addItem(data)`

Adds an item to the input. The `data` parameter could be a string or a complex object, depending on your instance configuration.

## `.removeItem(data)`

Removes an item from the input. The item is found using the `data` string or object.

## `.removeItemByElement(data)`

Removes an item from the input. The item is found using a `.tay-tag` DOM element.

## `.value()`

Returns the list of tags as an array.

## `.destroy()`

Removes all event listeners, CSS classes, and DOM elements created by taggy. The input's `value` is set to the output of `.value()`. Once the instance is destroyed it becomes useless, and you'll have to call `taggy(input, options)` once again if you want to restore the behavior.

## Instance Events

The instance API comes with a few events.

Event | Arguments | Description
----|-------|------------
`add` | `data`, `el` | Emitted whenever a new item is added to the list
`remove` | `data` | Emitted whenever an item is removed from the list
`invalid` | `data`, `el` | Emitted whenever an invalid item is added to the list
`autocomplete.beforeSource` | none | Emitted before asking the autocomplete for a different source, useful to abort AJAX requests that are no longer necessary

You can listen to these events using the following API.

```js
var input = taggy(el);
input.on('add', data => console.log(data)); // listen to an event
input.once('invalid', data => throw new Error('invalid data')); // listener discarded after one execution

input.on('foo', bar);
input.off('foo', bar); // removes listener

function bar () {}
```

[1]: http://stackoverflow.com/questions/ask
[2]: https://github.com/bevacqua/rome
[3]: http://ponyfoo.com/articles/stop-breaking-the-web
[4]: http://i.imgur.com/mhy3Fv9.png
