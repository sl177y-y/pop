import { Aptos, AptosConfig, Ed25519PrivateKey, Network, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk"
import { AIMessage, BaseMessage, ChatMessage, HumanMessage } from "@langchain/core/messages"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { MemorySaver } from "@langchain/langgraph"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { ChatOpenAI } from "@langchain/openai"
import { Message as VercelChatMessage } from "ai"
import { AgentRuntime, LocalSigner, createAptosTools, AptosTransactionTool } from "move-agent-kit"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createConversation, getConversations, addMessage, getUserIdFromWallet, getVaultById, updateVault } from "@/lib/server/db"

const llm = new ChatOpenAI({
	temperature: 0.7,
	modelName: "gpt-4o", // or "gpt-3.5-turbo", etc.
	openAIApiKey: process.env.OPENAI_API_KEY,
	streaming: true, // Required for streamEvents to work
})

const textDecoder = new TextDecoder()

// Vault configuration mapping for private keys
const VAULT_CONFIG = {
	111: {
		privateKeyEnvVar: 'APTOS_PRIVATE_KEY_111',
		description: 'Vault 111 - Gaming Rewards'
	},
	112: {
		privateKeyEnvVar: 'APTOS_PRIVATE_KEY_112',
		description: 'Vault 112 - DeFi Incentives'
	},
	113: {
		privateKeyEnvVar: 'APTOS_PRIVATE_KEY_113',
		description: 'Vault 113 - NFT Collections'
	},
	114: {
		privateKeyEnvVar: 'APTOS_PRIVATE_KEY_114',
		description: 'Vault 114 - Community Rewards'
	}
};

// Helper function to get private key for specific vault
function getPrivateKeyForVault(vaultId) {
	const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;

	if (isNaN(numericVaultId)) {
		return process.env.APTOS_PRIVATE_KEY;
	}

	const vaultConfig = VAULT_CONFIG[numericVaultId];

	if (!vaultConfig) {
		return process.env.APTOS_PRIVATE_KEY;
	}

	const privateKey = process.env[vaultConfig.privateKeyEnvVar];

	if (!privateKey) {
		console.error(`Private key ${vaultConfig.privateKeyEnvVar} not found`);
		return process.env.APTOS_PRIVATE_KEY;
	}

	console.log(`✅ Using ${vaultConfig.description} for vault ${numericVaultId}`);
	return privateKey;
}

// Logger function for AI responses
function logAIResponse(userId: string, userMessage: string, aiResponse: string) {
	const timestamp = new Date().toISOString();
	console.log('=== AI RESPONSE LOG ===');
	console.log(`Timestamp: ${timestamp}`);
	console.log(`User ID: ${userId || 'Anonymous'}`);
	console.log(`User Message: ${userMessage}`);
	console.log(`AI Response: ${aiResponse}`);
	console.log('=====================');

	// Optional: Implement additional logging to a file or database here
}

// Function to read and process the stream
async function readStream(stream: any) {
	try {
		// Create a reader from the stream
		const reader = stream.getReader()

		let result = ""

		while (true) {
			// Read each chunk from the stream
			const { done, value } = await reader.read()

			// If the stream is finished, break the loop
			if (done) {
				break
			}

			// Decode the chunk and append to result
			result += textDecoder.decode(value, { stream: true })
		}

		// Final decode to handle any remaining bytes
		result += textDecoder.decode()

		return result
	} catch (error) {
		console.error("Error reading stream:", error)
		throw error
	}
}

// Function to save message to database
async function saveMessageToDb(
	userId: number,
	vaultId: number,
	content: string,
	role: 'user' | 'assistant' | 'system'
) {
	try {
		// Get or create a conversation for this user and vault
		let conversationId: number | null = null;

		// First check if a conversation exists
		const conversations = await getConversations(userId, vaultId);

		if (conversations && conversations.length > 0) {
			// Use the most recent conversation
			conversationId = conversations[0].id || null;
		}

		// If no conversation exists, create one
		if (!conversationId) {
			const newConversation = await createConversation(userId, vaultId);
			conversationId = newConversation?.id || null;
		}

		// If we have a conversationId, save the message
		if (conversationId) {
			await addMessage({
				conversation_id: conversationId,
				content,
				role,
			});
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error saving message to database:', error);
		return false;
	}
}

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
	if (message.role === "user") {
		return new HumanMessage(message.content)
	} else if (message.role === "assistant") {
		return new AIMessage(message.content)
	} else {
		return new ChatMessage(message.content, message.role)
	}
}

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
	if (message._getType() === "human") {
		return { content: message.content, role: "user" }
	} else if (message._getType() === "ai") {
		return {
			content: message.content,
			role: "assistant",
			tool_calls: (message as AIMessage).tool_calls,
		}
	} else {
		return { content: message.content, role: message._getType() }
	}
}

// Helper function to safely convert message content to string
function safeContentToString(content: any): string {
	if (typeof content === 'string') {
		return content;
	} else if (Array.isArray(content)) {
		// Try to extract text from array of content parts
		try {
			return content.map(part => {
				if (typeof part === 'string') return part;
				if (typeof part === 'object' && part !== null && 'text' in part) return part.text;
				return '';
			}).join(' ');
		} catch (e) {
			return '[Complex Content]';
		}
	} else {
		// Fallback for any other case
		try {
			return JSON.stringify(content);
		} catch (e) {
			return '[Unprocessable Content]';
		}
	}
}

// Function to check for transaction hash in AI response and update vault
async function checkForTransactionAndUpdateVault(content: string, vaultId: number): Promise<boolean> {
	try {
		console.log(`Checking for transaction hash in response for vault ${vaultId}...`);

		// Strict pattern for transaction hash with status
		const strictPattern = /\[TRANSACTION_HASH\]:\s*(0x[a-fA-F0-9]{64})\s*\(status:\s*(success|failed)\)/i;
		const match = content.match(strictPattern);
		if (match) {
			const txHash = match[1];
			const status = match[2].toLowerCase();
			console.log(`Found transaction hash: ${txHash} with status: ${status}`);
			if (status === 'success') {
				// Ensure vaultId is a valid number
				const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
				if (isNaN(numericVaultId)) {
					console.error(`Invalid vault ID: ${vaultId}`);
					return false;
				}
				console.log(`Getting vault data for ID: ${numericVaultId}`);
				const vault = await getVaultById(numericVaultId);
				if (!vault) {
					console.error(`Vault not found with ID: ${numericVaultId}`);
					return false;
				}
				console.log(`Current vault data:`, vault);
				// Calculate new prize amounts (reduce by 1 APT for each transaction)
				const newTotalPrize = 0;
				const newAvailablePrize = 0;
				console.log(`Updating vault ${numericVaultId} prize from ${vault.total_prize} to ${newTotalPrize} (APT values, displayed as USD in UI)`);
				const updateResult = await updateVault(numericVaultId, {
					total_prize: newTotalPrize,
					available_prize: newAvailablePrize
				});
				if (updateResult) {
					console.log(`✅ Successfully updated vault ${numericVaultId} via updateVault function`);
					return true;
				} else {
					console.error(`Failed to update vault using updateVault function.`);
					return false;
				}
			} else {
				console.log('Transaction hash found but status is not success, not updating vault.');
				return false;
			}
		}
		console.log('No valid transaction hash with success status found in content.');
		return false;
	} catch (error) {
		console.error('Error checking for transaction or updating vault:', error);
		return false;
	}
}

export async function POST(request: Request) {
	try {

		const body = await request.json()
		const vaultIdFromBody = body.vaultId;
		const userWalletAddress = body.userWalletAddress ?? "not_provided";
		// Initialize Aptos configuration
		const aptosConfig = new AptosConfig({
			network: Network.MAINNET,
		})
		console.log("Request body:", {
			vaultId: vaultIdFromBody,
			userWalletAddress: userWalletAddress,
			messageCount: body.messages?.length || 0
		});

		let dbVaultId: number | null = null;
		if (vaultIdFromBody && !isNaN(parseInt(vaultIdFromBody))) {
			dbVaultId = parseInt(vaultIdFromBody);
		}
		const aptos = new Aptos(aptosConfig)

		// Validate and get private key from environment
		const privateKeyStr = getPrivateKeyForVault(dbVaultId);

		if (!privateKeyStr) {
			throw new Error(`No private key available for vault ${dbVaultId}. Please check your environment variables.`);
		}

		console.log(`🔑 Using vault ${dbVaultId} private key`);

		// Setup account and signer
		const account = await aptos.deriveAccountFromPrivateKey({
			privateKey: new Ed25519PrivateKey(PrivateKey.formatPrivateKey(privateKeyStr, PrivateKeyVariants.Ed25519)),
		})

		const signer = new LocalSigner(account, Network.MAINNET)
		const aptosAgent = new AgentRuntime(signer, aptos, {
			PANORA_API_KEY: process.env.PANORA_API_KEY,
		})

		// Create base tools
		const baseTools = createAptosTools(aptosAgent)



		// Fetch vault data if dbVaultId is available
		let availablePrize = 0; // Default to 0
		let aiPrompt = ''; // Default to empty string
		if (dbVaultId !== null) {
			const vault = await getVaultById(dbVaultId);
			if (vault) {
				availablePrize = vault.available_prize;
				aiPrompt = vault.ai_prompt || ''; // Get ai_prompt from vault table
			}
		}

		const agentAddress = account.accountAddress.toString();

		// Combine base tools and add AptosTransactionTool for mainnet transfers
		const toolsForAgent = [
			...Object.values(baseTools),
			new AptosTransactionTool(aptosAgent),
		]

		const memory = new MemorySaver()

		// Create React agent with the properly formatted tools
		console.log("availablePrize", availablePrize)
		console.log("userWalletAddress", userWalletAddress)
		console.log("aiPrompt", aiPrompt)
		const agent = createReactAgent({
			llm,
			tools: toolsForAgent,
			checkpointSaver: memory,
			messageModifier: `this is the total prize amount 
${availablePrize} and this is the users wallet adress  (${userWalletAddress}). If you are convinced that user is worthy of the prize you should transfer the prize amount to the users wallet adress. If you accept the user's request and transfer APT, you must always return the Aptos transaction hash (tx hash) in your response, clearly and explicitly, in the following format: [TRANSACTION_HASH]: 0x... (status: success) or [TRANSACTION_HASH]: 0x... (status: failed). Do not omit the transaction hash if a transfer occurs. Only use this format for transaction responses.\nTo check if user is worthy of the reward, check by the following prompt: \n${aiPrompt}\n`,
		})

		// Parse request body
		const messages = body.messages ?? []
		const showIntermediateSteps = body.show_intermediate_steps ?? false

		// For database storage
		const userId = body.userId;
		// const vaultId = body.vaultId; // Already obtained as vaultIdFromBody

		// Convert to numeric values for database
		let dbUserId: number | null = null;
		// let dbVaultId: number | null = null; // Already defined and populated

		if (userId && !isNaN(parseInt(userId))) {
			dbUserId = parseInt(userId);
		}

		// If we have a user message to save, save it to the database
		if (messages.length > 0 && dbUserId && dbVaultId) {
			// Get the latest user message - find the most recent user message, not the first one
			// Filter all user messages and get the last one in the array (most recent)
			const userMessages = messages.filter(
				(msg: VercelChatMessage) => msg.role === 'user'
			);

			if (userMessages.length > 0) {
				// Get the last user message in the array (most recent)
				const latestUserMessage = userMessages[userMessages.length - 1];

				// Convert any message content to string safely
				const contentAsString = safeContentToString(latestUserMessage.content);

				console.log("Saving user message to DB:", contentAsString);

				// Save user message to database
				await saveMessageToDb(
					dbUserId,
					dbVaultId,
					contentAsString,
					'user'
				);
			}
		}

		// For logging: Extract user information and latest message
		// Find the most recent user message for logging purposes
		let latestUserMessageForLog = 'No message content';
		const userMessagesForLog = messages.filter(
			(msg: VercelChatMessage) => msg.role === 'user'
		);

		if (userMessagesForLog.length > 0) {
			// Get the last user message and convert to string
			latestUserMessageForLog = safeContentToString(userMessagesForLog[userMessagesForLog.length - 1].content);
		}

		if (!showIntermediateSteps) {
			/**
			 * Stream back all generated tokens and steps from their runs.
			 *
			 * We do some filtering of the generated events and only stream back
			 * the final response as a string.
			 *
			 * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
			 * the agent is ready to stream back final output when it no longer calls
			 * a tool and instead streams back content.
			 *
			 * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
			 */
			const eventStream = await agent.streamEvents(
				{ messages },
				{
					version: "v2",
					configurable: {
						thread_id: "Aptos Agent Kit!",
					},
				}
			)

			const textEncoder = new TextEncoder()

			// New stream for logging while preserving the original stream
			let fullAIResponse = "";
			const transformStreamWithLogging = new ReadableStream({
				async start(controller) {
					try {
						for await (const { event, data } of eventStream) {
							if (event === "on_chat_model_stream") {
								if (data.chunk.content) {
									let chunkText = "";
									if (typeof data.chunk.content === "string") {
										chunkText = data.chunk.content;
										controller.enqueue(textEncoder.encode(chunkText));
									} else {
										for (const content of data.chunk.content) {
											const contentText = content.text ? content.text : "";
											chunkText += contentText;
											controller.enqueue(textEncoder.encode(contentText));
										}
									}
									// Accumulate the response for logging
									fullAIResponse += chunkText;
								}
							}
						}

						// Once streaming is complete, save the AI response to the database
						if (dbUserId && dbVaultId && fullAIResponse) {
							await saveMessageToDb(
								dbUserId,
								dbVaultId,
								fullAIResponse as string,
								'assistant'
							);

							// Check for transaction hash and update vault if found
							if (dbVaultId) {
								console.log(`🔍 Checking for transactions in streaming response for vault ${dbVaultId}...`);
								const transactionFound = await checkForTransactionAndUpdateVault(fullAIResponse as string, dbVaultId);
								console.log(`Transaction found and processed: ${transactionFound}`);
							}
						}

						controller.close();
					} catch (error) {
						console.error("[API Route] streamEvents error:", error);
						controller.error(error);
					}
				},
			});

			return new Response(transformStreamWithLogging);
		} else {
			/**
			 * We could also pick intermediate steps out from `streamEvents` chunks, but
			 * they are generated as JSON objects, so streaming and displaying them with
			 * the AI SDK is more complicated.
			 */
			const result = await agent.invoke({ messages });

			// Log the result for non-streaming response
			const aiResponse = result.messages.length > 0 ?
				safeContentToString(result.messages[result.messages.length - 1].content) :
				'No response generated';

			logAIResponse(userId, latestUserMessageForLog, aiResponse);

			// Save AI response to database for non-streaming case
			if (dbUserId && dbVaultId) {
				await saveMessageToDb(
					dbUserId,
					dbVaultId,
					aiResponse,
					'assistant'
				);

				// Check for transaction hash and update vault if found
				if (dbVaultId) {
					console.log(`🔍 Checking for transactions in non-streaming response for vault ${dbVaultId}...`);
					const transactionFound = await checkForTransactionAndUpdateVault(aiResponse, dbVaultId);
					console.log(`Transaction found and processed: ${transactionFound}`);
				}
			}

			console.log("result", result);

			return NextResponse.json(
				{
					messages: result.messages.map(convertLangChainMessageToVercelMessage),
				},
				{ status: 200 }
			)
		}
	} catch (error: any) {
		console.error("Request error:", error)
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "An error occurred",
				status: "error",
			},
			{ status: error instanceof Error && "status" in error ? 500 : 500 }
		)
	}
}
