import * as React from 'react';
import Blockies from 'react-blockies';
import {
  Copy,
  PaperPlaneTilt,
  // ShareNetwork,
  // PokerChip,
  // Circle,
} from 'phosphor-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/Button';
import type { IWallet } from './WalletWrapper';
import Balance from './Balance';
import onAction from '../../../helpers/onAction';
import formatCompactAddress from '../../../helpers/formatCompactAddress';

interface IWalletSummary {
  onAction: () => void;
  expanded?: boolean;
  wallet: IWallet;
}

export const WalletSummary: React.FunctionComponent<IWalletSummary> = ({
  onAction: onActionParam,
  expanded = false,
  wallet,
}) => {
  const navigate = useNavigate();

  return (
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

        <div className="flex-grow flex place-items-center gap-2">
          <Blockies
            seed={wallet.address}
            className="rounded-md"
            size={5}
            scale={8}
          />
          <div>
            {wallet.name}
            <div
              className="text-[8pt] bg-blue-100 bg-opacity-40
              active:bg-opacity-70 cursor-pointer text-blue-600 rounded-full
              px-2 flex place-items-center gap-2 w-28"
              {...onAction(() => navigator.clipboard.writeText(wallet.address))}
            >
              {formatCompactAddress(wallet.address)}{' '}
              <Copy className="text-[10pt]" />
            </div>
          </div>
        </div>

        <div className="text-body">
          <Balance address={wallet.address} />
        </div>
      </div>

      {/* Details */}
      {expanded && (
        <div className="mt-6">
          <div className="flex gap-2">
            <Button
              onPress={() => navigate('/wallets/send')}
              className="btn-primary"
              icon={<PaperPlaneTilt className="icon-md" />}
            >
              Send
            </Button>
            <Button onPress={() => {}} className="btn-secondary">
              Receive
            </Button>
          </div>

          {/* <div className="mt-4 flex flex-col gap-1">
            <div className="flex gap-2 place-items-center">
              <PreferredCurrencySymbol className="text-blue-400 icon-md" />
              USD $
              {wallet.ether * 3000.1}
            </div>
            <div className="flex gap-2 place-items-center">
              <ShareNetwork className="text-blue-400 icon-md" />{' '}
              {wallet.networks} Networks
            </div>
            <div className="flex gap-2 place-items-center">
              {[
                <PokerChip className="text-blue-400 icon-md" />,
                ' ',
                wallet.tokens,
                ' Tokens',
              ]}
            </div>
          </div> */}

          {/* <div className="mt-4 flex flex-col gap-3">
            <div
              className={[
                'bg-blue-100',
                'bg-opacity-30',
                'px-4',
                'py-2',
                'flex',
                'gap-2',
                'place-items-center',
                'rounded-md'
              ].join(' ')}
            >
              <Circle weight="fill" fill="#689F38" />
              Uniswap
            </div>
            <div
              className={[
                'bg-blue-100',
                'bg-opacity-30',
                'px-4',
                'py-2',
                'flex',
                'gap-2',
                'place-items-center',
                'rounded-md'
              ].join(' ')}
            >
              <Circle weight="fill" fill="#689F38" />
              CryptoKitties
            </div>
            <div
              className={[
                'bg-blue-100',
                'bg-opacity-30',
                'px-4',
                'py-2',
                'flex',
                'gap-2',
                'place-items-center',
                'rounded-md'
              ].join(' ')}
            >
              <Circle weight="fill" fill="#F44336" />
              Sushi
            </div>
          </div> */}
        </div>
      )}
    </div>
  );
};
