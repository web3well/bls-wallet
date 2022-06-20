/* eslint-disable @typescript-eslint/naming-convention */

import * as io from 'io-ts';
import { ethers } from 'ethers';

import { ProviderConfig } from './networks';
import { IReadableCell } from '../cells/ICell';
import { FormulaCell } from '../cells/FormulaCell';
import approximate from '../cells/approximate';
import { RandomId } from './utils';
import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import QuillCells from '../QuillCells';
import toOkError from '../helpers/toOkError';

const Object_ = io.record(io.string, io.unknown);
type Object_ = io.TypeOf<typeof Object_>;

// TODO: This should be in Rpc.ts
const RpcMessage = io.type({
  method: io.string,
  params: io.array(io.unknown),
  id: io.string,
});

type RpcMessage = io.TypeOf<typeof RpcMessage>;

export default class NetworkController
  implements ethers.providers.ExternalProvider
{
  // TODO: Move / deduplicate these cells
  ticker: IReadableCell<string>;
  chainId: IReadableCell<string>;
  blockNumber: IReadableCell<number>;
  providerConfig: IReadableCell<ProviderConfig>;

  constructor(
    public network: QuillCells['network'],
    time: IReadableCell<number>,
  ) {
    this.ticker = new FormulaCell(
      { network: this.network },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ network }) => network.providerConfig.ticker,
    );

    this.chainId = new FormulaCell(
      { network: this.network },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ network }) => network.chainId,
    );

    this.blockNumber = new FormulaCell(
      {
        networkState: this.network,
        time: approximate(time, 20_000),
      },
      () => this.fetchBlockNumber(),
    );

    this.providerConfig = new FormulaCell(
      { network: this.network },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ network }) => network.providerConfig,
    );
  }

  async requestStrict(body: RpcMessage) {
    const { rpcTarget } = await this.providerConfig.read();

    const res = await fetch(rpcTarget, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      body: JSON.stringify({
        method: body.method,
        jsonrpc: '2.0',
        id: body.id,
        params: body.params,
      }),
    });

    const json = await toOkError(() => res.json());
    assert('ok' in json);

    return json.ok.result;
  }

  async request(body: unknown) {
    assertType(body, Object_);
    body.id ??= RandomId();
    assertType(body, RpcMessage);
    return await this.requestStrict(body);
  }

  private async fetchBlockNumber() {
    const res = await this.requestStrict({
      method: 'eth_blockNumber',
      id: RandomId(),
      params: [],
    });
    assertType(res, io.string);
    const resNumber = Number(res);
    assert(Number.isFinite(resNumber));
    return resNumber;
  }
}