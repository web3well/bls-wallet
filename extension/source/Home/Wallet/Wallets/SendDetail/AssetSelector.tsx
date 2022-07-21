import { ArrowRight, CurrencyEth } from 'phosphor-react';
import { FunctionComponent } from 'react';
import ICell from '../../../../cells/ICell';

import useCell from '../../../../cells/useCell';
import Loading from '../../../../components/Loading';
import onAction from '../../../../helpers/onAction';
import { useQuill } from '../../../../QuillContext';
import Balance from '../Balance';

const AssetSelector: FunctionComponent<{
  selectedAsset: ICell<string | undefined>;
}> = ({ selectedAsset }) => {
  const quill = useQuill();
  const selectedAddress = useCell(quill.cells.selectedAddress);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-body">Select Asset</div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className={[
            'flex',
            'flex-row',
            'p-4',
            'gap-4',
            'rounded-lg',
            'bg-white',
            'border',
            'border-grey-400',
            'shadow-md',
            'cursor-pointer',
            'active:bg-grey-200',
            'select-none',
            'cursor-pointer',
          ].join(' ')}
          {...onAction(() => selectedAsset.write('ETH'))}
        >
          <div className="grow flex flex-row gap-3">
            <CurrencyEth className="self-center text-blue-400 icon-md" />
            <div>Ether</div>
          </div>
          <div>
            {selectedAddress && <Balance address={selectedAddress} />}
            {!selectedAddress && <Loading />}
          </div>
          <ArrowRight className="self-center" size={20} />
        </div>
      </div>
    </div>
  );
};

export default AssetSelector;
