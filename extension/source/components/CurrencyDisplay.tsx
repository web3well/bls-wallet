import { FunctionComponent } from 'react';
import { IReadableCell } from '../cells/ICell';
import useCell from '../cells/useCell';
import useCellish from '../cells/useCellish';
import { useQuill } from '../QuillContext';
import Loading from './Loading';

const CurrencyDisplay: FunctionComponent<{
  chainValue: number | IReadableCell<number>;
  includeLabel?: boolean;
}> = ({ chainValue, includeLabel = true }) => {
  const quill = useQuill();
  const currencyConversion = useCell(quill.cells.currencyConversion);
  const concreteChainValue = useCellish(chainValue);

  if (
    currencyConversion?.to === undefined ||
    currencyConversion.rate === undefined ||
    concreteChainValue === undefined
  ) {
    return <Loading />;
  }

  return (
    <>
      {Intl.NumberFormat().format(
        Number((concreteChainValue * currencyConversion.rate).toFixed(2)),
      )}
      {includeLabel && <> {currencyConversion.to}</>}
    </>
  );
};

export default CurrencyDisplay;
