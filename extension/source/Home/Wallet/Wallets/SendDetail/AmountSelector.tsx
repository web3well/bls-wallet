import { ethers } from 'ethers';
import { FunctionComponent, useMemo } from 'react';
import Display from '../../../../cells/components/Display';

import TextBox from '../../../../cells/components/TextBox';
import { FormulaCell } from '../../../../cells/FormulaCell';
import { IReadableCell } from '../../../../cells/ICell';
import MemoryCell from '../../../../cells/MemoryCell';
import TransformCell from '../../../../cells/TransformCell';
import Button from '../../../../components/Button';
import CurrencyDisplay from '../../../../components/CurrencyDisplay';

const AmountSelector: FunctionComponent<{
  selectedAsset: IReadableCell<string | undefined>;
  onSend: (amountWei: string) => void;
}> = ({ selectedAsset, onSend }) => {
  const amount = useMemo(() => new MemoryCell(''), []);

  const amountValid = useMemo(
    () =>
      new TransformCell(
        amount,
        ($amount) => $amount,
        ($amount, $newAmount) => {
          if ($newAmount === '.') {
            return '0.';
          }

          if (Number.isFinite(Number($newAmount || '0'))) {
            return $newAmount;
          }

          return $amount;
        },
      ),
    [amount],
  );

  const amountValidNumber = useMemo(
    () =>
      new FormulaCell({ amountValid }, ({ $amountValid }) =>
        Number($amountValid || '0'),
      ),
    [amountValid],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="text-body">Select Amount</div>
      <div className="flex justify-end gap-2">
        <TextBox
          value={amountValid}
          className="text-right"
          style={{ maxWidth: '10rem' }}
          placeholder="0"
        />
        <div className="self-center">
          <Display cell={selectedAsset} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <div>
          <CurrencyDisplay chainValue={amountValidNumber} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          className="btn-primary"
          onPress={async () =>
            onSend(
              ethers.utils
                .parseEther((await amountValid.read()) || '0')
                .toHexString(),
            )
          }
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default AmountSelector;
