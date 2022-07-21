import { FunctionComponent } from 'react';

import useCell from '../cells/useCell';
import { useQuill } from '../QuillContext';
import Loading from './Loading';

const ChainCurrency: FunctionComponent = () => {
  const quill = useQuill();
  const network = useCell(quill.cells.network);

  if (network === undefined) {
    return <Loading />;
  }

  return <>{network.chainCurrency}</>;
};

export default ChainCurrency;
