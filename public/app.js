// ==========================================================================
// BOT Bounties - Web3 Client Application Logic
// ==========================================================================

const BOT_MAINNET_CONFIG = {
  chainId: "0x2A5", // 677
  chainName: "BOT Chain Mainnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.botchain.ai"],
  blockExplorerUrls: ["https://scan.botchain.ai"],
};

const BOT_TESTNET_CONFIG = {
  chainId: "0x3C8", // 968
  chainName: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.bohr.life"],
  blockExplorerUrls: ["https://scan.bohr.life"],
};

const HARDHAT_LOCAL_CONFIG = {
  chainId: "0x7A69", // 31337
  chainName: "Hardhat Localhost",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

const KNOWN_CONTRACTS = {
  677: "0x95eaF03B03b4424d5a1746847C51Ac620c261200", // Mainnet
  968: "0xb61a26604855744CC2bE9002B523ee5971aC7855", // Testnet
};


const BOT_BOUNTIES_ABI = [
  "function createBounty(string title, string description) external payable returns (uint256)",
  "function submitWork(uint256 bountyId, string submissionUrl) external",
  "function approveAndPay(uint256 bountyId) external",
  "function cancelBounty(uint256 bountyId) external",
  "function getBounty(uint256 bountyId) external view returns (tuple(uint256 id, address creator, address hunter, uint256 rewardAmount, string title, string description, string submissionUrl, uint8 status, uint256 createdAt, uint256 submittedAt, uint256 paidAt))",
  "function getBounties(uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address creator, address hunter, uint256 rewardAmount, string title, string description, string submissionUrl, uint8 status, uint256 createdAt, uint256 submittedAt, uint256 paidAt)[])",
  "function getBountyCount() external view returns (uint256)",
  "event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 rewardAmount, string title)",
  "event WorkSubmitted(uint256 indexed bountyId, address indexed hunter, string submissionUrl)",
  "event BountyApproved(uint256 indexed bountyId, address indexed creator, address indexed hunter, uint256 rewardAmount)",
  "event BountyPaid(uint256 indexed bountyId, address indexed hunter, uint256 rewardAmount)",
  "event BountyCancelled(uint256 indexed bountyId, address indexed creator, uint256 refundAmount)"
];

const STATUS_META = {
  0: { label: "Open", class: "status-open" },
  1: { label: "In Review", class: "status-review" },
  2: { label: "Approved", class: "status-review" },
  3: { label: "Settled", class: "status-paid" },
  4: { label: "Cancelled", class: "status-cancelled" },
};

// Global State
const state = {
  provider: null,
  signer: null,
  userAddress: null,
  userBalance: 0n,
  userBalanceEth: "0.00",
  chainId: null,
  contractAddress: localStorage.getItem("bot_bounties_contract") || "0x95eaF03B03b4424d5a1746847C51Ac620c261200",
  contract: null,
  bounties: [],
  currentFilter: "all",
  searchQuery: "",
};

// DOM References
const dom = {
  btnConnectWallet: document.getElementById("btnConnectWallet"),
  walletBtnText: document.getElementById("walletBtnText"),
  networkPillContainer: document.getElementById("networkPillContainer"),
  networkStatusDot: document.getElementById("networkStatusDot"),
  networkBadge: document.getElementById("networkBadge"),
  networkIdBadge: document.getElementById("networkIdBadge"),
  btnSwitchNetwork: document.getElementById("btnSwitchNetwork"),
  contractAddressDisplay: document.getElementById("contractAddressDisplay"),
  btnCopyContractAddress: document.getElementById("btnCopyContractAddress"),
  explorerContractLink: document.getElementById("explorerContractLink"),
  
  // Stats
  statTotalEscrow: document.getElementById("statTotalEscrow"),
  statOpenBounties: document.getElementById("statOpenBounties"),
  statReviewBounties: document.getElementById("statReviewBounties"),
  statPaidBounties: document.getElementById("statPaidBounties"),
  
  // Filter counts
  countFilterAll: document.getElementById("countFilterAll"),
  countFilterOpen: document.getElementById("countFilterOpen"),
  countFilterReview: document.getElementById("countFilterReview"),
  countFilterPaid: document.getElementById("countFilterPaid"),
  countFilterMine: document.getElementById("countFilterMine"),
  
  // Listing & Filters
  bountiesGrid: document.getElementById("bountiesGrid"),
  searchInput: document.getElementById("searchInput"),
  btnRefreshBounties: document.getElementById("btnRefreshBounties"),
  filterBtns: document.querySelectorAll(".filter-btn"),
  
  // Create Modal
  btnOpenCreateBountyModal: document.getElementById("btnOpenCreateBountyModal"),
  modalCreateBounty: document.getElementById("modalCreateBounty"),
  btnCloseCreateModal: document.getElementById("btnCloseCreateModal"),
  btnCancelCreateBounty: document.getElementById("btnCancelCreateBounty"),
  formCreateBounty: document.getElementById("formCreateBounty"),
  inputBountyTitle: document.getElementById("inputBountyTitle"),
  inputBountyDesc: document.getElementById("inputBountyDesc"),
  inputBountyReward: document.getElementById("inputBountyReward"),
  createModalUserBalance: document.getElementById("createModalUserBalance"),
  btnMaxReward: document.getElementById("btnMaxReward"),
  rewardErrorHint: document.getElementById("rewardErrorHint"),
  
  // Submit Work Modal
  modalSubmitWork: document.getElementById("modalSubmitWork"),
  btnCloseSubmitModal: document.getElementById("btnCloseSubmitModal"),
  btnCancelSubmitWork: document.getElementById("btnCancelSubmitWork"),
  formSubmitWork: document.getElementById("formSubmitWork"),
  inputSubmitBountyId: document.getElementById("inputSubmitBountyId"),
  submitModalBountyId: document.getElementById("submitModalBountyId"),
  submitModalBountyTitle: document.getElementById("submitModalBountyTitle"),
  submitModalBountyReward: document.getElementById("submitModalBountyReward"),
  inputSubmissionUrl: document.getElementById("inputSubmissionUrl"),
  
  // Settings Modal
  btnOpenContractSettings: document.getElementById("btnOpenContractSettings"),
  modalContractSettings: document.getElementById("modalContractSettings"),
  btnCloseSettingsModal: document.getElementById("btnCloseSettingsModal"),
  inputContractAddress: document.getElementById("inputContractAddress"),
  btnSaveContractSettings: document.getElementById("btnSaveContractSettings"),
  btnResetDefaultContract: document.getElementById("btnResetDefaultContract"),
  
  // Confirm Modal
  modalConfirmDialog: document.getElementById("modalConfirmDialog"),
  confirmDialogTitle: document.getElementById("confirmDialogTitle"),
  confirmDialogSubtitle: document.getElementById("confirmDialogSubtitle"),
  confirmDialogMessage: document.getElementById("confirmDialogMessage"),
  confirmDialogBadge: document.getElementById("confirmDialogBadge"),
  confirmDialogIcon: document.getElementById("confirmDialogIcon"),
  btnCloseConfirmModal: document.getElementById("btnCloseConfirmModal"),
  btnCancelConfirmAction: document.getElementById("btnCancelConfirmAction"),
  btnApproveConfirmAction: document.getElementById("btnApproveConfirmAction"),

  toastContainer: document.getElementById("toastContainer"),
};

// ==========================================================================
// Explorer Helpers
// ==========================================================================
function getExplorerBaseUrl() {
  return state.chainId === 677 ? "https://scan.botchain.ai" : "https://scan.bohr.life";
}

function getExplorerTxUrl(txHash) {
  const base = getExplorerBaseUrl();
  if (!txHash) return base;
  return `${base}/tx/${txHash}`;
}

function getExplorerAddressUrl(address) {
  const base = getExplorerBaseUrl();
  if (!address) return base;
  return `${base}/address/${address}`;
}

// ==========================================================================
// Toast Notification Utility
// ==========================================================================
function showToast(title, message, type = "info", options = {}) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else if (type === "warning") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  let actionsHtml = "";
  if (options.txHash) {
    const explorerUrl = getExplorerTxUrl(options.txHash);
    const shortTx = `${options.txHash.substring(0, 8)}...${options.txHash.substring(options.txHash.length - 6)}`;
    actionsHtml = `
      <div class="toast-actions">
        <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="toast-explorer-link" title="View Transaction on Explorer">
          <span>View on Explorer (${shortTx})</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      </div>
    `;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-desc">${escapeHtml(message)}</div>
      ${actionsHtml}
    </div>
    <button class="toast-close-btn" title="Dismiss">&times;</button>
  `;
  
  const closeBtn = toast.querySelector(".toast-close-btn");
  const removeToast = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  };

  if (closeBtn) {
    closeBtn.addEventListener("click", removeToast);
  }

  dom.toastContainer.appendChild(toast);
  
  const duration = options.duration || (options.txHash ? 8000 : 4500);
  setTimeout(removeToast, duration);
}

// ==========================================================================
// Clean Modal Confirmation System (replaces native confirm/alert)
// ==========================================================================
function showConfirmModal({
  title = "Confirm Action",
  subtitle = "Please review before proceeding.",
  message = "Are you sure you want to continue?",
  highlight = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
} = {}) {
  return new Promise((resolve) => {
    dom.confirmDialogTitle.textContent = title;
    dom.confirmDialogSubtitle.textContent = subtitle;
    dom.confirmDialogMessage.textContent = message;

    if (highlight) {
      dom.confirmDialogBadge.textContent = highlight;
      dom.confirmDialogBadge.classList.remove("hidden");
    } else {
      dom.confirmDialogBadge.classList.add("hidden");
    }

    dom.btnApproveConfirmAction.textContent = confirmText;
    dom.btnCancelConfirmAction.textContent = cancelText;

    if (isDanger) {
      dom.btnApproveConfirmAction.className = "btn btn-danger";
      dom.confirmDialogIcon.className = "confirm-icon-wrap danger";
    } else {
      dom.btnApproveConfirmAction.className = "btn btn-primary";
      dom.confirmDialogIcon.className = "confirm-icon-wrap";
    }

    dom.modalConfirmDialog.classList.remove("hidden");

    const cleanup = () => {
      dom.modalConfirmDialog.classList.add("hidden");
      dom.btnApproveConfirmAction.removeEventListener("click", onConfirm);
      dom.btnCancelConfirmAction.removeEventListener("click", onCancel);
      dom.btnCloseConfirmModal.removeEventListener("click", onCancel);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    dom.btnApproveConfirmAction.addEventListener("click", onConfirm);
    dom.btnCancelConfirmAction.addEventListener("click", onCancel);
    dom.btnCloseConfirmModal.addEventListener("click", onCancel);
  });
}

// ==========================================================================
// Web3 & Contract Setup
// ==========================================================================
// ==========================================================================
// Web3 & Contract Setup
// ==========================================================================
async function initApp() {
  if (window.ethereum) {
    state.provider = new ethers.BrowserProvider(window.ethereum);

    // Immediate account listener without browser reload
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts && accounts.length > 0) {
        try {
          state.provider = new ethers.BrowserProvider(window.ethereum);
          state.signer = await state.provider.getSigner();
          state.userAddress = await state.signer.getAddress();
          const network = await state.provider.getNetwork();
          state.chainId = Number(network.chainId);

          if (KNOWN_CONTRACTS[state.chainId]) {
            state.contractAddress = KNOWN_CONTRACTS[state.chainId];
            localStorage.setItem("bot_bounties_contract", state.contractAddress);
          }

          await updateUserBalance();
          setupContract();
          updateContractDisplay();
          updateWalletUI();
          fetchBounties();

          const shortAddr = `${state.userAddress.substring(0, 6)}...${state.userAddress.substring(state.userAddress.length - 4)}`;
          showToast("Account Switched", `Active account updated to ${shortAddr}`, "info");
        } catch (err) {
          console.error("Account switch listener error:", err);
        }
      } else {
        disconnectWallet();
        showToast("Wallet Disconnected", "Account was disconnected in wallet provider.", "info");
      }
    });

    // Dynamic chain change listener
    window.ethereum.on("chainChanged", async () => {
      try {
        state.provider = new ethers.BrowserProvider(window.ethereum);
        const network = await state.provider.getNetwork();
        state.chainId = Number(network.chainId);
        
        if (KNOWN_CONTRACTS[state.chainId]) {
          state.contractAddress = KNOWN_CONTRACTS[state.chainId];
          localStorage.setItem("bot_bounties_contract", state.contractAddress);
        }

        if (state.userAddress) {
          try {
            state.signer = await state.provider.getSigner();
            await updateUserBalance();
          } catch (signerErr) {
            console.warn("Could not get signer after chain switch:", signerErr);
          }
        }

        setupContract();
        updateContractDisplay();
        updateWalletUI();
        fetchBounties();
        
        if (state.chainId === 677) {
          showToast("Network Connected", "Connected to BOT Chain Mainnet", "success");
        } else if (state.chainId === 968) {
          showToast("Network Connected", "Connected to BOT Chain Testnet", "success");
        } else if (state.chainId === 31337) {
          showToast("Network Connected", "Connected to Localhost EVM", "info");
        } else {
          showToast("Unsupported Network", `Connected to Chain ID ${state.chainId}. Please switch to BOT Chain Mainnet.`, "warning");
        }
      } catch (err) {
        console.warn("Chain switch update error:", err);
      }
    });

    try {
      const network = await state.provider.getNetwork();
      state.chainId = Number(network.chainId);

      if (KNOWN_CONTRACTS[state.chainId]) {
        state.contractAddress = KNOWN_CONTRACTS[state.chainId];
        localStorage.setItem("bot_bounties_contract", state.contractAddress);
      }

      const accounts = await state.provider.listAccounts();
      if (accounts.length > 0) {
        state.signer = await state.provider.getSigner();
        state.userAddress = await state.signer.getAddress();
        await updateUserBalance();
      }
      updateContractDisplay();
      updateWalletUI();
    } catch (err) {
      console.warn("Auto connect init skipped:", err);
      state.chainId = 677;
      updateContractDisplay();
      updateWalletUI();
    }
  } else {
    state.provider = new ethers.JsonRpcProvider("https://rpc.botchain.ai");
    state.chainId = 677;
    state.contractAddress = KNOWN_CONTRACTS[677];
    updateContractDisplay();
    updateWalletUI();
  }

  setupContract();
  fetchBounties();
  attachInputValidationListeners();
}

async function updateUserBalance() {
  if (!state.provider || !state.userAddress) {
    state.userBalance = 0n;
    state.userBalanceEth = "0.00";
    if (dom.createModalUserBalance) {
      dom.createModalUserBalance.textContent = "-- BOT";
    }
    return;
  }

  try {
    const bal = await state.provider.getBalance(state.userAddress);
    state.userBalance = bal;
    const formatted = ethers.formatEther(bal);
    const num = parseFloat(formatted);
    state.userBalanceEth = isNaN(num) ? "0.00" : num.toFixed(4);
    if (dom.createModalUserBalance) {
      dom.createModalUserBalance.textContent = `${state.userBalanceEth} BOT`;
    }
  } catch (err) {
    console.warn("Failed to fetch balance:", err);
  }
}

function setupContract() {
  if (!state.contractAddress || state.contractAddress === ethers.ZeroAddress) {
    return;
  }

  const signerOrProvider = state.signer || state.provider;
  if (signerOrProvider) {
    try {
      state.contract = new ethers.Contract(state.contractAddress, BOT_BOUNTIES_ABI, signerOrProvider);
    } catch (err) {
      console.error("Contract initialization error:", err);
    }
  }
}

function updateContractDisplay() {
  const addr = state.contractAddress;
  if (dom.inputContractAddress) dom.inputContractAddress.value = addr;
  if (addr && addr !== ethers.ZeroAddress) {
    const formatted = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    if (dom.contractAddressDisplay) {
      dom.contractAddressDisplay.textContent = formatted;
      dom.contractAddressDisplay.title = addr;
    }
    if (dom.explorerContractLink) {
      dom.explorerContractLink.href = getExplorerAddressUrl(addr);
    }
  } else {
    if (dom.contractAddressDisplay) dom.contractAddressDisplay.textContent = "Not Set";
    if (dom.explorerContractLink) dom.explorerContractLink.href = "#";
  }
}

function updateWalletUI() {
  // Update connected address text
  if (state.userAddress) {
    const shortAddr = `${state.userAddress.substring(0, 6)}...${state.userAddress.substring(state.userAddress.length - 4)}`;
    if (dom.walletBtnText) dom.walletBtnText.textContent = shortAddr;
  } else {
    if (dom.walletBtnText) dom.walletBtnText.textContent = "Connect Wallet";
  }

  // BOT Chain Mainnet is the production target (Chain ID: 677)
  const isBotMainnet = state.chainId === 677;

  if (dom.networkPillContainer) {
    if (isBotMainnet) {
      // Connected to Mainnet: Show clean green indicator, hide switch button
      dom.networkPillContainer.className = "network-badge-pill network-valid";
      if (dom.networkStatusDot) dom.networkStatusDot.className = "status-indicator-dot online";
      if (dom.networkBadge) dom.networkBadge.textContent = "BOT Chain Mainnet";
      if (dom.networkIdBadge) dom.networkIdBadge.textContent = "ID: 677";
      if (dom.btnSwitchNetwork) {
        dom.btnSwitchNetwork.classList.add("hidden");
      }
    } else {
      // Wrong Network State (Amber/Red warning badge + prominent Switch to Mainnet button)
      dom.networkPillContainer.className = "network-badge-pill network-wrong";
      if (dom.networkStatusDot) dom.networkStatusDot.className = "status-indicator-dot wrong";
      if (dom.networkBadge) dom.networkBadge.textContent = state.chainId ? `Wrong Chain (${state.chainId})` : "Wrong Network";
      if (dom.networkIdBadge) dom.networkIdBadge.textContent = "Switch Required";
      if (dom.btnSwitchNetwork) {
        dom.btnSwitchNetwork.classList.remove("hidden");
        dom.btnSwitchNetwork.className = "btn btn-warning-glow btn-sm";
        dom.btnSwitchNetwork.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span id="networkBtnText">Switch to BOT Mainnet</span>
        `;
      }
    }
  }
}

function disconnectWallet() {
  state.signer = null;
  state.userAddress = null;
  state.userBalance = 0n;
  state.userBalanceEth = "0.00";
  if (dom.createModalUserBalance) {
    dom.createModalUserBalance.textContent = "-- BOT";
  }
  updateWalletUI();
  renderBounties();
}

async function connectWallet() {
  if (!window.ethereum) {
    showToast("Web3 Extension Required", "Please install MetaMask or an EVM wallet.", "error");
    return;
  }

  try {
    state.provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await state.provider.send("eth_requestAccounts", []);
    state.signer = await state.provider.getSigner();
    state.userAddress = accounts[0];
    const network = await state.provider.getNetwork();
    state.chainId = Number(network.chainId);

    if (state.chainId === 677) {
      state.contractAddress = KNOWN_CONTRACTS[677];
      localStorage.setItem("bot_bounties_contract", state.contractAddress);
    }

    await updateUserBalance();
    updateContractDisplay();
    updateWalletUI();
    setupContract();
    fetchBounties();
    
    if (state.chainId !== 677) {
      showToast("Wrong Network", "Connected to unsupported chain. Please click 'Switch to BOT Mainnet'.", "warning");
    } else {
      showToast("Wallet Connected", `Connected to BOT Chain Mainnet as ${state.userAddress.substring(0, 8)}... (${state.userBalanceEth} BOT)`, "success");
    }
  } catch (err) {
    console.error("Wallet connection failed:", err);
    showToast("Connection Rejected", err.message || "Failed to connect wallet", "error");
  }
}

async function switchNetwork() {
  if (!window.ethereum) {
    showToast("Web3 Extension Required", "Please install MetaMask or an EVM wallet.", "error");
    return;
  }

  // Always target BOT Chain Mainnet (Chain ID: 677)
  const targetConfig = BOT_MAINNET_CONFIG;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetConfig.chainId }],
    });
  } catch (switchError) {
    const isUnrecognized =
      switchError.code === 4902 ||
      switchError.code === -32603 ||
      (switchError.data && switchError.data.originalError && switchError.data.originalError.code === 4902) ||
      String(switchError.message || "").toLowerCase().includes("unrecognized") ||
      String(switchError.message || "").toLowerCase().includes("not added") ||
      String(switchError.message || "").toLowerCase().includes("could not find");

    if (isUnrecognized && targetConfig.rpcUrls && targetConfig.rpcUrls.length > 0) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [targetConfig],
        });
      } catch (addError) {
        showToast("Network Add Failed", addError.message || "Failed to add network to wallet", "error");
      }
    } else if (switchError.code === 4001) {
      showToast("Switch Cancelled", "Network switch was cancelled in wallet.", "info");
    } else {
      showToast("Switch Failed", switchError.message || "Could not switch network in wallet.", "error");
    }
  }
}

// ==========================================================================
// Pre-flight Input Validation & Live Balance Check
// ==========================================================================
function validateRewardInput(val) {
  const str = String(val || "").trim();
  if (!str) {
    return { valid: false, error: "Bounty escrow reward is required." };
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    return { valid: false, error: "Please enter a valid numeric reward amount." };
  }

  if (num <= 0) {
    return { valid: false, error: "Reward amount must be strictly greater than 0 BOT." };
  }

  let parsedWei;
  try {
    parsedWei = ethers.parseEther(str);
  } catch {
    return { valid: false, error: "Invalid token denomination format." };
  }

  if (parsedWei <= 0n) {
    return { valid: false, error: "Reward amount must be greater than 0 BOT." };
  }

  if (state.userAddress && state.userBalance !== null && parsedWei > state.userBalance) {
    return {
      valid: false,
      error: `Reward exceeds available balance (${state.userBalanceEth} BOT). Deposit will fail.`,
      wei: parsedWei,
    };
  }

  return { valid: true, error: null, wei: parsedWei };
}

function attachInputValidationListeners() {
  if (!dom.inputBountyReward) return;

  dom.inputBountyReward.addEventListener("input", (e) => {
    const val = e.target.value;
    if (!val) {
      dom.inputBountyReward.classList.remove("input-has-error");
      dom.rewardErrorHint.classList.add("hidden");
      dom.rewardErrorHint.textContent = "";
      return;
    }

    const validation = validateRewardInput(val);
    if (!validation.valid) {
      dom.inputBountyReward.classList.add("input-has-error");
      dom.rewardErrorHint.textContent = validation.error;
      dom.rewardErrorHint.classList.remove("hidden");
    } else {
      dom.inputBountyReward.classList.remove("input-has-error");
      dom.rewardErrorHint.classList.add("hidden");
      dom.rewardErrorHint.textContent = "";
    }
  });

  if (dom.btnMaxReward) {
    dom.btnMaxReward.addEventListener("click", async () => {
      if (!state.userAddress) {
        connectWallet();
        return;
      }
      await updateUserBalance();
      const currentEth = parseFloat(state.userBalanceEth);
      if (currentEth <= 0) {
        showToast("Insufficient Balance", "Your wallet balance is 0 BOT.", "warning");
        return;
      }

      // Reserve 0.002 BOT buffer for gas if possible, else use whole balance
      const safeMax = Math.max(0.0001, currentEth > 0.005 ? currentEth - 0.002 : currentEth);
      dom.inputBountyReward.value = safeMax.toFixed(4);
      dom.inputBountyReward.dispatchEvent(new Event("input"));
    });
  }
}

// ==========================================================================
// Data Fetching & Rendering
// ==========================================================================
async function fetchBounties() {
  if (!state.contract) {
    renderEmpty("Contract address not configured. Click 'Contract' in the navigation bar to set it.");
    return;
  }

  try {
    const totalBigInt = await state.contract.getBountyCount();
    const total = Number(totalBigInt);

    if (total === 0) {
      state.bounties = [];
      updateStats();
      renderBounties();
      return;
    }

    const list = await state.contract.getBounties(1, total);
    state.bounties = list.map((b) => ({
      id: Number(b.id),
      creator: b.creator,
      hunter: b.hunter,
      rewardAmount: ethers.formatEther(b.rewardAmount),
      title: b.title,
      description: b.description,
      submissionUrl: b.submissionUrl,
      status: Number(b.status),
      createdAt: Number(b.createdAt),
      submittedAt: Number(b.submittedAt),
      paidAt: Number(b.paidAt),
    }));

    updateStats();
    renderBounties();
  } catch (err) {
    console.error("Error loading bounties:", err);
    renderEmpty(`Failed to read from contract: ${err.reason || err.message}`);
  }
}

function updateStats() {
  const all = state.bounties;
  const openCount = all.filter((b) => b.status === 0).length;
  const reviewCount = all.filter((b) => b.status === 1 || b.status === 2).length;
  const paidCount = all.filter((b) => b.status === 3).length;

  let totalEscrow = 0;
  all.forEach((b) => {
    if (b.status === 0 || b.status === 1) {
      totalEscrow += parseFloat(b.rewardAmount) || 0;
    }
  });

  dom.statTotalEscrow.textContent = `${totalEscrow.toFixed(2)} BOT`;
  dom.statOpenBounties.textContent = openCount;
  dom.statReviewBounties.textContent = reviewCount;
  dom.statPaidBounties.textContent = paidCount;

  // Filter count badges
  dom.countFilterAll.textContent = all.length;
  dom.countFilterOpen.textContent = openCount;
  dom.countFilterReview.textContent = reviewCount;
  dom.countFilterPaid.textContent = paidCount;

  if (state.userAddress) {
    const myCount = all.filter(
      (b) =>
        b.creator.toLowerCase() === state.userAddress.toLowerCase() ||
        b.hunter.toLowerCase() === state.userAddress.toLowerCase()
    ).length;
    dom.countFilterMine.textContent = myCount;
  } else {
    dom.countFilterMine.textContent = "0";
  }
}

function renderBounties() {
  const container = dom.bountiesGrid;
  container.innerHTML = "";

  let filtered = [...state.bounties];

  if (state.currentFilter === "0") {
    filtered = filtered.filter((b) => b.status === 0);
  } else if (state.currentFilter === "1") {
    filtered = filtered.filter((b) => b.status === 1 || b.status === 2);
  } else if (state.currentFilter === "3") {
    filtered = filtered.filter((b) => b.status === 3);
  } else if (state.currentFilter === "mine" && state.userAddress) {
    filtered = filtered.filter(
      (b) =>
        b.creator.toLowerCase() === state.userAddress.toLowerCase() ||
        b.hunter.toLowerCase() === state.userAddress.toLowerCase()
    );
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.creator.toLowerCase().includes(q) ||
        b.hunter.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    renderEmpty("No bounties matching the active filter.");
    return;
  }

  filtered.forEach((bounty) => {
    const card = document.createElement("div");
    card.className = "bounty-card";

    const statusMeta = STATUS_META[bounty.status] || { label: "Unknown", class: "" };
    const isCreator = state.userAddress && bounty.creator.toLowerCase() === state.userAddress.toLowerCase();
    const isHunter = state.userAddress && bounty.hunter.toLowerCase() === state.userAddress.toLowerCase();

    const creatorShort = `${bounty.creator.substring(0, 6)}...${bounty.creator.substring(bounty.creator.length - 4)}`;
    const hunterShort =
      bounty.hunter !== ethers.ZeroAddress
        ? `${bounty.hunter.substring(0, 6)}...${bounty.hunter.substring(bounty.hunter.length - 4)}`
        : null;

    let actionsHtml = "";

    if (bounty.status === 0) {
      if (isCreator) {
        actionsHtml = `
          <button class="btn btn-danger-soft btn-sm btn-cancel-bounty" data-id="${bounty.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>Cancel & Refund</span>
          </button>
        `;
      } else {
        actionsHtml = `
          <button class="btn btn-primary btn-sm btn-open-submit-modal" data-id="${bounty.id}" data-title="${encodeURIComponent(bounty.title)}" data-reward="${bounty.rewardAmount}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
            <span>Submit Work</span>
          </button>
        `;
      }
    } else if (bounty.status === 1) {
      if (isCreator) {
        actionsHtml = `
          <button class="btn btn-success-action btn-sm btn-approve-pay" data-id="${bounty.id}" data-reward="${bounty.rewardAmount}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Approve & Release ${bounty.rewardAmount} BOT</span>
          </button>
        `;
      } else if (isHunter) {
        actionsHtml = `
          <span class="badge-pill in-review-pill">
            <span class="status-pulse-dot" style="background: #f59e0b; box-shadow: 0 0 6px #f59e0b;"></span>
            <span>Your Submission in Review</span>
          </span>
        `;
      }
    } else if (bounty.status === 3) {
      actionsHtml = `
        <span class="badge-pill settled-pill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Settled & Paid</span>
        </span>
      `;
    }

    const creatorColor = `#${bounty.creator.slice(2, 8)}`;

    card.innerHTML = `
      <div class="bounty-card-header">
        <div class="bounty-id-cluster">
          <span class="bounty-badge-id">#${bounty.id}</span>
          <span class="status-badge ${statusMeta.class}">
            <span class="status-pulse-dot"></span>
            <span>${statusMeta.label}</span>
          </span>
          ${isCreator ? `<span class="role-badge creator-role">Your Bounty</span>` : ""}
          ${isHunter ? `<span class="role-badge hunter-role">Your Submission</span>` : ""}
        </div>

        <div class="reward-box">
          <div class="reward-box-label">Escrow Locked</div>
          <div class="reward-box-value">
            <span class="reward-amount">${bounty.rewardAmount}</span>
            <span class="token-badge">BOT</span>
          </div>
        </div>
      </div>

      <div class="bounty-card-body">
        <h3 class="bounty-title">${escapeHtml(bounty.title)}</h3>
        <p class="bounty-desc">${escapeHtml(bounty.description)}</p>
      </div>

      <div class="bounty-card-footer">
        <div class="bounty-meta-cluster">
          <div class="meta-item">
            <span class="meta-avatar" style="background: linear-gradient(135deg, ${creatorColor}, #3b82f6)"></span>
            <span class="meta-label">Creator:</span>
            <a href="${getExplorerAddressUrl(bounty.creator)}" target="_blank" rel="noopener noreferrer" class="meta-address font-mono">${creatorShort}</a>
          </div>

          ${
            hunterShort
              ? `
            <div class="meta-item">
              <span class="meta-avatar hunter-avatar"></span>
              <span class="meta-label">Hunter:</span>
              <a href="${getExplorerAddressUrl(bounty.hunter)}" target="_blank" rel="noopener noreferrer" class="meta-address font-mono">${hunterShort}</a>
            </div>
          `
              : ""
          }

          ${
            bounty.submissionUrl
              ? `
            <div class="meta-item">
              <a href="${escapeHtml(bounty.submissionUrl)}" target="_blank" rel="noopener noreferrer" class="proof-of-work-btn" title="Inspect Proof of Work Deliverable">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                <span>Proof of Work</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            </div>
          `
              : ""
          }
        </div>

        <div class="bounty-card-actions">
          ${actionsHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  attachRowListeners();
}

function renderEmpty(message) {
  dom.bountiesGrid.innerHTML = `
    <div class="empty-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}

// Helper to ensure transactions meet BOT Chain's 20 gwei minimum gas price requirement and bypass RPC estimateGas timeouts
async function getTxOverrides(custom = {}) {
  let requiredGasPrice = ethers.parseUnits("20.5", "gwei");
  try {
    if (state.provider) {
      const feeData = await state.provider.getFeeData();
      if (feeData.gasPrice && feeData.gasPrice > requiredGasPrice) {
        requiredGasPrice = feeData.gasPrice;
      }
    }
  } catch (e) {
    console.warn("Gas fee fallback used:", e);
  }

  return {
    gasPrice: requiredGasPrice,
    gasLimit: custom.gasLimit || 350000n,
    ...custom,
  };
}

// Action Listeners
function attachRowListeners() {
  document.querySelectorAll(".btn-open-submit-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.userAddress) {
        connectWallet();
        return;
      }
      const id = btn.getAttribute("data-id");
      const title = decodeURIComponent(btn.getAttribute("data-title"));
      const reward = btn.getAttribute("data-reward");

      dom.inputSubmitBountyId.value = id;
      dom.submitModalBountyId.textContent = `#${id}`;
      dom.submitModalBountyTitle.textContent = title;
      dom.submitModalBountyReward.textContent = `${reward} BOT`;
      dom.inputSubmissionUrl.value = "";
      dom.modalSubmitWork.classList.remove("hidden");
    });
  });

  document.querySelectorAll(".btn-approve-pay").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const reward = btn.getAttribute("data-reward");

      const confirmed = await showConfirmModal({
        title: "Approve Work & Release Payment",
        subtitle: `Bounty #${id}`,
        message: `Are you sure you want to approve this work and release the deposited escrow to the developer? This action is atomic and releases native BOT tokens.`,
        highlight: `Release Reward: ${reward} BOT`,
        confirmText: "Release Funds",
        cancelText: "Cancel",
        isDanger: false,
      });

      if (!confirmed) return;

      try {
        showToast("Approving Settlement...", "Please sign the payment release in your wallet.", "info");
        const contractWithSigner = state.contract.connect(state.signer);
        const overrides = await getTxOverrides();
        const tx = await contractWithSigner.approveAndPay(id, overrides);

        showToast("Transaction Broadcast", `Settlement transaction is being mined: ${tx.hash.substring(0, 10)}...`, "info", { txHash: tx.hash });
        await tx.wait();
        await updateUserBalance();

        showToast("Escrow Released Successfully", `Paid ${reward} BOT directly to developer.`, "success", { txHash: tx.hash });
        fetchBounties();
      } catch (err) {
        console.error("Approve error:", err);
        showToast("Approval Failed", err.reason || err.message, "error");
      }
    });
  });

  document.querySelectorAll(".btn-cancel-bounty").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");

      const confirmed = await showConfirmModal({
        title: "Cancel Bounty & Refund Escrow",
        subtitle: `Bounty #${id}`,
        message: `Are you sure you want to cancel this bounty? The locked escrow deposit will be refunded 100% back to your wallet address.`,
        highlight: `Status: Open & Unclaimed`,
        confirmText: "Cancel Bounty & Refund",
        cancelText: "Keep Active",
        isDanger: true,
      });

      if (!confirmed) return;

      try {
        showToast("Cancelling Bounty...", "Please sign the cancellation transaction in your wallet.", "info");
        const contractWithSigner = state.contract.connect(state.signer);
        const overrides = await getTxOverrides();
        const tx = await contractWithSigner.cancelBounty(id, overrides);

        showToast("Transaction Broadcast", `Cancellation is being mined: ${tx.hash.substring(0, 10)}...`, "info", { txHash: tx.hash });
        await tx.wait();
        await updateUserBalance();

        showToast("Bounty Cancelled & Escrow Refunded", "Escrow deposit returned to your wallet.", "success", { txHash: tx.hash });
        fetchBounties();
      } catch (err) {
        console.error("Cancel error:", err);
        showToast("Cancellation Failed", err.reason || err.message, "error");
      }
    });
  });
}

// Form Handlers
dom.formCreateBounty.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.userAddress) {
    connectWallet();
    return;
  }

  const title = dom.inputBountyTitle.value.trim();
  const desc = dom.inputBountyDesc.value.trim();
  const reward = dom.inputBountyReward.value.trim();

  if (!title || !desc) {
    showToast("Missing Information", "Please enter a bounty title and specifications.", "error");
    return;
  }

  // Refresh balance right before submission check
  await updateUserBalance();

  const validation = validateRewardInput(reward);
  if (!validation.valid) {
    dom.inputBountyReward.classList.add("input-has-error");
    dom.rewardErrorHint.textContent = validation.error;
    dom.rewardErrorHint.classList.remove("hidden");
    showToast("Invalid Reward Input", validation.error, "error");
    return;
  }

  try {
    const depositWei = validation.wei;
    showToast("Initiating Escrow Deposit...", "Please confirm transaction in your wallet.", "info");

    const contractWithSigner = state.contract.connect(state.signer);
    const overrides = await getTxOverrides({ value: depositWei });
    const tx = await contractWithSigner.createBounty(title, desc, overrides);

    dom.modalCreateBounty.classList.add("hidden");
    dom.formCreateBounty.reset();
    dom.rewardErrorHint.classList.add("hidden");
    dom.inputBountyReward.classList.remove("input-has-error");

    showToast("Transaction Broadcast", `Escrow deposit broadcasted: ${tx.hash.substring(0, 10)}...`, "info", { txHash: tx.hash });
    
    await tx.wait();
    await updateUserBalance();
    
    showToast("Bounty Created & Escrow Locked", `Successfully locked ${reward} BOT in smart contract escrow.`, "success", { txHash: tx.hash });
    fetchBounties();
  } catch (err) {
    console.error("Create bounty error:", err);
    showToast("Creation Failed", err.reason || err.message, "error");
  }
});

dom.formSubmitWork.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.userAddress) {
    connectWallet();
    return;
  }

  const id = dom.inputSubmitBountyId.value;
  const url = dom.inputSubmissionUrl.value.trim();

  if (!url) {
    showToast("Missing URL", "Please enter a valid proof of work URL.", "error");
    return;
  }

  try {
    showToast("Submitting Proof...", "Please confirm transaction in your wallet.", "info");
    const contractWithSigner = state.contract.connect(state.signer);
    const overrides = await getTxOverrides();
    const tx = await contractWithSigner.submitWork(id, url, overrides);

    dom.modalSubmitWork.classList.add("hidden");
    dom.formSubmitWork.reset();

    showToast("Transaction Broadcast", `Proof submission is being mined: ${tx.hash.substring(0, 10)}...`, "info", { txHash: tx.hash });
    await tx.wait();
    await updateUserBalance();

    showToast("Work Submitted Successfully", "Bounty status updated to In Review.", "success", { txHash: tx.hash });
    fetchBounties();
  } catch (err) {
    console.error("Submit error:", err);
    showToast("Submission Failed", err.reason || err.message, "error");
  }
});

// UI Event Handlers
dom.btnConnectWallet.addEventListener("click", connectWallet);
dom.btnSwitchNetwork.addEventListener("click", switchNetwork);
dom.btnRefreshBounties.addEventListener("click", () => {
  updateUserBalance();
  fetchBounties();
  showToast("Refreshed", "Loaded latest on-chain bounty data.", "info");
});

dom.btnCopyContractAddress.addEventListener("click", () => {
  if (state.contractAddress) {
    navigator.clipboard.writeText(state.contractAddress);
    showToast("Address Copied", state.contractAddress, "info");
  }
});

dom.searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  renderBounties();
});

dom.filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    dom.filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentFilter = btn.getAttribute("data-filter");
    renderBounties();
  });
});

// Modal Open/Close
dom.btnOpenCreateBountyModal.addEventListener("click", async () => {
  if (!state.userAddress) {
    await connectWallet();
    if (!state.userAddress) return;
  }
  await updateUserBalance();
  dom.rewardErrorHint.classList.add("hidden");
  dom.inputBountyReward.classList.remove("input-has-error");
  dom.modalCreateBounty.classList.remove("hidden");
});

dom.btnCloseCreateModal.addEventListener("click", () => dom.modalCreateBounty.classList.add("hidden"));
dom.btnCancelCreateBounty.addEventListener("click", () => dom.modalCreateBounty.classList.add("hidden"));

dom.btnCloseSubmitModal.addEventListener("click", () => dom.modalSubmitWork.classList.add("hidden"));
dom.btnCancelSubmitWork.addEventListener("click", () => dom.modalSubmitWork.classList.add("hidden"));

dom.btnOpenContractSettings.addEventListener("click", () => {
  dom.modalContractSettings.classList.remove("hidden");
});
dom.btnCloseSettingsModal.addEventListener("click", () => dom.modalContractSettings.classList.add("hidden"));

dom.btnSaveContractSettings.addEventListener("click", () => {
  const newAddr = dom.inputContractAddress.value.trim();
  if (newAddr && ethers.isAddress(newAddr)) {
    state.contractAddress = newAddr;
    localStorage.setItem("bot_bounties_contract", newAddr);
    updateContractDisplay();
    setupContract();
    fetchBounties();
    dom.modalContractSettings.classList.add("hidden");
    showToast("Settings Saved", `Target contract updated to ${newAddr.substring(0, 8)}...`, "success");
  } else {
    showToast("Invalid Address", "Please provide a valid EVM contract address.", "error");
  }
});

dom.btnResetDefaultContract.addEventListener("click", () => {
  localStorage.removeItem("bot_bounties_contract");
  state.contractAddress = ethers.ZeroAddress;
  dom.inputContractAddress.value = "";
  updateContractDisplay();
  setupContract();
  fetchBounties();
  dom.modalContractSettings.classList.add("hidden");
  showToast("Address Reset", "Default settings restored.", "info");
});

// Close modals on backdrop click or Escape key
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop && backdrop !== dom.modalConfirmDialog) {
      backdrop.classList.add("hidden");
    }
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop").forEach((m) => {
      if (m !== dom.modalConfirmDialog) m.classList.add("hidden");
    });
  }
});

window.addEventListener("DOMContentLoaded", initApp);
