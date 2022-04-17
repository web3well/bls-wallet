import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// Do any needed pre-test setup here.
task("test").setAction(async (_taskArgs, _hre, runSuper) => {
  chai.use(chaiAsPromised);
  await runSuper();
});

// Accounts used for testing and deploying
const accounts = {
  mnemonic: `${process.env.MAIN_MNEMONIC}`,
  count: 5,
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136 . Remove when that issue is closed.
      accounts,
    },
    gethDev: {
      url: `http://localhost:8545`,
      accounts,
      gasPrice: 0,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts,
    },
    arbitrum_testnet: {
      // chainId: 421611
      url: process.env.ARBITRUM_TESTNET_URL,
      accounts: [
        "0x0", // Redacted
      ],
      gasPrice: 1408857682, // 287938372,
    },
    arbitrum: {
      // chainId: 42161
      url: process.env.ARBITRUM_URL,
      accounts,
      gasPrice: 700000000,
    },
    // optimistic_local: {
    //   url: process.env.OPTIMISM_LOCAL_URL,
    //   accounts,
    //   gasPrice: 0,//15000000,
    //   ovm: true
    // },
    // optimistic_testnet: {
    //   url: process.env.OPTIMISM_TESTNET_URL,
    //   accounts,
    //   gasPrice: 15000000,
    //   ovm: true // This sets the network as using the ovm and ensure contract will be compiled against that.
    // }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
