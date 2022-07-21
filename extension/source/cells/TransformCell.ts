import { EventEmitter } from 'events';

import { FormulaCell } from './FormulaCell';
import ICell, { CellEmitter, StrictPartial } from './ICell';
import mixtureHasChanged from './mixtureHasChanged';

export default class TransformCell<Input, T> implements ICell<Awaited<T>> {
  events = new EventEmitter() as CellEmitter<Awaited<T>>;
  ended: boolean;
  formulaCell: FormulaCell<{ input: ICell<Input> }, T>;

  constructor(
    public input: ICell<Input>,
    public mapInput: ($input: Input) => T,
    public mapResponse: (
      $input: Input,
      $output: Awaited<T>,
    ) => Input | Promise<Input>,
    public hasChanged: (
      previous: Awaited<T> | undefined,
      latest: Awaited<T>,
    ) => boolean = mixtureHasChanged,
  ) {
    this.ended = input.ended;

    this.formulaCell = new FormulaCell(
      { input },
      ({ $input }) => mapInput($input),
      hasChanged,
    );

    this.formulaCell.events.on('end', () => {
      this.ended = true;
      this.events.emit('end');
    });
  }

  async read(): Promise<Awaited<T>> {
    return await this.formulaCell.read();
  }

  async write(newValue: Awaited<T>) {
    await this.input.write(
      await this.mapResponse(await this.input.read(), newValue),
    );
  }

  async update(updates: StrictPartial<Awaited<T>>): Promise<void> {
    await this.write({ ...(await this.read()), ...updates });
  }

  [Symbol.asyncIterator]() {
    return this.formulaCell[Symbol.asyncIterator]();
  }

  /** Creates an ICell for the subscript of another ICell. */
  static Sub<Input extends Record<string, unknown>, K extends keyof Input>(
    input: ICell<Input>,
    key: K,
    hasChanged: (
      previous: Input[K] | undefined,
      latest: Input[K],
    ) => boolean = mixtureHasChanged,
  ): ICell<Input[K]> {
    return new TransformCell(
      input,
      ($input) => $input[key],
      ($input, $output) => ({ ...$input, [key]: $output }),
      hasChanged,
    );
  }

  /** Like Sub, but also maps undefined|null to defaultValue. */
  static SubWithDefault<
    Input extends Record<string, unknown>,
    K extends keyof Input,
  >(
    input: ICell<Input>,
    key: K,
    defaultValue: Exclude<Input[K], undefined | null>,
    hasChanged: (
      previous: Input[K] | undefined,
      latest: Input[K],
    ) => boolean = mixtureHasChanged,
  ): ICell<Exclude<Input[K], undefined | null>> {
    return new TransformCell(
      input,
      ($input) => $input[key] ?? defaultValue,
      ($input, $output) => ({ ...$input, [key]: $output }),
      hasChanged,
    );
  }
}
