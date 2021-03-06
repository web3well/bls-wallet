import { ReactElement } from 'react';
import { runtime } from 'webextension-polyfill';

const LargeQuillHeading = (): ReactElement => (
  <div className="flex py-9 justify-center">
    <img
      src={runtime.getURL('assets/logo-with-text.svg')}
      alt="Quill"
      width="100"
      height="35"
    />
  </div>
);

export default LargeQuillHeading;
