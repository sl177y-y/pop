import { NextResponse } from "next/server";
import { Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";

// POST endpoint to send 1 Octa (0.00000001 APT) to a given Aptos wallet address
export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress in request body" }, { status: 400 });
    }

    // Get private key from environment
    const privateKeyStr = process.env.APTOS_PRIVATE_KEY;
    if (!privateKeyStr) {
      return NextResponse.json({ error: "Server misconfiguration: missing APTOS_PRIVATE_KEY" }, { status: 500 });
    }

    // Setup Aptos SDK
    const aptosConfig = new AptosConfig({ network: Network.MAINNET });
    const aptos = new Aptos(aptosConfig);
    const privateKey = new Ed25519PrivateKey(PrivateKey.formatPrivateKey(privateKeyStr, PrivateKeyVariants.Ed25519));
    const sender = await aptos.deriveAccountFromPrivateKey({ privateKey });

    // Prepare transaction: send 1 Octa (1e-8 APT) using aptos_account::transfer
    const transactionPayload = {
      function: '0x1::aptos_account::transfer',
      typeArguments: [], // <-- Fix: aptos_account::transfer expects 0 type arguments
      functionArguments: [walletAddress, '1'], // 1 Octa
    } as any;

    try {
      // Build transaction
      const txn = await aptos.transaction.build.simple({
        sender: sender.accountAddress,
        data: transactionPayload,
      });
      // Sign transaction
      const signedTxn = await aptos.sign({ signer: sender, transaction: txn });
      // Submit transaction (signedTxn is AccountAuthenticator, but submit.simple expects transaction and senderAuthenticator)
      const submitResponse = await aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: signedTxn });
      await aptos.waitForTransaction({ transactionHash: submitResponse.hash });
      return NextResponse.json({ success: true, hash: submitResponse.hash });
    } catch (txError: any) {
      // Enhanced error logging
      console.error('[Aptos Register Coin] Transaction error:', txError);
      if (txError?.response) {
        try {
          const errorBody = await txError.response.text();
          console.error('[Aptos Register Coin] Error response body:', errorBody);
        } catch (parseErr) {
          console.error('[Aptos Register Coin] Failed to parse error response body:', parseErr);
        }
      }
      // Log additional error details if available
      if (txError?.transaction) {
        console.error('[Aptos Register Coin] Transaction object:', JSON.stringify(txError.transaction, null, 2));
      }
      if (txError?.stack) {
        console.error('[Aptos Register Coin] Error stack:', txError.stack);
      }
      if (txError?.data) {
        console.error('[Aptos Register Coin] Error data:', JSON.stringify(txError.data, null, 2));
      }
      // Detect coin not registered error (Aptos VM abort)
      const errorMsg = txError?.message || txError?.toString() || "Unknown error";
      // Check for VM status in error object or transaction result
      const vmStatus = txError?.transaction?.vm_status;
      if (
        (vmStatus && vmStatus.includes("ECOIN_STORE_NOT_PUBLISHED")) ||
        (vmStatus && vmStatus.includes("hasn't registered `CoinStore`")) ||
        errorMsg.includes("EDESTROY_UNPUBLISHED") ||
        (errorMsg.includes("Move abort") && errorMsg.includes("coin::transfer") && errorMsg.includes("unpublished")) ||
        errorMsg.includes("requires the recipient to register the coin")
      ) {
        return NextResponse.json({ error: "COIN_NOT_REGISTERED", message: "Recipient wallet has not registered the APT coin." }, { status: 409 });
      }
      // Other errors
      return NextResponse.json({ error: errorMsg, vm_status: vmStatus }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
