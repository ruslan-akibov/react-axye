
<p align="center">
  <img src="./logo.svg" alt="axye" width="128" />
</p>

# Axye

> 🪓 This is an experimental library. Please ensure you have read the source code and fully understand what is happening under the hood before using it in any production-ready or real-world projects.

A fresh take on state management. Let's prepare the staff. We'll blend:
* Granular updates inspired by Zustand or RTK
* The simplicity of Context
* A pinch of MobX or Immer magic

Are you ready for some real ancient sorcery? 


## Class

Imagine you have a `React.Component` and you want to use its `state` as a *Store*:

```js
import { Axye } from 'react-axye';

class MyStore extends Axye {
  state = {
    value: '',
    count: 0
  };

  setValue(value) {
    this.setState({ value });
  }
  
  incCount() {
    this.setState(s => s.count++);
  }
}
```
* You can omit the `render` method entirely.
* `setState` works synchronously, without triggering any lifecycle hooks or re-renders.
* Immer is supported out of the box when using the functional form of `setState`.

## Hook 

Imagine you would like to use this *Store* in several places:

```js
import { useAxye } from 'react-axye';

function First() {
  const { state: { count }, incCount } = useAxye(MyStore);
  
  return <button onClick={incCount}>{count}</button>;
}
```
In this example, the component will render only when `count` changes, but **not** when `value` changes - the compiler (see below) will create granular selectors for you.


## React

Since your *Store* is a `React.Component`, you can use it in any way possible:

```jsx
<MyStore>
  ...
    <First />
</MyStore>
```
* You can have any number of *Stores* in your application, arranged in any order - the nearest store of the required type will be used, just like with `React.Context`.
* You can omit *Store* rendering entirely - in this case, a global persistent instance will be created.


## Track

To handle loading states and errors, you can use the `@track` decorator:
```ts
import { Axye, track } from 'react-axye';

interface MyStoreState {
  value: string;
  count: number;
}

class MyStore extends Axye<unknown, MyStoreState> {
  ...

  @track
  async clearValue() {
    await new Promise((r) => setTimeout(r, 1000));

    this.setState((s) => {
      s.count--;
      return { value: '' };
    });
  }
}
```

Then, you can use the corresponding `...Loading` and `...Error` values:
```js
function Second() {
  const { state: { clearValueLoading, clearValueError }, clearValue } = useAxye(MyStore);
  
  return <button disabled={clearValueLoading} onClick={clearValue}>clear</button>;
}
```

The global `isLoading` state is available as well.

## Plugin

Please place the compiler after all other plugins.
> ⚠️ You also need to configure modern decorators if you want to use `@track`.

* `react-axye/babel` - if you are using Babel:
```json
{
  "presets": [
    ["@babel/preset-typescript", { "isTSX": true, "allExtensions": true }]
  ],
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "version": "2023-11" }],

    "react-axye/babel"
  ]
}
```

* `react-axye/vite` - if you are using Vite:
```js
import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel'; // You should have this plugin
import react from '@vitejs/plugin-react';
import axye from 'react-axye/vite';

export default defineConfig({
  plugins: [
    babel({
      plugins: [
        ["@babel/plugin-proposal-decorators", { version: "2023-11" }]
      ]
    }),
    react(),

    axye()
  ]
});
```


## Magic

Under the hood, the compiler creates granular static selectors (or memoized ones, if you are using dynamic keys). It then subscribes them via `useSyncExternalStore` to a provider, which is a static `React.Context` rendered by your *Store*. The store's `setState` method is overridden so that it doesn't trigger a full re-render, but instead directly notifies the subscribers.


## Limitations

* Destructuring only the `state`, such as `const { state } = useAxye(...)` will not be reactive. You must access specific properties from `state` to trigger reactivity.

* Array rest patterns, such as `const { state: { items: [ first, ...rest ] } } = useAxye(...)` are not supported yet.

* Global *Store* instances are not supported with server-side rendering.
