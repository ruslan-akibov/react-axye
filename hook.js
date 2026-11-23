import React from 'react';

const defaultSelector = (store) => store._stateSnapshot();

function useAxyeMethods(StoreClass) {
  return React.useContext(StoreClass.Context) || StoreClass._globalInstance();
}

function useAxye(StoreClass, selector = defaultSelector) {
  const store = useAxyeMethods(StoreClass);
  const getSnapshot = React.useCallback(() => selector(store), [store, selector]);
  const state = React.useSyncExternalStore(store._subscribe, getSnapshot, getSnapshot);

  return (selector === defaultSelector) ? store : state;
}

useAxye.useMethods = useAxyeMethods;
export default useAxye;
