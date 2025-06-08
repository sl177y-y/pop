/**
 * Utility for handling credit purchases using Aptos blockchain
 */
const VAULT_RECIPIENT_CONFIG = {
  111: {
    address: "0x57958ae03e93c6bf44bc484d97cc3a1491011bff18c37c99a28bada2d7092cdd",
    description: "Vault 111 - Gaming Rewards"
  },
  112: {
    address: "0xf17bc31dafdf0fe29aa35e554741c24d748b7fee14e5e020af6b53e44626f61f",
    description: "Vault 112 - DeFi Incentives"
  },
  113: {
    address: "0xbd284c5547f888cbc296e21a0fbe1bd52cb1c28560a4396a8578d54af42ed513",
    description: "Vault 113 - NFT Collections"
  },
  114: {
    address: "0xe71b1c8535f740a23fd84bf44bbeaf1663d4fd39e6d79a9355ddb7c104f87ce3",
    description: "Vault 114 - Community Rewards"
  }
};

/**
 * Get recipient address for a specific vault
 */
function getRecipientAddressForVault(vaultId) {
  const defaultAddress = "0xe020c2335af333a2e3d6a7930c14cf89727b28b5d4f5849228bb2c169d041c95";
  
  if (!vaultId) {
    console.log('No vault ID provided, using default recipient address');
    return defaultAddress;
  }

  const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
  
  if (isNaN(numericVaultId)) {
    console.log('Invalid vault ID, using default recipient address');
    return defaultAddress;
  }

  const vaultConfig = VAULT_RECIPIENT_CONFIG[numericVaultId];
  
  if (!vaultConfig) {
    console.log(`No recipient configuration found for vault ${numericVaultId}, using default address`);
    return defaultAddress;
  }

  console.log(`✅ Using ${vaultConfig.description} recipient: ${vaultConfig.address}`);
  return vaultConfig.address;
}

export interface CreditPurchaseParams {
  /** Number of credits to purchase */
  buyAmount: number;
  /** Cost per credit in APT */
  costPerCredit?: number;
  /** Vault ID to determine recipient address */
  vaultId?: number | string;
  /** Recipient wallet address (will be auto-determined by vaultId if not provided) */
  recipientAddress?: string;
  /** Current credit balance */
  currentCredits: number;
  /** Function to update credit state */
  updateCredits?: (newCredits: number) => void;
  /** Function for signing and submitting blockchain transactions */
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>;
  /** Optional function to display purchase confirmation messages */
  displayMessage?: (message: string) => void;
  /** Optional function to handle errors */
  handleError?: (error: unknown) => void;
}

/**
 * Purchases credits using APT tokens on the Aptos blockchain
 */
export async function purchaseCredits({
  buyAmount,
  costPerCredit = 0.1,
  vaultId,
  recipientAddress,
  currentCredits,
  updateCredits,
  signAndSubmitTransaction,
  displayMessage,
  handleError,
}: CreditPurchaseParams): Promise<{ 
  newCredits: number, 
  transactionHash?: string, 
  success: boolean 
}> {
  try {
    // Determine recipient address based on vaultId or use provided address
    const finalRecipientAddress = recipientAddress || getRecipientAddressForVault(vaultId);
    
    console.log(`💰 Processing credit purchase for vault ${vaultId}`);
    console.log(`🎯 Recipient address: ${finalRecipientAddress}`);
    
    // Calculate total cost in APT
    const amount = buyAmount * costPerCredit;
    
    // Verify recipient address exists with robust error handling
    try {
      const response = await fetch(
        `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${finalRecipientAddress}`,
        { 
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        }
      ).catch(error => {
        throw new Error("Network error checking recipient address. Please try again.");
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Invalid recipient address: ${finalRecipientAddress}`);
      }
    } catch (error) {
      if (displayMessage) {
        displayMessage(error instanceof Error ? error.message : "Transaction failed: Invalid recipient address.");
      }
      if (handleError) handleError(error);
      return { newCredits: currentCredits, success: false };
    }
    
    // Create transaction object
    const transaction = {
      data: {
        function: "0x1::aptos_account::transfer",
        typeArguments: [],
        functionArguments: [
           finalRecipientAddress,
          (amount * 100000000).toString(), // convert to octas (APT * 10^8)
        ],
      },
    };

    // Sign and submit transaction with safe error handling
    let response;
    try {
      response = await signAndSubmitTransaction(transaction);
      
      if (!response || !response.hash) {
        throw new Error("Transaction submission failed - no hash returned");
      }
    } catch (error) {
      // console.error("Transaction signing failed:", error);
      if (handleError) handleError(error);
      if (displayMessage) {
        if (error instanceof Error && error.message) {
          // Extract user-friendly message from error
          if (error.message.includes("rejected")) {
            displayMessage("Transaction cancelled by user.");
          } else if (error.message.includes("insufficient balance")) {
            displayMessage("Insufficient balance in your wallet.");
          } else {
            displayMessage("Failed to sign transaction. Please try again.");
          }
        } else {
          displayMessage("Transaction failed. Please try again.");
        }
      }
      return { newCredits: currentCredits, success: false };
    }
    
    // Wait for transaction confirmation with timeout
    let txResponse;
    let confirmationSuccess = false;
    try {
      const txCheckPromise = fetch(
        `https://fullnode.testnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`,
        { method: "GET" }
      );
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction check timed out")), 15000)
      );
      
      txResponse = await Promise.race([txCheckPromise, timeoutPromise]) as Response;
      
      if (!txResponse.ok) {
        const errorData = await txResponse.json().catch(() => ({}));
        // console.error("Transaction confirmation failed:", txResponse.status, errorData);
        confirmationSuccess = false;
        // console.log("Will proceed with credit purchase despite confirmation check failure");
      } else {
        // Check transaction success status
        const txData = await txResponse.json().catch(() => null);
        if (txData && txData.vm_status && txData.vm_status !== "Executed successfully") {
          // console.error("Transaction executed with error:", txData.vm_status);
          confirmationSuccess = false;
          // console.log("Will proceed with credit purchase despite VM status issue");
        } else {
          confirmationSuccess = true;
        }
      }
    } catch (error) {
      // console.error("Transaction confirmation error:", error);
      confirmationSuccess = false;
    }

    // Always proceed with credit purchase if we have a transaction hash
    // even if confirmation check failed
    // console.log(`Proceeding with credit purchase. Confirmation success: ${confirmationSuccess}`);
    
    if (displayMessage) {
      if (confirmationSuccess) {
        displayMessage(
          `Thank you for your purchase! ${buyAmount} credit${buyAmount > 1 ? "s" : ""} added to your balance.`
        );
      } else {
        displayMessage(
          `Transaction submitted! ${buyAmount} credit${buyAmount > 1 ? "s" : ""} will be added to your account shortly.`
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
      transactionHash: response.hash,
      success: true
    };
    
  } catch (error) {
    // Handle errors
    if (handleError) {
      handleError(error);
    } else {
      // console.error("Transaction failed:", error);
    }
    
    // Display error message if message handler is provided
    if (displayMessage) {
      displayMessage("Transaction failed. Please try again later.");
    }
    
    return {
      newCredits: currentCredits,
      success: false
    };
  }
}

/**
 * Save credits to localStorage
 * @param credits Number of credits to save
 */
export function saveCreditsToLocalStorage(credits: number): void {
  localStorage.setItem("credits", credits.toString());
}

/**
 * Load credits from localStorage
 * @returns Current credit balance or 0 if not found
 */
export function loadCreditsFromLocalStorage(): number {
  return parseInt(localStorage.getItem("credits") || "0");
}

/**
 * Example usage:
 * 
 * // Using with React state hooks
 * async function handleBuyCredits() {
 *   setIsBuying(true);
 *   
 *   try {
 *     const result = await purchaseCredits({
 *       buyAmount: 5,
 *       currentCredits: credits,
 *       signAndSubmitTransaction: yourWalletProvider.signAndSubmitTransaction,
 *       updateCredits: (newCredits) => {
 *         setCredits(newCredits);
 *         saveCreditsToLocalStorage(newCredits);
 *       },
 *       displayMessage: (message) => {
 *         // Add to UI or conversation
 *         addMessageToConversation({
 *           role: "assistant",
 *           content: message
 *         });
 *       }
 *     });
 *     
 *     if (result.success) {
 *       // console.log("Purchase successful, new balance:", result.newCredits);
 *     }
 *   } finally {
 *     setIsBuying(false);
 *   }
 * }
 */