export default function track(originalMethod, context) {
  const methodName = context.name;
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
