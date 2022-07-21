import React from 'react';
import Blockies from 'react-blockies';
import { ArrowRight } from 'phosphor-react';
import { ethers } from 'ethers';
import { SendTransactionParams } from '../types/Rpc';
import formatCompactAddress from '../helpers/formatCompactAddress';
import { useInputDecode } from '../hooks/useInputDecode';
import CurrencyDisplay from '../components/CurrencyDisplay';

const TransactionCard: React.FC<SendTransactionParams> = ({
  data,
  from,
  to,
  value,
  gas,
  gasPrice,
}) => {
  const { loading, method } = useInputDecode(data || '0x', to);

  return (
    <div className="bg-white rounded-md p-4 border border-blue-400">
      <div className="flex gap-4 w-full justify-between">
        <Blockies seed={from} className="rounded-md" size={5} scale={8} />
        <div className="flex justify-between flex-grow align-middle">
          <div className="leading-snug">
            <div>from</div>
            <div className="font-bold">{formatCompactAddress(from)}</div>
          </div>
          <ArrowRight size={20} alignmentBaseline="central" />
          <div className="leading-snug">
            <div>to</div>
            <div className="font-bold">{formatCompactAddress(to)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="break-all">
          details:{' '}
          <span className="font-bold">{loading ? 'loading...' : method}</span>
          <div className="text-[9pt] font-normal">{data}</div>
        </div>
      </div>

      <div className="flex mt-6 gap-3">
        <div className="w-60 border-r border-grey-400">
          <div>Value</div>
          <div className="break-all text-[9.5pt] font-bold">
            {ethers.utils.formatEther(value || '0x0')} ETH
          </div>
        </div>

        <div className="w-60 border-r border-grey-400">
          <div>Gas Price</div>
          <div className="break-all text-[9.5pt] font-bold">
            {ethers.utils.formatUnits(gasPrice || '0x0', 'gwei')} gwei
          </div>
        </div>

        <div className="w-60">
          <div>Gas usage</div>
          <div className="break-all text-[9.5pt] font-bold">
            {ethers.utils.formatUnits(gas || '0x0', 'wei')} wei
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;
