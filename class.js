import React from 'react';
import { Immer } from 'immer';

const immer = new Immer({ autoFreeze: false });

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

  constructor(props) {
    super(props);
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

    this._listeners.forEach((listener) => listener());
    if (callback) callback();
  }

  _render() {
    return React.createElement(this._contextProvider, { value: this }, this._customRender());
  }
}
