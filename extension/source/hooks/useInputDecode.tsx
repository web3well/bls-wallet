import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import axios from 'axios';

import assert from '../helpers/assert';
import { useQuill } from '../QuillContext';
import { IReadableCell } from '../cells/ICell';

const getParitySigRegistry = async (
  provider: IReadableCell<ethers.providers.Provider>,
) => {
  const address = '0x44691B39d1a75dC4E0A0346CBB15E310e6ED1E86';
  const abi = [
    {
      constant: true,
      inputs: [{ name: '', type: 'bytes4' }],
      name: 'entries',
      outputs: [{ name: '', type: 'string' }],
      payable: false,
      type: 'function',
    },
  ];

  return new ethers.Contract(address, abi, await provider.read());
};

const getMethodFromOnChainRegistry = async (
  data: string,
  provider: IReadableCell<ethers.providers.Provider>,
) => {
  if (data === '0x') return 'SENDING ETH';

  const methodID = ethers.utils.hexDataSlice(data, 0, 4);
  const registry = await getParitySigRegistry(provider);

  return registry.entries(methodID);
};

const getMethodFromEtherscan = async (to: string, data: string) => {
  const res = await axios.get(
    `https://api.etherscan.io/api?module=contract&action=getabi&address=${to}`,
  );

  if (res.data.result !== 'Contract source code not verified') {
    const iface = new ethers.utils.Interface(res.data.result);
    return iface.parseTransaction({ data, value: 1 }).name;
  }

  assert(false, () => new Error('Unverified Contract'));
};

const formatMethod = (method: string) =>
  method
    .split('(')[0]
    .replace(/([a-z](?=[A-Z]))/g, '$1 ')
    .toUpperCase();

type UseInputDecodeValues = {
  loading: boolean;
  method: string;
};

export const useInputDecode = (
  functionData: string,
  to: string,
): UseInputDecodeValues => {
  const quill = useQuill();

  const [loading, setLoading] = useState<boolean>(true);
  const [method, setMethod] = useState<string>('CONTRACT INTERACTION');

  useEffect(() => {
    const getMethod = async () => {
      setLoading(true);

      const data = functionData?.replace(/\s+/g, '');

      try {
        const registryPromise = getMethodFromOnChainRegistry(
          data,
          quill.ethersProvider,
        );
        const etherScanPromise = getMethodFromEtherscan(to, data);
        const rawMethod = (await registryPromise) ?? (await etherScanPromise);
        if (rawMethod) {
          setMethod(formatMethod(rawMethod));
        }
      } catch (error) {
        console.log({ error });
      }

      setLoading(false);
    };

    if (functionData) {
      getMethod();
    }
  }, [functionData, to, quill]);

  return { loading, method };
};
