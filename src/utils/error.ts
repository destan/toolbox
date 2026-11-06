import _ from 'lodash';

export { getErrorMessage, getErrorMessageIfThrows };

function getErrorMessage(err: unknown) {
  if (_.isString(err)) {
    return err;
  }

  if (_.isError(err)) {
    return err.message;
  }

  if (_.isObject(err) && _.has(err, 'message')) {
    return (err as { message: string }).message;
  }

  return 'An error has occurred.';
}

function getErrorMessageIfThrows(cb: () => unknown) {
  try {
    cb();
    return undefined;
  }
  catch (err) {
    return getErrorMessage(err);
  }
}
