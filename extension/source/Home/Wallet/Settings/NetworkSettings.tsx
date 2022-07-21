import { FunctionComponent } from 'react';
import Display from '../../../cells/components/Display';
import Selector from '../../../cells/components/Selector';
import { useQuill } from '../../../QuillContext';

const NetworkSettings: FunctionComponent = () => {
  const { cells, config } = useQuill();

  return (
    <>
      <Selector
        options={Object.values(config.builtinNetworks)
          .map((n) => n?.displayName)
          .filter(notUndefined)}
        selection={cells.networkDisplayName}
      />
      <pre>
        <Display cell={cells.networkJson} />
        {'\n'}
        Block number: <Display cell={cells.blockNumber} />
      </pre>
    </>
  );
};

function notUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}

export default NetworkSettings;
