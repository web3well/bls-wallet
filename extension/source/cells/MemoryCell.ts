import { EventEmitter } from 'events';
import assert from '../helpers/assert';
import CellIterator from './CellIterator';

import ICell, { CellEmitter, StrictPartial } from './ICell';
import mixtureHasChanged from './mixtureHasChanged';

export default class MemoryCell<T> implements ICell<Awaited<T>> {
  events = new EventEmitter() as CellEmitter<Awaited<T>>;
  ended = false;
  #valueLike: Promise<Awaited<T>>;

  constructor(
    valueLike: T,
    public hasChanged: ICell<Awaited<T>>['hasChanged'] = mixtureHasChanged,
  ) {
    this.#valueLike = Promise.resolve(valueLike) as Promise<Awaited<T>>;
  }

  async read(): Promise<Awaited<T>> {
    return await this.#valueLike;
  }

  async write(newValueLike: T | Awaited<T>): Promise<void> {
    assert(!this.ended);

    const previous = await this.#valueLike;
    this.#valueLike = Promise.resolve(newValueLike) as Promise<Awaited<T>>;
    const newValue = await newValueLike;

    if (this.hasChanged(previous, newValue)) {
      this.events.emit('change', {
        previous,
        latest: newValue,
      });
    }
  }

  async update(updates: StrictPartial<Awaited<T>>): Promise<void> {
    await this.write({ ...(await this.read()), ...updates });
  }

  end() {
    this.events.emit('end');
    this.ended = true;
  }

  [Symbol.asyncIterator](): AsyncIterator<Awaited<T>> {
    return new CellIterator<Awaited<T>>(this);
  }
}
