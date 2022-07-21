import * as React from 'react';
import { ShareNetwork, PokerChip, Wallet } from 'phosphor-react';
import onAction from '../../../helpers/onAction';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import PreferredCurrencySymbol from '../../../components/PreferredCurrencySymbol';

interface IConnectionsSummary {
  onAction: () => void;
  expanded?: boolean;
}

const totalChainValue = 2.089; // ETH

export const ConnectionsSummary: React.FunctionComponent<
  IConnectionsSummary
> = ({ onAction: onActionParam, expanded = true }) => (
  <div
    className={`p-4 rounded-lg
      ${expanded && 'bg-white border-2 border-blue-500 shadow-xl'}
    `}
  >
    <div className="flex place-items-center gap-4 ">
      <div className="w-5 h-5">
        <input
          type="radio"
          checked={expanded}
          readOnly
          className="h-5 w-5 cursor-pointer"
          {...onAction(onActionParam)}
        />
      </div>

      <div className="flex-grow">All Wallets</div>

      <div className="text-body">{totalChainValue} ETH</div>
    </div>

    {/* Details */}
    {expanded && (
      <div className="mt-6">
        <div className="mt-4 flex flex-col gap-1">
          <div className="flex gap-2 place-items-center">
            <PreferredCurrencySymbol className="text-blue-400 icon-md" />
            <CurrencyDisplay chainValue={totalChainValue} />
          </div>
          <div className="flex gap-2 place-items-center">
            <ShareNetwork className="text-blue-400 icon-md" />3 Networks
          </div>
          <div className="flex gap-2 place-items-center">
            <Wallet className="text-blue-400 icon-md" />2 Wallets
          </div>
          <div className="flex gap-2 place-items-center">
            <PokerChip className="text-blue-400 icon-md" /> 2 Tokens
          </div>
        </div>
      </div>
    )}
  </div>
);
