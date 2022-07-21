import * as io from 'io-ts';

import { FormulaCell } from '../cells/FormulaCell';
import { IReadableCell } from '../cells/ICell';
import TimeCell from '../cells/TimeCell';
import Config from '../Config';
import assert from '../helpers/assert';
import optional from '../types/optional';

export const CurrencyConversion = io.type({
  from: io.string,
  to: optional(io.string),
  rate: optional(io.number),
});

export type CurrencyConversion = io.TypeOf<typeof CurrencyConversion>;

/**
 * We use these aliases because the api we use does not know about them and
 * ETH is a pretty good proxy. Ideally, we would use a data source which is
 * aware of this detail because if these networks run into trouble it could
 * cause their token value to diverge from ETH in a meaningful way.
 * (Conversely, scarcity of the L2 proxy coin could also cause its market value
 * to increase.)
 */
const currencyAliases: Record<string, string | undefined> = {
  ARETH: 'ETH',
  KOR: 'ETH',
};

// TODO: Expose a cell containing the currency pair and the conversion to avoid
// showing incorrect data temporarily when switching currencies.
export default function CurrencyConversionCell(
  config: Config['currencyConversion'],
  preferredCurrency: IReadableCell<string | undefined>,
  chainCurrency: IReadableCell<string>,
) {
  return new FormulaCell(
    {
      preferredCurrency,
      chainCurrency,
      time: TimeCell(config.pollInterval),
    },
    async ({ $preferredCurrency, $chainCurrency }) => ({
      from: $chainCurrency,
      to: $preferredCurrency,
      rate: await fetchRate(
        config.api,
        config.apiKey,
        $chainCurrency,
        $preferredCurrency,
      ),
    }),
  );
}

async function fetchRate(
  api: string,
  apiKey: string,
  chainCurrency: string,
  preferredCurrency: string | undefined,
): Promise<number | undefined> {
  if (preferredCurrency === undefined) {
    return undefined;
  }

  const mappedChainCurrency = currencyAliases[chainCurrency] ?? chainCurrency;

  const apiUrl = new URL(api);
  apiUrl.searchParams.append('fsym', mappedChainCurrency);
  apiUrl.searchParams.append('tsyms', preferredCurrency);
  apiUrl.searchParams.append('api_key', apiKey);

  const response = await fetch(apiUrl.toString()).then((res) => res.json());
  const rate = Number(response[preferredCurrency]);
  assert(Number.isFinite(rate));

  return rate;
}
