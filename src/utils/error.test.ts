import { describe, expect, it } from 'vitest';
import { getErrorMessage, getErrorMessageIfThrows } from './error';

describe('error util', () => {
  describe('getErrorMessage', () => {
    it('reads the message of a string, an error, or an object with a message', () => {
      expect(getErrorMessage('message')).to.equal('message');
      expect(getErrorMessage(new Error('message'))).to.equal('message');
      expect(getErrorMessage({ message: 'message' })).to.equal('message');
    });

    it('falls back to a generic message for any other value', () => {
      expect(getErrorMessage(42)).to.equal('An error has occurred.');
    });
  });

  describe('getErrorMessageIfThrows', () => {
    it('get an error message if the callback throws, undefined instead', () => {
      expect(
        getErrorMessageIfThrows(() => {
          // eslint-disable-next-line no-throw-literal
          throw 'message';
        }),
      ).to.equal('message');

      expect(
        getErrorMessageIfThrows(() => {
          throw new Error('message');
        }),
      ).to.equal('message');

      expect(
        getErrorMessageIfThrows(() => {
          // eslint-disable-next-line no-throw-literal
          throw { message: 'message' };
        }),
      ).to.equal('message');

      expect(getErrorMessageIfThrows(() => {})).to.equal(undefined);
    });
  });
});
