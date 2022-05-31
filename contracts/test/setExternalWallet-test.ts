import { expect } from "chai";

import { ethers, network } from "hardhat";
import { BigNumberish, ContractTransaction } from "ethers";

import Fixture from "../shared/helpers/Fixture";

import { parseEther } from "ethers/lib/utils";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import { BlsWalletWrapper, PublicKey, Signature } from "../clients/src";
import { MockERC20, VerificationGateway } from "../typechain";

describe("setExternalWallet", async function () {
  if (`${process.env.DEPLOYER_DEPLOYMENT}` === "true") {
    console.log("Skipping non-deployer tests.");
    return;
  }

  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: parseEther("1"),
        })
      ).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  beforeEach(async function () {
    if (network.name === "rinkarby") {
      fx = await Fixture.create(Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
    } else {
      fx = await Fixture.create();
    }
  });

  it.only("should not allow setting existing public key", async () => {
    const wallet1 = await fx.createWallet();

    // This isn't actually going to be a separate wallet, we're just using it
    // to sign things for wallet1
    const wallet2 = await fx.connectWallet();
    console.log("addresses", {
      wallet1: wallet1.address,
      wallet2: wallet2.address,
    });

    const signedAddress = wallet2.signMessage(wallet1.address);
    const newPublicKey = wallet2.PublicKey();

    // This should fail, but because it's in a bundle it's tricky to extract
    // Easier to just check whether the effect happened or not
    await (
      await setExternalWallet(fx, wallet1, signedAddress, newPublicKey)
    ).wait();

    const token = await createToken();

    // If setExternalWallet above worked, then this tx should actually mint to
    // wallet 1
    console.log("before mint");
    await (await mint(fx.verificationGateway, wallet2, token, 1)).wait();
    console.log("after mint");

    // We expect setExternalWallet should not have worked, so wallet1 balance
    // should be 0
    expect((await token.balanceOf(wallet1.address)).toNumber()).to.eq(0);

    // Huh?
    expect((await token.balanceOf(wallet2.address)).toNumber()).to.eq(1);
  });
});

async function setExternalWallet(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  signedAddress: Signature,
  newPublicKey: PublicKey,
): Promise<ContractTransaction> {
  return fx.verificationGateway.processBundle(
    wallet.sign({
      nonce: await wallet.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: fx.verificationGateway.address,
          encodedFunction: fx.verificationGateway.interface.encodeFunctionData(
            "setExternalWallet",
            [signedAddress, newPublicKey],
          ),
        },
      ],
    }),
  );
}

async function mint(
  vg: VerificationGateway,
  wallet: BlsWalletWrapper,
  token: MockERC20,
  amount: BigNumberish,
) {
  return vg.processBundle(
    wallet.sign({
      nonce: await wallet.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: token.address,
          encodedFunction: token.interface.encodeFunctionData("mint", [
            wallet.address,
            amount,
          ]),
        },
      ],
    }),
  );
}

async function createToken() {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockERC20 = await MockERC20.deploy("AnyToken", "TOK", 0);
  await mockERC20.deployed();

  return mockERC20;
}
