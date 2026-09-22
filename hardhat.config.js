require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

function getAccounts() {
  const rawKey = (process.env.PRIVATE_KEY || "").trim();
  if (!rawKey) return [];

  // Strip 0x if present
  const cleanKey = rawKey.startsWith("0x") ? rawKey.slice(2) : rawKey;

  // Verify valid 32-byte (64 hex characters) private key
  const isHex64 = /^[0-9a-fA-F]{64}$/.test(cleanKey);
  if (!isHex64) {
    return [];
  }

  return [`0x${cleanKey}`];
}

const accounts = getAccounts();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    botTestnet: {
      url: process.env.BOT_TESTNET_RPC_URL || "https://rpc.bohr.life",
      chainId: 968,
      accounts: accounts,
    },
    botMainnet: {
      url: process.env.BOT_MAINNET_RPC_URL || "https://rpc.botchain.ai",
      chainId: 677,
      accounts: accounts,
      timeout: 180000,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
