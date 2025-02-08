import { ethers } from "hardhat";

async function main() {
  // Deploy ERC20 token first (or use existing token address)
  const token = await ethers.deployContract("YourToken");
  await token.waitForDeployment();
  console.log(`Token deployed to ${token.target}`);

  const SocialTipping = await ethers.getContractFactory("SocialTipping");
  const socialTipping = await SocialTipping.deploy(token.target);
  await socialTipping.waitForDeployment();

  console.log(`SocialTipping deployed to ${socialTipping.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});