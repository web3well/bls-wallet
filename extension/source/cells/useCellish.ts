import { useEffect, useState } from 'react';
import assert from '../helpers/assert';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import AsyncReturnType from '../types/AsyncReturnType';
import ExplicitAny from '../types/ExplicitAny';
import forEach from './forEach';

import { IReadableCell } from './ICell';

/**
 * Like useCell but also accepts plain values.
 *
 * (When you don't know which one you have, this kind of thing is required to
 * play nicely with react hooks (avoiding conditional use).)
 */
export default function useCellish<C>(cellishParam: C) {
  type T = C extends { read: (...args: ExplicitAny[]) => unknown }
    ? AsyncReturnType<C['read']>
    : C;

  const isCell = typeof getPropOrUndefined(cellishParam, 'read') === 'function';

  if (isCell) {
    assert(
      typeof getPropOrUndefined(cellishParam, Symbol.asyncIterator) ===
        'function',
    );
  }

  const [value, setValue] = useState<T | undefined>(
    isCell ? undefined : (cellishParam as unknown as T),
  );

  useEffect(() => {
    if (isCell) {
      const cell = cellishParam as unknown as IReadableCell<T>;

      const { stop } = forEach(cell, setValue);

      return () => {
        setValue(undefined);
        stop();
      };
    }
  }, [cellishParam, isCell]);

  return value;
}
