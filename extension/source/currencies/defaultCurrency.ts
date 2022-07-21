import * as io from 'io-ts';

import assertType from '../cells/assertType';

export default async function defaultCurrency(): Promise<string> {
  try {
    const ipBasedCurrencyJson = await fetch(
      'http://ip-api.com/json/?fields=currency',
    ).then((res) => res.json());

    assertType(ipBasedCurrencyJson, io.type({ currency: io.string }));

    return ipBasedCurrencyJson.currency;
  } catch (error) {
    console.error('Failed to retrieve currency from ip api', error);
  }

  // We don't really expect this to happen very often, but perhaps choosing a
  // currency based on navigator.language could be an improvement.
  return 'USD';
}
