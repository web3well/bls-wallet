import ReactDOM from 'react-dom';

import '../contentScript';
import '../styles/index.scss';
import './styles.scss';
import Browser from 'webextension-polyfill';
import { BlsWalletWrapper } from 'bls-wallet-clients';
import QuillEthereumProvider from '../QuillEthereumProvider';
import Home from './Home';

window.ethereum = new QuillEthereumProvider(true);

window.debug ??= {};
window.debug.Browser = Browser;
window.debug.BlsWalletWrapper = BlsWalletWrapper;

ReactDOM.render(<Home />, document.getElementById('quill-page-root'));
