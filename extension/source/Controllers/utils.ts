import { DEFAULT_CHAIN_ID_HEX } from '../env';
import {
  ProviderConfig,
  CHAIN_ID_NETWORK_MAP,
  SUPPORTED_NETWORKS,
} from './constants';

// TODO: Use a better random source, and maybe more entropy
export const createRandomId = (): string => Math.random().toString(36).slice(2);

export const getUserLanguage = (): string => {
  const navLang = window.navigator.language || 'en-US';
  const preLang = navLang.split('-');
  return preLang[0] || 'en';
};

export const getDefaultProviderConfig = (): ProviderConfig => {
  const networkName = CHAIN_ID_NETWORK_MAP[DEFAULT_CHAIN_ID_HEX];
  if (!networkName) {
    throw new Error(
      `supported network not found for chainid ${DEFAULT_CHAIN_ID_HEX}`,
    );
  }
  const config = SUPPORTED_NETWORKS[networkName];
  if (!config) {
    throw new Error(`network config not found for network ${networkName}`);
  }
  return config;
};

export const getRPCURL = (chainId: string): string => {
  const name = CHAIN_ID_NETWORK_MAP[chainId];
  return SUPPORTED_NETWORKS[name].rpcTarget;
};

// TODO: delete
export const getFirstReqParam = <T>(req: any): T => {
  if (!Array.isArray(req.params)) {
    throw new Error('req.params not array');
  }
  if (!req.params.length) {
    throw new Error('req.params empty');
  }
  return req.params[0];
};
