const axe = '\u{1FA93}';

export default function track(arg1, arg2, arg3) {
  if (arg2 && typeof arg2 === 'object' && 'kind' in arg2) {
    if (arg2.kind !== 'method') {
      throw new TypeError(`[${axe} @track] Decorator can only be applied to class methods.`);
    }
    return createTrackedMethod(arg1, String(arg2.name));
  }

  if (arg3 && typeof arg3 === 'object' && 'value' in arg3) {
    if (typeof arg3.value !== 'function') {
      throw new TypeError(`[${axe} @track] Decorator can only be applied to class methods.`);
    }
    arg3.value = createTrackedMethod(arg3.value, String(arg2));
    return arg3;
  }

  throw new TypeError(`[${axe} @track] Decorator was called with unsupported arguments or environment.`);
}

function createTrackedMethod(originalMethod, methodName) {
  const loadingKey = `${methodName}Loading`;
  const errorKey = `${methodName}Error`;

  return async function (...args) {
    this.setState({
      [loadingKey]: true,
      [errorKey]: null,
      isLoading: true
    });

    const finalize = (err = null) => {
      const state = this.state || {};
      const hasOtherLoadings = Object.keys(state).some(
        (k) => k !== loadingKey && k !== 'isLoading' && k.endsWith('Loading') && state[k] === true
      );

      this.setState({
        [loadingKey]: false,
        isLoading: hasOtherLoadings,
        [errorKey]: err
      });
    };

    try {
      const result = await originalMethod.apply(this, args);
      finalize();
      return result;
    } catch (err) {
      finalize(err);
      throw err;
    }
  };
}
