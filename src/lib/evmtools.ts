/**
 * EVM Tools for Prize Distribution - Replicating Aptos Functionality
 * Vault 126 Specific Implementation
 */
import { ethers } from 'ethers';
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// EVM Vault Configuration
const EVM_VAULT_CONFIG = {
  126: {
    address: "0xcd9dbc15507c5fe4d1f61d3933ea92ba962ba249",
    description: "Vault 126 - EVM Gaming Rewards",
    network: "sepolia",
    rpcUrl: "https://sepolia.infura.io/v3/"
  }
};

/**
 * Get EVM provider for Sepolia network
 */
function getEVMProvider() {
  // Use a public Sepolia RPC endpoint
  return new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
}

/**
 * EVM Prize Distribution Tool - Replicates Aptos transferEth functionality
 */
export const evmTransferEth = tool(
  async ({ to_address, amount_eth, vault_id }: { to_address: string; amount_eth: string; vault_id: string }) => {
    try {
      // console.log(`🚀 EVM Transfer Request: ${amount_eth} ETH to ${to_address} from vault ${vault_id}`);

      // Validate vault ID
      const numericVaultId = parseInt(vault_id);
      if (isNaN(numericVaultId) || !EVM_VAULT_CONFIG[numericVaultId]) {
        return `❌ Error: Invalid vault ID ${vault_id}. Available EVM vaults: ${Object.keys(EVM_VAULT_CONFIG).join(', ')}`;
      }

      // Get private key from environment
      const privateKeyEnvVar = `EVM_PRIVATE_KEY_${vault_id}`;
      const privateKey = process.env[privateKeyEnvVar];
      
      if (!privateKey) {
        console.error(`❌ Private key not found: ${privateKeyEnvVar}`);
        return `❌ Error: Private key for vault ${vault_id} not configured. Cannot transfer ETH.`;
      }

      // Validate Ethereum address
      if (!ethers.isAddress(to_address)) {
        return `❌ Error: Invalid Ethereum address format: ${to_address}`;
      }

      // Parse amount
      let amountWei: bigint;
      try {
        amountWei = ethers.parseEther(amount_eth);
      } catch (error) {
        return `❌ Error: Invalid ETH amount format: ${amount_eth}`;
      }

      // Get provider and create wallet
      const provider = getEVMProvider();
      const wallet = new ethers.Wallet(privateKey, provider);
      const vaultConfig = EVM_VAULT_CONFIG[numericVaultId];

      // console.log(`💰 Using ${vaultConfig.description}`);
      // console.log(`🏦 From address: ${wallet.address}`);
      // console.log(`🎯 To address: ${to_address}`);
      // console.log(`💎 Amount: ${amount_eth} ETH`);

      // Check vault balance
      const balance = await provider.getBalance(wallet.address);
      // console.log(`💼 Vault balance: ${ethers.formatEther(balance)} ETH`);

      if (balance < amountWei) {
        return `❌ Error: Insufficient vault balance. Available: ${ethers.formatEther(balance)} ETH, Required: ${amount_eth} ETH`;
      }

      // Estimate gas
      const gasEstimate = await provider.estimateGas({
        to: to_address,
        value: amountWei,
        from: wallet.address
      });

      // Get current gas price
      const feeData = await provider.getFeeData();
      
      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100);

      // console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);
      // console.log(`⛽ Gas limit: ${gasLimit.toString()}`);

      // Send transaction
      const tx = await wallet.sendTransaction({
        to: to_address,
        value: amountWei,
        gasLimit: gasLimit,
        gasPrice: feeData.gasPrice,
      });

      // console.log(`🚀 Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      let confirmationStatus = "pending";
      try {
        const receipt = await Promise.race([
          tx.wait(1), // Wait for 1 confirmation
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("timeout")), 30000)
          )
        ]) as any;
        
        if (receipt && receipt.status === 1) {
          confirmationStatus = "success";
          // console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        } else {
          confirmationStatus = "failed";
          // console.log(`❌ Transaction failed or reverted`);
        }
      } catch (error) {
        // console.log(`⚠️ Confirmation timeout: ${error}`);
        confirmationStatus = "timeout";
      }

      // Return success message with transaction hash in the required format
      const statusText = confirmationStatus === "success" ? "success" : 
                        confirmationStatus === "failed" ? "failed" : "pending";
      
      return `✅ ETH transfer initiated successfully!
💰 Sent: ${amount_eth} ETH
🎯 To: ${to_address}
🏦 From: ${vaultConfig.description}
📋 Transaction Hash: ${tx.hash}
⛽ Gas Used: ${gasLimit.toString()}
🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}

[TRANSACTION_HASH]: ${tx.hash} (status: ${statusText})

The ETH has been transferred from the vault treasury to your wallet. You can verify the transaction on Sepolia Etherscan using the link above.`;

    } catch (error: any) {
      console.error('EVM Transfer Error:', error);
      
      if (error.message?.includes("insufficient")) {
        return `❌ Error: Insufficient vault balance for this transfer.`;
      } else if (error.message?.includes("gas")) {
        return `❌ Error: Gas estimation failed. The transaction may fail.`;
      } else if (error.message?.includes("network")) {
        return `❌ Error: Network connection issue. Please try again.`;
      } else {
        return `❌ Error: Transaction failed - ${error.message || 'Unknown error'}`;
      }
    }
  },
  {
    name: "evmTransferEth",
    description: "Transfer ETH from the vault treasury to a user's wallet address. Only use this when the user has demonstrated sufficient knowledge and deserves the prize. This is the EVM equivalent of the Aptos transferEth function.",
    schema: z.object({
      to_address: z.string().describe("The recipient's Ethereum wallet address"),
      amount_eth: z.string().describe("Amount of ETH to transfer (e.g., '0.001')"),
      vault_id: z.string().describe("The vault ID to transfer from (e.g., '126')")
    }),
  }
);

/**
 * EVM Balance Check Tool - Replicates Aptos getBalance functionality
 */
export const evmGetBalance = tool(
  async ({ vault_id }: { vault_id: string }) => {
    try {
      // console.log(`🔍 Checking EVM vault ${vault_id} balance...`);

      // Validate vault ID
      const numericVaultId = parseInt(vault_id);
      if (isNaN(numericVaultId) || !EVM_VAULT_CONFIG[numericVaultId]) {
        return `❌ Error: Invalid vault ID ${vault_id}. Available EVM vaults: ${Object.keys(EVM_VAULT_CONFIG).join(', ')}`;
      }

      // Get private key from environment to derive vault address
      const privateKeyEnvVar = `EVM_PRIVATE_KEY_${vault_id}`;
      const privateKey = process.env[privateKeyEnvVar];
      
      if (!privateKey) {
        return `❌ Error: Private key for vault ${vault_id} not configured.`;
      }

      const provider = getEVMProvider();
      const wallet = new ethers.Wallet(privateKey, provider);
      const vaultConfig = EVM_VAULT_CONFIG[numericVaultId];

      // Get balance
      const balance = await provider.getBalance(wallet.address);
      const balanceEth = ethers.formatEther(balance);

      // console.log(`💼 Vault ${vault_id} balance: ${balanceEth} ETH`);

      return `💼 ${vaultConfig.description} Balance:
🏦 Address: ${wallet.address}
💰 Balance: ${balanceEth} ETH
🌐 Network: Sepolia Testnet
🔗 View on Etherscan: https://sepolia.etherscan.io/address/${wallet.address}

This vault currently has ${balanceEth} ETH available for prize distribution.`;

    } catch (error: any) {
      console.error('EVM Balance Check Error:', error);
      return `❌ Error: Could not retrieve vault balance - ${error.message || 'Unknown error'}`;
    }
  },
  {
    name: "evmGetBalance",
    description: "Check the current ETH balance of the vault treasury. Use this to verify available funds before prize distribution.",
    schema: z.object({
      vault_id: z.string().describe("The vault ID to check balance for (e.g., '126')")
    }),
  }
);

/**
 * EVM Transaction Verification Tool
 */
export const evmVerifyTransaction = tool(
  async ({ tx_hash }: { tx_hash: string }) => {
    try {
      // console.log(`🔍 Verifying EVM transaction: ${tx_hash}`);

      if (!tx_hash.startsWith('0x') || tx_hash.length !== 66) {
        return `❌ Error: Invalid transaction hash format: ${tx_hash}`;
      }

      const provider = getEVMProvider();
      
      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(tx_hash);
      
      if (!receipt) {
        return `⚠️ Transaction not found or still pending: ${tx_hash}`;
      }

      const tx = await provider.getTransaction(tx_hash);
      
      if (!tx) {
        return `❌ Error: Could not retrieve transaction details for: ${tx_hash}`;
      }

      const status = receipt.status === 1 ? "✅ Success" : "❌ Failed";
      const valueEth = ethers.formatEther(tx.value);

      return `📋 Transaction Verification:
🔗 Hash: ${tx_hash}
✅ Status: ${status}
💰 Value: ${valueEth} ETH
🏦 From: ${tx.from}
🎯 To: ${tx.to}
⛽ Gas Used: ${receipt.gasUsed.toString()}
🧊 Block: ${receipt.blockNumber}
🔗 Etherscan: https://sepolia.etherscan.io/tx/${tx_hash}`;

    } catch (error: any) {
      console.error('EVM Transaction Verification Error:', error);
      return `❌ Error: Could not verify transaction - ${error.message || 'Unknown error'}`;
    }
  },
  {
    name: "evmVerifyTransaction",
    description: "Verify the status and details of an EVM transaction using its hash.",
    schema: z.object({
      tx_hash: z.string().describe("The transaction hash to verify (0x...)")
    }),
  }
);

/**
 * Export all EVM tools
 */
export const evmTools = [
  evmTransferEth,
  evmGetBalance,
  evmVerifyTransaction
];

/**
 * Get EVM vault configuration
 */
export function getEVMVaultConfig(vaultId: number | string) {
  const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
  return EVM_VAULT_CONFIG[numericVaultId] || null;
} 