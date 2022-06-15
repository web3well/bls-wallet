import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';

export default function approximate(
  value: IReadableCell<number>,
  accuracy: number,
): IReadableCell<number> {
  return new FormulaCell<{ value: IReadableCell<number> }, number>(
    { value },
    ({ $value }) => $value,
    (previous, latest) => {
      if (previous === undefined) {
        return true;
      }

      return Math.abs(latest - previous) >= accuracy;
    },
  );
}
