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

If client-side JavaScript never executes, because its disabled or too slow [_(on intermittent mobile network connections, for example)_][3], you should treat user input as a delimited list of tags. When JavaScript does execute, you should consider sending tags as a single string and splitting them on the server-side, for consistency.

### `taggy.find(input)`

Retrieves a previously created instance of taggy associated with the provided `input`. Returns `null` if none can be found.

### `taggy(input, options={})`

taggy exposes a function to turn an input into a tag list input. Empty spans will be added on both sides of your input element.

A few options may be provided. They are detailed below.

###### `deletion`

When `true`, humans will be able to delete individual tags by clicking on an icon.

###### `delimiter`

The separator between tags. Defaults to `' '`. Must be a single character.

###### `render(container, text)`

A method that's called whenever a tag should be rendered. Defaults to the method below.

```js
function render (container, text) {
  container.innerText = container.textContent = text;
}
```

###### `readTag(el)`

This is called whenever the tag has to be converted back to text. By default the text contents of the DOM element are returned, but you may have a more complicated DOM structure that demands you return the textual tag personally.

```js
function readTag (el) {
  return el.innerText || el.textContent;
}
```

###### `parse(value)`

A method that's called whenever user input is evaluated as a tag. Useful to transform user input. Defaults to the method below.

```js
function parse (value) {
  return value.trim().toLowerCase();
}
```

###### `validate(value, tags)`

A method that validates whether the _(previously `parse`d)_ user input `value` constitutes a valid tag, taking into account the currently valid `tags`. Useful to filter out duplicates. Defaults to the method below.

```js
function validate (value, tags) {
  return tags.indexOf(value) === -1;
}
```

Note that `tags` is only a copy and modifying it won't affect the list of tags.

###### `convertOnFocus`

By default tags are converted whenever the `focus` event fires on elements other than `input`. Defaults to `true`, set to `false` to disable.

# API

When you call `taggy(input, options)`, you'll get back a tiny API to interact with the instance. Calling `taggy` repeatedly on the same DOM element will have no effect, and it will return the same API object.

### `.tags()`

Returns an array with the tags currently held by the input. Any "partial" tags _(e.g, not extracted from the input)_ will be returned as well.

### `.value()`

Returns the input value as a delimited list of tags. This is the recommended format in which you should send values to the server, because of progressive enhancement.

### `.convert(everything=false)`

Parses text to the left of the caret into tags. If `everything` was true, it'll parse everything into tags instead. Useful for binding your own event handlers and deciding when to convert text into tags.

### `.destroy()`

Removes all event listeners, CSS classes, and DOM elements created by taggy. The input's `value` is set to the output of `.values()`. Once the instance is destroyed it becomes useless, and you'll have to call `taggy(input, options)` once again if you want to restore the behavior.

# Events

Once you've instantiated a `taggy`, some propietary synthetic events will be emitted on the provided `input`.

Name                 | Description
---------------------|---------------------------------------------------------------------------------
`taggy-converted`    | Fired after a tag has been converted
`taggy-evaluated`    | Fired after a tag has been converted or the input moved to edit another tag

[1]: http://stackoverflow.com/questions/ask
[2]: https://github.com/bevacqua/rome
[3]: http://ponyfoo.com/articles/stop-breaking-the-web
[4]: http://i.imgur.com/mhy3Fv9.png
