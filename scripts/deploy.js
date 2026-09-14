const hre = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("🚀 Starting Deployment of BOT Bounties Contract...");
  console.log("==================================================");

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("\n❌ DEPLOYMENT STOPPED: No valid deployer account found!");
    console.error("👉 Please add your 64-character private key to the .env file:");
    console.error("   PRIVATE_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n");
    console.error("💡 Also make sure your wallet has testnet BOT tokens for gas fees.\n");
    process.exit(1);
  }

  const deployer = signers[0];
  const network = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`📡 Network: ${hre.network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer Address: ${deployer.address}`);
  console.log(`💰 Deployer Balance: ${hre.ethers.formatEther(balance)} BOT`);
  console.log("--------------------------------------------------");

  if (balance === 0n) {
    console.warn("⚠️ Warning: Deployer wallet balance is 0 BOT. The transaction may fail due to lack of gas fees.");
  }

  console.log("⏳ Deploying BotBounties contract...");
  const BotBountiesFactory = await hre.ethers.getContractFactory("BotBounties");
  const botBounties = await BotBountiesFactory.deploy();

  await botBounties.waitForDeployment();
  const contractAddress = await botBounties.getAddress();

  console.log("✅ BotBounties deployed successfully!");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(
    `🔍 Explorer URL: https://scan.bohr.life/address/${contractAddress}`
  );
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
