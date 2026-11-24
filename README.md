
<p align="center">
  <img src="https://github.com/ruslan-akibov/react-axye/raw/main/logo.svg" alt="axye" width="128" />
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
import { Axye } from 'axye';

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
import { useAxye } from 'axye';

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
* You can omit *Store* rendering entirely - in this case, a global persistent instance will be created automatically.
* Alternatively, you can create a global *Store* manually somewhere in your code, such as `new MyStore({ ... })`.


## Track

To handle loading states and errors, you can use the `@track` decorator:
```ts
import { Axye, track } from 'axye';

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
> ⚠️ Make sure decorators are enabled in your build setup.

Then, you can use the corresponding `...Loading` and `...Error` values:
```js
function Second() {
  const { state: { clearValueLoading, clearValueError }, clearValue } = useAxye(MyStore);
  
  return <button disabled={clearValueLoading} onClick={clearValue}>clear</button>;
}
```

The global `isLoading` state is available as well.


## Plugin

Typically, the compiler plugin should be placed last in your plugins list.  

`axye/babel` - if you are using Babel:
```json
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "version": "2023-11" }],
    "axye/babel"
  ]
}
```

`axye/vite` - if you are using Vite:
```js
// Requires @rolldown/plugin-babel to be installed
import axye from 'axye/vite';

export default defineConfig({
  plugins: [
    react(),
    axye()
  ]
});
```


## Caveats

⛔ `const { state } = useAxye(MyStore)`  
Destructuring the entire `state` may cause unnecessary re-renders and severe performance degradation. Prefer accessing specific properties instead.  
Using the *Store* instance directly, like `const store = useAxye(MyStore)`, or misconfiguring the compiler plugin will lead to the same issue.

✅ `const { clearValue } = useAxye(MyStore)`  
If you do not access `state`, the component will not be reactive and will never re-render.

❌ `const { state: { value, ...rest } } = useAxye(MyStore)`  
Rest patterns on `state` are not supported yet.

✅ `const { ...store } = useAxye(MyStore)`  
Top-level rest patterns have special support: `store` will refer to your *Store* instance, and the component will not become reactive unless you also destructure `state`.

✅ `const { state: { value = 111 } } = useAxye(MyStore)`  
Default values are supported on leaf properties and apply to both `undefined` and `null` values.

✅ `const value = useAxye(MyStore, s => s.computedValue)`  
Custom selectors are supported even without the compiler plugin, provided you ensure stable return values.

❌ Global *Store* instances are not supported with server-side rendering; you should render the *Store* within the React tree instead.


## Magic

Under the hood, the compiler finds `useAxye` hooks and creates granular static selectors (or memoized ones, if you are using dynamic keys). It then subscribes them via `useSyncExternalStore` to a provider, which is a static `React.Context` rendered by your *Store*. The store's `setState` method is overridden so that it doesn't trigger a full re-render, but instead directly notifies the subscribers.


## Example

You might want to check out the [sample project](https://github.com/ruslan-akibov/axye-sample) to see how it works with Webpack and Vite.
