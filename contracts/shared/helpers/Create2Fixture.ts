import "dotenv";
import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";
import { Wallet, BigNumber, Contract, ContractFactory } from "ethers";
import deployerContract from "./deployDeployer";
import { Create2Deployer } from "../../typechain";

export default class Create2Fixture {
  private constructor(public deployerWallet?: Wallet) {}

  static create(): Create2Fixture {
    return new Create2Fixture(
      new ethers.Wallet(
        "0x0", // Redacted
      ),
    );
  }

  static async hasContract(address: string): Promise<boolean> {
    return (await ethers.provider.getCode(address)) === "0x";
  }

  /**
   *
   * @param deployerWallet EOA to deploy contract, otherwise default from env vars
   * @returns create2Deployer Contract at the expected address, deploying one if not yet deployed
   */
  async deployerContract(
    deployerWallet: Wallet = this.deployerWallet,
  ): Promise<Create2Deployer> {
    const Create2Deployer = await ethers.getContractFactory(
      "Create2Deployer",
      deployerWallet,
    );

    const deployerAddress = ethers.utils.getContractAddress({
      from: deployerWallet.address,
      nonce: BigNumber.from(`${process.env.DEPLOYER_SET_INDEX}`),
    });

    // If deployer contract doesn't exist at expected address, deploy it there
    if (Create2Fixture.hasContract(deployerAddress)) {
      await (await Create2Deployer.deploy()).deployed();
    }

    return Create2Deployer.attach(deployerAddress);
  }

  contractAddress(
    factory: ContractFactory,
    constructorParamsBytes: string = "0x",
    salt: BigNumber = BigNumber.from(0),
  ): string {
    // const initCode = factory.bytecode + constructorParamsBytes.substr(2);

    return "";
  }

  /**
   *
   * @param factory factory of contract
   * @param constructorParamsBytes bytes of constructor parameters
   * @param salt unique uint256 value
   * @returns
   */
  async create2Contract(
    contractName: string,
    constructorParamsBytes: string = "0x",
    salt: BigNumber = BigNumber.from(0),
  ): Promise<Contract> {
    const create2Deployer = await deployerContract();
    const factory = await ethers.getContractFactory(contractName);
    const initCode = factory.bytecode + constructorParamsBytes.substr(2);
    const initCodeHash = ethers.utils.solidityKeccak256(["bytes"], [initCode]);

    const contractAddress = ethers.utils.getCreate2Address(
      create2Deployer.address,
      "0x" + salt.toHexString().substr(2).padStart(64, "0"),
      initCodeHash,
    );

    // If contract doesn't exist at expected address, deploy it there
    if ((await ethers.provider.getCode(contractAddress)) === "0x") {
      await (await create2Deployer.deploy(salt, initCode)).wait();
    }

    return factory.attach(contractAddress);
  }
}
