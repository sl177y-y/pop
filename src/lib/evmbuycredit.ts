/**
 * Utility for handling credit purchases using EVM blockchain (Ethereum Sepolia)
 * VAULT 126 SPECIFIC IMPLEMENTATION - Replicating Aptos sophistication
 */
import { ethers } from 'ethers';

// Standardized RPC configuration
const RPC_PROVIDERS = [
  'https://eth-sepolia.g.alchemy.com/v2/b20Yg4jZMHRLeuzNknS1pSAgta1Plerw',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc.sepolia.org',
  'https://eth-sepolia.public.blastapi.io'
];

const EVM_VAULT_RECIPIENT_CONFIG = {
  126: {
    address: "0xcd9dbc15507c5fe4d1f61d3933ea92ba962ba249",
    description: "TEST VAULT",
    network: "sepolia",
    rpcUrl: RPC_PROVIDERS[0] // Primary RPC URL
  }
};

/**
 * Get recipient address for specific EVM vault - NO DEFAULT ADDRESS!
 */
function getRecipientAddressForVault(vaultId: number | string) {
  if (!vaultId) {
    console.error('❌ No vault ID provided - TRANSACTION WILL FAIL');
    return null;
  }

  const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
  
  if (isNaN(numericVaultId)) {
    console.error('❌ Invalid vault ID - TRANSACTION WILL FAIL');
    return null;
  }

  const vaultConfig = EVM_VAULT_RECIPIENT_CONFIG[numericVaultId];
  
  if (!vaultConfig) {
    console.error(`❌ No recipient configuration found for vault ${numericVaultId} - TRANSACTION WILL FAIL`);
    console.error(`Available EVM vaults: ${Object.keys(EVM_VAULT_RECIPIENT_CONFIG).join(', ')}`);
    return null;
  }

  console.info(`✅ Using ${vaultConfig.description} recipient: ${vaultConfig.address}`);
  return vaultConfig.address;
}

/**
 * Get a working RPC provider with fallbacks
 */
async function getWorkingProvider() {
  for (const rpcUrl of RPC_PROVIDERS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
        batchMaxCount: 1,
        batchStallTime: 50,
      });
      await provider.getNetwork(); // Test the connection
      return provider;
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      continue;
    }
  }
  throw new Error('All RPC providers failed');
}

export interface EVMCreditPurchaseParams {
  /** Number of credits to purchase */
  buyAmount: number;
  /** Cost per credit in ETH */
  costPerCredit?: number;
  /** Vault ID to determine recipient address - REQUIRED! */
  vaultId: number | string;
  /** Recipient wallet address (will be auto-determined by vaultId if not provided) */
  recipientAddress?: string;
  /** Current credit balance */
  currentCredits: number;
  /** Function to update credit state */
  updateCredits?: (newCredits: number) => void;
  /** Optional function to display purchase confirmation messages */
  displayMessage?: (message: string) => void;
  /** Optional function to handle errors */
  handleError?: (error: unknown) => void;
}

/**
 * Add or switch to Sepolia network in MetaMask
 */
async function ensureSepoliaNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask not detected");
  }

  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const sepoliaChainId = '0xaa36a7'; // 11155111 in hex

  if (chainId !== sepoliaChainId) {
    try {
      // Try to switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: sepoliaChainId }],
      });
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: sepoliaChainId,
            chainName: 'Sepolia Test Network',
            nativeCurrency: {
              name: 'SepoliaETH',
              symbol: 'SEP',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.infura.io/v3/'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/'],
          }],
        });
      } else {
        throw switchError;
      }
    }
  }
}

/**
 * Purchases credits using ETH tokens on Ethereum Sepolia
 * WILL FAIL IF NO VALID VAULT ID PROVIDED
 */
export async function purchaseEVMCredits({
  buyAmount,
  costPerCredit = 0.0002, // 0.0002 ETH per credit (5 credits = 0.001 ETH)
  vaultId,
  recipientAddress,
  currentCredits,
  updateCredits,
  displayMessage,
  handleError,
}: EVMCreditPurchaseParams): Promise<{ 
  newCredits: number, 
  transactionHash?: string, 
  success: boolean,
  actualSenderAddress?: string
}> {
  try {
    // ✅ STRICT VALIDATION - NO DEFAULT FALLBACK
    if (!recipientAddress && !vaultId) {
      const errorMsg = "❌ CRITICAL: No vaultId or recipientAddress provided!";
      console.error(errorMsg);
      if (displayMessage) displayMessage("Error: Vault ID is required for this transaction.");
      if (handleError) handleError(new Error(errorMsg));
      return { newCredits: currentCredits, success: false, actualSenderAddress: undefined };
    }
    
    // Determine recipient address based on vaultId or use provided address
    let finalRecipientAddress = recipientAddress;
    
    if (!finalRecipientAddress) {
      finalRecipientAddress = getRecipientAddressForVault(vaultId);
      
      // ✅ STRICT CHECK - FAIL IF NO ADDRESS FOUND
      if (!finalRecipientAddress) {
        const errorMsg = `❌ CRITICAL: Could not get address for vault ${vaultId}!`;
        console.error(errorMsg);
        if (displayMessage) {
          displayMessage(`Error: Invalid vault ID (${vaultId}). Available EVM vaults: ${Object.keys(EVM_VAULT_RECIPIENT_CONFIG).join(', ')}`);
        }
        if (handleError) handleError(new Error(errorMsg));
        return { newCredits: currentCredits, success: false, actualSenderAddress: undefined };
      }
    }
    
    // Ensure we're on Sepolia network
    await ensureSepoliaNetwork();
    
    // Calculate total cost in ETH
    const amount = buyAmount * costPerCredit;
    const amountWei = ethers.parseEther(amount.toString());
    
    if (!window.ethereum) {
      throw new Error("MetaMask not detected");
    }

    // Get provider and signer with retries
    let provider;
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
    } catch (error) {
      console.error('MetaMask provider failed, trying fallback RPC');
      provider = await getWorkingProvider();
    }

    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    // Check user balance with retries
    let balance;
    try {
      balance = await provider.getBalance(userAddress);
    } catch (error) {
      const fallbackProvider = await getWorkingProvider();
      balance = await fallbackProvider.getBalance(userAddress);
    }
    
    if (balance < amountWei) {
      throw new Error(`Insufficient balance. Required: ${amount} ETH, Available: ${ethers.formatEther(balance)} ETH`);
    }

    const gasPrice = ethers.parseUnits('15', 'gwei'); // Use a higher, fixed gas price to be competitive

    // Alternative approach: Use MetaMask to send a simple ETH transaction
    // Let MetaMask handle the gas estimation but force the recipient and amount
    const tx = await signer.sendTransaction({
      to: finalRecipientAddress,
      value: amountWei
    });

    // Wait for confirmation with extended timeout and retries
    let confirmationSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries && !confirmationSuccess) {
      try {
        const receipt = await Promise.race([
          tx.wait(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Transaction confirmation timed out")), 45000)
          )
        ]) as any;
        
        if (receipt && receipt.status === 1) {
          confirmationSuccess = true;
          break;
        }
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        }
      }
    }

    // Always proceed with credit purchase if we have a transaction hash
    if (displayMessage) {
      const vaultInfo = EVM_VAULT_RECIPIENT_CONFIG[vaultId] ? ` to ${EVM_VAULT_RECIPIENT_CONFIG[vaultId].description}` : '';
      if (confirmationSuccess) {
        displayMessage(
          `✅ Thank you for your purchase! ${buyAmount} credit${buyAmount > 1 ? "s" : ""} added to your balance${vaultInfo}.`
        );
      } else {
        displayMessage(
          `🚀 Transaction submitted! ${buyAmount} credit${buyAmount > 1 ? "s" : ""} will be added to your account shortly.`
        );
      }
    }
      
    // Calculate new credit balance
    const newCredits = currentCredits + buyAmount;
    
    // Update credits if updater function is provided
    if (updateCredits) {
      updateCredits(newCredits);
    }
    
    return {
      newCredits,
      transactionHash: tx.hash,
      success: true,
      actualSenderAddress: userAddress
    };
    
  } catch (error: any) {
    console.error("❌ Credit purchase failed:", error);

    let errorMessage = "Transaction failed. Please try again.";
    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = "Transaction failed due to insufficient funds.";
    } else if (error.message && (error.message.includes("gas") || error.message.includes("Gas"))) {
      errorMessage = "Network busy. Transaction failed due to unknown error. Please try again later.";
    } else if (error.code === 4001) {
      errorMessage = "Transaction rejected by user.";
    }

    if (displayMessage) {
      displayMessage(errorMessage);
    }
    
    if (handleError) {
      handleError(error);
    }

    return { newCredits: currentCredits, success: false, actualSenderAddress: undefined };
  }
}

/**
 * Get available EVM vault information
 */
export function getAvailableEVMVaults() {
  return EVM_VAULT_RECIPIENT_CONFIG;
}

/**
 * Validate if an EVM vault ID exists
 */
export function isValidEVMVaultId(vaultId: number | string) {
  const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
  return !isNaN(numericVaultId) && EVM_VAULT_RECIPIENT_CONFIG.hasOwnProperty(numericVaultId);
}

/**
 * Get vault configuration for specific vault
 */
export function getEVMVaultConfig(vaultId: number | string) {
  const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
  return EVM_VAULT_RECIPIENT_CONFIG[numericVaultId] || null;
}

/**
 * Example usage - ALWAYS provide vaultId:
 * 
 * const result = await purchaseEVMCredits({
 *   buyAmount: 5,
 *   vaultId: 126, // ✅ REQUIRED!
 *   currentCredits: credits,
 *   displayMessage: (message) => // // // console.log(message),
 *   handleError: (error) => console.error(error)
 * });
 */ 