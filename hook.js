import React from 'react';

const axe = '\u{1FA93}'; 

const GLOBAL_CACHE = new Map();
const WARNED_STORES = new Set();

const defaultSelector = (store) => store;

function useAxyeMethods(StoreClass) {
  let store = React.useContext(StoreClass.Context);
  
  if (!store) {
    if (typeof window === 'undefined') {
      throw new Error(`[${axe} ${StoreClass.name}] Provider not found.`);
    }

    if (!GLOBAL_CACHE.has(StoreClass)) {
      const globalInstance = new StoreClass({});
      if (typeof globalInstance.componentDidMount === 'function') {
        globalInstance.componentDidMount();
      }
      GLOBAL_CACHE.set(StoreClass, globalInstance);
    }
    
    store = GLOBAL_CACHE.get(StoreClass);
  }
  
  return store;
}

function useAxye(StoreClass, selector = defaultSelector) {
  const store = useAxyeMethods(StoreClass);

  if (selector === defaultSelector) {
    if (!WARNED_STORES.has(StoreClass)) {
      console.error(`[${axe} ${StoreClass.name}] Plugin not configured.`);
      WARNED_STORES.add(StoreClass);
    }
  }

  const getSnapshot = React.useCallback(() => selector(store), [store, selector]);

  return React.useSyncExternalStore(store._subscribe, getSnapshot, getSnapshot);
}

useAxye.useMethods = useAxyeMethods;
export default useAxye;
