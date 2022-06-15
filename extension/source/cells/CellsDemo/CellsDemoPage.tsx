import * as io from 'io-ts';

import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../FormulaCell';
import MemoryCell from '../MemoryCell';
import useCell from '../useCell';
import delay from '../../helpers/delay';
import Range from '../../helpers/Range';
import { useQuill } from '../../QuillPage/QuillContext';
import BalanceWidget from './BalanceWidget';
import CheckBox from './CheckBox';
import { Counter } from './Counter';
import DemoTable from './DemoTable';
import { DisplayJson } from './DisplayJson';
import Selector from './Selector';

// Accessible at chrome-extension://<insert extension id>/cellsDemo.html

export const CellsDemoPage: FunctionComponent = () => {
  const quill = useQuill();

  const cells = useMemo(() => {
    const page = new MemoryCell('math');

    const a = quill.Cell('a', io.number, 3);
    const b = new MemoryCell(5);
    const c = new MemoryCell(0);
    const includeSlow = new MemoryCell(true);

    const ab = new FormulaCell({ a, b }, ({ $a, $b }) => $a * $b);

    const abSlow = new FormulaCell({ a, b }, async ({ $a, $b }) => {
      console.log(`calculating ${$a}*${$b}...`);
      await delay(500);
      const res = $a * $b;
      console.log(`...${res}`);
      return res;
    });

    return { page, a, b, c, includeSlow, ab, abSlow };
  }, [quill]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).cells = cells;

  const includeSlowValue = useCell(cells.includeSlow);
  const cValue = useCell(cells.c);
  const pageValue = useCell(cells.page);

  if (pageValue === undefined) {
    return <></>;
  }

  return (
    <DemoTable>
      <tr>
        <td style={{ height: '3em' }}>page</td>
        <td>
          <Selector
            options={['math', 'blockNumber', 'balance', 'settings']}
            selection={cells.page}
          />
        </td>
      </tr>
      {pageValue === 'math' && (
        <>
          <tr>
            <td>a:&nbsp;</td>
            <td>
              <Counter cell={cells.a} />
            </td>
          </tr>
          <tr>
            <td>b:&nbsp;</td>
            <td>
              <Counter cell={cells.b} />
            </td>
          </tr>
          <tr>
            <td>ab: </td>
            <td>
              <DisplayJson cell={cells.ab} />
            </td>
          </tr>
          <tr>
            <td>
              abSlow: <CheckBox cell={cells.includeSlow} />
            </td>
            <td>{includeSlowValue && <DisplayJson cell={cells.abSlow} />}</td>
          </tr>
        </>
      )}
      {pageValue === 'blockNumber' && (
        <>
          <tr>
            <td>components:&nbsp;</td>
            <td>
              <Counter cell={cells.c} />
            </td>
          </tr>
          {Range(cValue ?? 0).map((i) => (
            <tr key={i}>
              <td>blockNumber: </td>
              <td>
                <DisplayJson cell={quill.blockNumber} />
              </td>
            </tr>
          ))}
        </>
      )}
      {pageValue === 'balance' && <BalanceWidget />}
      {pageValue === 'settings' && (
        <>
          <tr>
            <td>Theme</td>
            <td>
              <Selector options={['light', 'dark']} selection={quill.theme} />
            </td>
          </tr>
        </>
      )}
    </DemoTable>
  );
};
