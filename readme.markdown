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

### `taggy(input, options={})`

Taggy exposes a function to turn an input into a tag list input. Empty spans will be added on both sides of your input element.

A few options may be provided. They are detailed below.

###### `deletion`

When `true`, humans will be able to delete individual tags by clicking on an icon.

###### `delimiter`

The separator between tags. Defaults to `' '`. Must be a single character.

###### `render(container, item)`

A method that's called whenever a tag should be rendered. Defaults to the method below.

```js
function render (container, item) {
  container.innerText = container.textContent = item;
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

### `.value()`

Returns the list of tags as an array.

### `.destroy()`

Removes all event listeners, CSS classes, and DOM elements created by taggy. The input's `value` is set to the output of `.value()`. Once the instance is destroyed it becomes useless, and you'll have to call `taggy(input, options)` once again if you want to restore the behavior.

[1]: http://stackoverflow.com/questions/ask
[2]: https://github.com/bevacqua/rome
[3]: http://ponyfoo.com/articles/stop-breaking-the-web
[4]: http://i.imgur.com/mhy3Fv9.png
