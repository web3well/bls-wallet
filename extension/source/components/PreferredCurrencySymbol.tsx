import {
  CurrencyCny,
  CurrencyDollar,
  CurrencyEur,
  CurrencyGbp,
  CurrencyInr,
  CurrencyJpy,
  CurrencyKrw,
  CurrencyKzt,
  CurrencyNgn,
  CurrencyRub,
  IconProps,
} from 'phosphor-react';
import {
  ForwardRefExoticComponent,
  FunctionComponent,
  RefAttributes,
} from 'react';

import useCell from '../cells/useCell';
import { useQuill } from '../QuillContext';
import Loading from './Loading';

const SpecializedCurrencySymbols: Record<
  string,
  | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>
  | undefined
> = {
  CNY: CurrencyCny,
  EUR: CurrencyEur,
  GBP: CurrencyGbp,
  INR: CurrencyInr,
  JPY: CurrencyJpy,
  KRW: CurrencyKrw,
  KZT: CurrencyKzt,
  NGN: CurrencyNgn,
  RUB: CurrencyRub,
};

const PreferredCurrencySymbol: FunctionComponent<{ className?: string }> = ({
  className,
}) => {
  const quill = useQuill();
  const preferences = useCell(quill.cells.preferences);

  if (preferences === undefined) {
    return <Loading />;
  }

  const Symbol =
    SpecializedCurrencySymbols[preferences.currency] ?? CurrencyDollar;

  return <Symbol className={className} />;
};

export default PreferredCurrencySymbol;
