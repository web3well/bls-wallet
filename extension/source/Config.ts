import * as io from 'io-ts';

import configJson from '../config.json';
import { ProviderConfig } from './background/ProviderConfig';
import assertType from './cells/assertType';
import optional from './types/optional';

const Config = io.type({
  defaultNetwork: io.string,
  currencyConversion: io.type({
    api: io.string,
    apiKey: io.string,

    // Note: We can afford to poll relatively frequently because we only fetch
    // currency information when we actually need it, via the magic of cells.
    // TODO: Enable even more aggressive polling intervals by tying
    // `LongPollingCell`s to user activity (mouse movement, etc). This would
    // require some visible indication that the value is not being updated
    // though (like a grey filter) so that if you keep the window open on the
    // side of your screen you can get an indication that the value isn't
    // being kept up to date.
    pollInterval: io.number,
  }),
  builtinNetworks: io.record(io.string, optional(ProviderConfig)),
});

type Config = io.TypeOf<typeof Config>;

export function loadConfig(): Config {
  assertType(configJson, Config);

  return configJson;
}

export default Config;
