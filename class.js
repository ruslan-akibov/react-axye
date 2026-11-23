import React from 'react';
import { Immer } from 'immer';

const immer = new Immer({ autoFreeze: false });

const axe = '\u{1FA93}';
const WARNED_STORES = new Set();
const GLOBAL_CACHE = new Map();

const IGNORED_METHODS = new Set([
  'constructor',
  'render',
  'componentDidMount',
  'componentDidUpdate',
  'componentWillUnmount',
  'componentDidCatch',
  'setState',
  'forceUpdate',
  'shouldComponentUpdate',
  'getSnapshotBeforeUpdate',
]);

export default class Axye extends React.Component {
  static get Context() {
    if (!Object.hasOwn(this, '_AxyeContext')) {
      this._AxyeContext = React.createContext(null);
    }
    return this._AxyeContext;
  }

  _listeners = new Set();
  _subscribe = (listener) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  _snapshot = null;
  _stateSnapshot = () => {
    if (this._snapshot === null) {
      const StoreClass = this.constructor;

      if (!WARNED_STORES.has(StoreClass)) {
        console.error(`[${axe} ${StoreClass.name}] The compiler plugin is not configured, or the entire Store/state is being used. This may cause unnecessary re-renders and severe performance degradation.`);
        WARNED_STORES.add(StoreClass);
      }

      this._snapshot = { ...this.state };
    }
    return this._snapshot;
  };

  constructor(props = {}, context) {
    super(props, context);
    this.state = this.state || {};
    this._contextProvider = this.constructor.Context.Provider;

    this._customRender = typeof this.render === 'function' ? this.render : () => this.props.children;
    this.render = this._render;

    const methodsToBind = new Set();
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Axye.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (IGNORED_METHODS.has(name) || name.startsWith('_')) {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (descriptor && typeof descriptor.value === 'function') {
          methodsToBind.add(name);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }

    for (const name of methodsToBind) {
      this[name] = this[name].bind(this);
    }

    if (arguments.length < 2) {
      const StoreClass = this.constructor;

      if (typeof window === 'undefined' || !window?.document) {
        throw new Error(`[${axe} ${StoreClass.name}] Global store instances are not supported on SSR. Render <${StoreClass.name} ... /> within the React tree instead.`);
      }

      if (GLOBAL_CACHE.has(StoreClass)) {
        console.error(`[${axe} ${StoreClass.name}] Global store instance already exists and will be overwritten. Make sure you didn't instantiate it twice unintentionally.`);
      }

      GLOBAL_CACHE.set(StoreClass, this);

      if (typeof this.componentDidMount === 'function') {
        queueMicrotask(() => {
          this.componentDidMount();
        });
      }
    }
  }

  static _globalInstance(props) {
    return GLOBAL_CACHE.get(this) || new this(props);
  }

  setState(updater, callback) {
    if (typeof updater === 'function') {
      Object.assign(
        this.state,
        immer.produce(this.state, (draft) => {
          const result = updater(draft, this.props);
          if (result && typeof result === 'object') {
            Object.assign(draft, result);
          }
        }),
      );
    } else if (updater && typeof updater === 'object') {
      Object.assign(this.state, updater);
    }

    this._snapshot = null;

    this._listeners.forEach((listener) => listener());
    if (callback) callback();
  }

  _render() {
    return React.createElement(this._contextProvider, { value: this }, this._customRender());
  }
}
