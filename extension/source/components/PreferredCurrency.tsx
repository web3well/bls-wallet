import { FunctionComponent } from 'react';

import useCell from '../cells/useCell';
import { useQuill } from '../QuillContext';
import Loading from './Loading';

const PreferredCurrency: FunctionComponent = () => {
  const quill = useQuill();
  const preferences = useCell(quill.cells.preferences);

  if (preferences === undefined) {
    return <Loading />;
  }

  return <>{preferences.currency}</>;
};

export default PreferredCurrency;
