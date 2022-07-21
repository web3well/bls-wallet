import '../contentScript';
import '../styles/index.scss';
import './styles.scss';

import ReactDOM from 'react-dom';
import Browser from 'webextension-polyfill';

import QuillEthereumProvider from '../QuillEthereumProvider';
import Confirm from './Confirm';
import { QuillContextProvider } from '../QuillContext';

window.ethereum = new QuillEthereumProvider(true);

window.debug ??= {};
window.debug.Browser = Browser;

ReactDOM.render(
  <QuillContextProvider>
    <Confirm />
  </QuillContextProvider>,
  document.getElementById('confirm-root'),
);
