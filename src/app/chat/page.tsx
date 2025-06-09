"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Head from "next/head"; // Import Head
import BorderFrame from "@/components/BorderFrame";
import { useChat } from "ai/react";
import { Message as VercelChatMessage } from "ai";
import { purchaseCredits } from "@/lib/buycredit";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useMobileDetect } from '@/lib/mobileDetectStore';
import { convertAndFormatAptToUsd } from '@/lib/priceUtils';
import { getVerificationStatus } from '@/lib/indexedDBUtils';

// API helpers
async function fetchUserIdFromWallet(walletAddress: string): Promise<number | null> {
  const res = await fetch(`/api/users?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

async function fetchVaultById(vaultId: number) {
  const res = await fetch(`/api/vaults?id=${vaultId}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchConversations(userId: number, vaultId?: number): Promise<any[]> {
  let url = `/api/conversations?user_id=${userId}`;
  if (vaultId) url += `&vault_id=${vaultId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function fetchMessages(conversationId: number): Promise<any[]> {
  const res = await fetch(`/api/conversations/messages?conversation_id=${conversationId}`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchUserCredits(walletAddress: string): Promise<number> {
  const res = await fetch(`/api/users/credits?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.credits ?? 0;
}

async function updateUserCreditsAPI(walletAddress: string, amount: number, operation: 'add' | 'subtract') {
  const res = await fetch('/api/users/credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress, amount, operation })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.credits ?? null;
}

async function updateVaultAPI(vaultId: number, vaultData: any) {
  const res = await fetch('/api/vaults', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: vaultId, ...vaultData })
  });
  if (!res.ok) return null;
  return res.json();
}

export default function Chat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultData, setVaultData] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [loadedPreviousMessages, setLoadedPreviousMessages] = useState(false);
  const [shouldSetInitialGreeting, setShouldSetInitialGreeting] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [isBuying, setIsBuying] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const [showFaucetLink, setShowFaucetLink] = useState(false);
  const [routeValidationError, setRouteValidationError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userWalletAddressForChat, setUserWalletAddressForChat] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<any>(null);
  const router = useRouter();

  // Get the wallet for purchasing credits
  const { account, signAndSubmitTransaction } = useWallet();

  // Inside the Chat component function, add these lines near the top with other state variables
  const { isMobile } = useMobileDetect();
  
  // Helper function to determine which mascot image to use based on vault ID
  const getMascotImage = () => {
    // Check if vault ID is specifically 113 (DFusion vault)
    const numericVaultId = vaultId ? parseInt(String(vaultId)) : null;
    
    if (numericVaultId === 113) {
      return "/dfusion/mascoty2.png"; // Changed from /dfusion/ball.pn
    }
    
    // Default mascot image for other vaults
    return "/zoravault.png";
  };

  // Helper function to validate string values
  const isValidString = (value: string | null | undefined): boolean => {
    return typeof value === 'string' && value.trim().length > 0;
  };

  // Helper function to validate numeric values
  const isValidNumber = (value: number | string | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    const num = typeof value === 'string' ? parseInt(value) : value;
    return !isNaN(num);
  };

  // Validate access to the chat page
  useEffect(() => {
    const validateAccess = async () => {
      console.log("Initiating chat page access validation...");
      try {
        // Check if a vault ID is in localStorage
        const selectedVaultId = localStorage.getItem('selectedVaultId');
        console.log("1. Checking for selectedVaultId:", selectedVaultId);
        
        if (!selectedVaultId) {
          console.error('No vault selected - redirecting to vault selection page');
          setRouteValidationError('Please select a vault first');
          
          // Wait 2 seconds before redirecting
          setTimeout(() => {
            router.push('/vault');
          }, 2000);
          return;
        }
        console.log("   selectedVaultId check PASSED.");
        
        // Get wallet address
        const walletAddress = localStorage.getItem('userWalletAddress') || 
                             localStorage.getItem('wallet_address') || 
                             localStorage.getItem('walletAddress') || 
                             localStorage.getItem('aptosWalletAddress');
        console.log("2. Checking for walletAddress:", walletAddress);
        
        if (!walletAddress) {
          console.error('No wallet address found - redirecting to verify page');
          setRouteValidationError('Please connect your wallet first');
          
          setTimeout(() => {
            router.push('/verify');
          }, 2000);
          return;
        }
        console.log("   walletAddress check PASSED.");
        
        // Get user ID from wallet address
        console.log("3. Fetching userId for walletAddress:", walletAddress);
        const userId = await fetchUserIdFromWallet(walletAddress);
        console.log("   Fetched userId:", userId);
        
        if (!userId) {
          console.error('No user ID found - redirecting to verify page');
          setRouteValidationError('User not found. Please complete verification first');
          
          setTimeout(() => {
            router.push('/verify');
          }, 2000);
          return;
        }
        console.log("   userId check PASSED.");
        
        // Check if user has completed verification for this vault using IndexedDB
        console.log("4. Checking verification status in IndexedDB for vaultId:", selectedVaultId);
        const verificationStatus = await getVerificationStatus(selectedVaultId);
        console.log("   IndexedDB verificationStatus result:", verificationStatus);
        
        if (!verificationStatus || !verificationStatus.allStepsVerified) {
          console.error('Verification not complete in IndexedDB for this vault - redirecting to verify page');
          setRouteValidationError('Please complete verification first');
          
          setTimeout(() => {
            router.push('/verify');
          }, 2000);
          return;
        }
        console.log("   IndexedDB verification check (allStepsVerified) PASSED.");
        
        // If all checks pass, allow access to chat
        console.log('All access checks PASSED. Access to chat validated.');
        
      } catch (error) {
        console.error('Error during chat access validation:', error);
        setRouteValidationError('Error validating access. Please try again.');
        
        setTimeout(() => {
          router.push('/vault');
        }, 2000);
      }
    };
    
    validateAccess();
  }, [router]);

  // Log session initialization - only proceed if validation was successful
  useEffect(() => {
    // Skip initialization if there's a validation error
    if (routeValidationError) return;
    
    const initializeChat = async () => {
      try {
        // Get vault ID from localStorage
        const selectedVaultId = localStorage.getItem('selectedVaultId');
        // console.log('Retrieved selectedVaultId from localStorage:', selectedVaultId);
        
        if (selectedVaultId) {
          setVaultId(selectedVaultId);
          
          // Fetch vault data
          if (isValidNumber(selectedVaultId)) {
            const vault = await fetchVaultById(parseInt(selectedVaultId));
            if (vault) {
              // console.log('Retrieved vault data:', vault);
              setVaultData(vault);
            } else {
              // console.warn('No vault data found for ID:', selectedVaultId);
            }
          } else {
            // console.warn('Invalid vault ID format:', selectedVaultId);
          }
        } else {
          // console.warn('No vault ID found in localStorage');
        }
        
        // Check multiple possible localStorage keys for wallet address
        let walletAddress = localStorage.getItem('userWalletAddress');
        
        // Fallback to other possible keys
        if (!walletAddress) {
          walletAddress = localStorage.getItem('wallet_address') || 
                          localStorage.getItem('walletAddress') || 
                          localStorage.getItem('aptosWalletAddress');
          // console.log('Retrieved wallet address from alternative keys:', walletAddress);
        } else {
          // console.log('Retrieved wallet address from userWalletAddress:', walletAddress);
          // Ensure this value is also accessible later when chatting
          localStorage.setItem('wallet_address', walletAddress);
        }
        
        if (walletAddress) {
          // Set wallet address for chat API
          setUserWalletAddressForChat(walletAddress);
          
          try {
            if (isValidString(walletAddress)) {
              // TypeScript needs this extra check to narrow the type
              if (walletAddress !== null) {
                // First try to get userId from localStorage cache
                let dbUserId: string | number | null = localStorage.getItem('cachedUserId');
                
                // If not in cache, fetch from database
                if (!dbUserId) {
                  dbUserId = await fetchUserIdFromWallet(walletAddress.trim());
                  // console.log('User ID from wallet address (DB):', dbUserId);
                } else {
                  // console.log('User ID from cache:', dbUserId);
                }
                
                if (dbUserId) {
                  setUserId(dbUserId.toString());
                  
                  // Try to get user credits from localStorage cache first
                  const cachedCredits = localStorage.getItem('cachedUserCredits');
                  if (cachedCredits && !isNaN(Number(cachedCredits))) {
                    // console.log('User credits from cache:', cachedCredits);
                    setUserCredits(Number(cachedCredits));
                  } else {
                    // Fetch user credits from database as fallback
                    const credits = await fetchUserCredits(walletAddress);
                    // console.log('User credits from DB:', credits);
                    setUserCredits(credits);
                    // Update cache
                    localStorage.setItem('cachedUserCredits', credits.toString());
                  }
                } else {
                  // console.warn('User ID not found for wallet address:', walletAddress);
                  // Generate a random user ID if not found in the database
                  const randomId = `user-${Math.random().toString(36).substring(2, 10)}`;
                  setUserId(randomId);
                  // console.log('Generated random user ID:', randomId);
                }
              }
            } else {
              // console.warn('Invalid wallet address format:', walletAddress);
              const randomId = `user-${Math.random().toString(36).substring(2, 10)}`;
              setUserId(randomId);
              if (account?.address) setUserWalletAddressForChat(account.address);
            }
          } catch (err) {
            // console.error('Error getting user ID from wallet:', err);
            const randomId = `user-${Math.random().toString(36).substring(2, 10)}`;
            setUserId(randomId);
            // console.log('Generated random user ID after error:', randomId);
            if (account?.address) setUserWalletAddressForChat(account.address);
          }
        } else {
          // console.warn('No wallet address found in localStorage');
          // Generate a random user ID if no wallet address is found
          const randomId = `user-${Math.random().toString(36).substring(2, 10)}`;
          setUserId(randomId);
          // console.log('Generated random user ID (no wallet):', randomId);
          // If we have account from wallet, use that address
          if (account?.address) {
            // console.log('Using wallet account address:', account.address);
            setUserWalletAddressForChat(account.address);
          }
        }
      } catch (error) {
        // console.error('Error initializing chat:', error);
        // Fallback to random ID
        const randomId = `user-${Math.random().toString(36).substring(2, 10)}`;
        setUserId(randomId);
        // console.log('Generated random user ID after exception:', randomId);
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
    return () => {
      // console.log(`[ChatUI] Session ended for ID: ${userId}`);
    };
  }, [routeValidationError, account?.address]);

  // Effect for polling vault and user data every 1 second
  useEffect(() => {
    if (routeValidationError) return; // Don't poll if there is a validation error

    const intervalId = setInterval(async () => {
      // console.log("Polling for data updates...");
      try {
        // Refresh vault data
        const selectedVaultId = localStorage.getItem('selectedVaultId');
        if (selectedVaultId && isValidNumber(selectedVaultId)) {
          const vault = await fetchVaultById(parseInt(selectedVaultId));
          if (vault) {
            setVaultData(vault);
            // console.log("Refreshed vault data:", vault);
          }
        }

        // Refresh user credits
        const walletAddress = localStorage.getItem('userWalletAddress') || localStorage.getItem('wallet_address');
        if (walletAddress && isValidString(walletAddress)) {
           // TypeScript needs this extra check to narrow the type
          if (walletAddress !== null) { 
            const credits = await fetchUserCredits(walletAddress.trim());
            setUserCredits(credits);
            // Update cache
            localStorage.setItem('cachedUserCredits', credits.toString());
            // console.log("Refreshed user credits:", credits);
          }
        }
      } catch (error) {
        // console.error("Error during polling:", error);
      }
    }, 1000); // Poll every 1 second

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [routeValidationError]); // Re-run effect if routeValidationError changes

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleChatSubmit,
    isLoading: aiLoading,
    append,
    error,
    setMessages,
  } = useChat({
    api: '/api/hello',
    body: {
      userId: userId,
      vaultId: vaultId,
      userWalletAddress: userWalletAddressForChat,
    },
    initialMessages: [],
    streamMode: "text",
    onResponse: (response) => {
      console.log("[ChatUI useChat] onResponse: Received response object:", response);
      console.log("[ChatUI useChat] Response status:", response.status);
      console.log("[ChatUI useChat] Response OK:", response.ok);
      if (!response.ok) {
        console.error("[ChatUI useChat] onResponse: Response not OK", response.status, response.statusText);
      }
    },
    onFinish: async (message) => {
      // console.log("[ChatUI useChat] onFinish: Stream finished. Last AI message:", message);
      
      // Check if the message contains a transaction hash
      if (message.content && checkForTransactionHash(message.content.toString())) {
        // console.log("Transaction detected in AI message, refreshing vault data");
        refreshVaultData();
      }

      // Check for VAULT_UNLOCKED message from AI
      if (message.content && message.content.includes("VAULT_UNLOCKED")) {
        console.log("[ChatUI] VAULT_UNLOCKED detected!");
        if (vaultData && vaultData.name) {
          localStorage.setItem('lastWonVaultName', vaultData.name);
        }
        if (vaultData && vaultData.total_prize) {
          // Convert prize to a user-friendly format if necessary, e.g., from smallest unit
          const prizeString = convertAndFormatAptToUsd(vaultData.total_prize); // Assuming convertAndFormatAptToUsd handles this
          localStorage.setItem('lastWonPrizeAmount', prizeString);
        }
        router.push('/win');
        return; // Stop further processing in onFinish if vault is unlocked
      }
      
      // Reduce user credits by 1 after AI response (if not a win)
      // Get wallet address from localStorage
      const walletAddress = userWalletAddressForChat || 
                          localStorage.getItem('userWalletAddress') || 
                          localStorage.getItem('wallet_address') || 
                          localStorage.getItem('walletAddress') || 
                          localStorage.getItem('aptosWalletAddress');
      
      if (isValidString(walletAddress)) {
        try {
          // Subtract 1 credit from user's account
          const newCredits = await updateUserCreditsAPI(walletAddress as string, 1, 'subtract');
          // console.log('Reduced user credits by 1. New balance:', newCredits);
          
          // Update the local state
          if (newCredits !== null) {
            setUserCredits(newCredits);
            // Also update the cached credits
            localStorage.setItem('cachedUserCredits', newCredits.toString());
          }
        } catch (error) {
          // console.error('Error updating user credits:', error);
        }
      } else {
        // console.error('Invalid wallet address for credit deduction:', walletAddress);
      }
    },
    onError: (err) => {
      // console.error("[ChatUI useChat] onError: An error occurred:", err);
    }
  });

  // Function to check if a message contains a successful transaction hash in the required format
  const checkForTransactionHash = (content: string): boolean => {
    // Strict pattern for transaction hash with status
    const strictPattern = /\[TRANSACTION_HASH\]:\s*(0x[a-fA-F0-9]{64})\s*\(status:\s*(success|failed)\)/i;
    const match = content.match(strictPattern);
    if (match && match[2].toLowerCase() === 'success') {
      return true;
    }
    return false;
  };

  // Function to refresh the vault data from the database
  const refreshVaultData = async () => {
    if (vaultId && isValidNumber(vaultId)) {
      try {
        // console.log("Refreshing vault data for ID:", vaultId);
        const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
        // Ensure numericVaultId is a valid number before passing to the function
        if (!isNaN(numericVaultId)) {
          // Using type assertion since we've validated the number
          const updatedVault = await fetchVaultById(numericVaultId as number);
          
          if (updatedVault) {
            // console.log("Updated vault data:", updatedVault);
            setVaultData(updatedVault);
          } else {
            // console.warn("Failed to refresh vault data");
          }
        } else {
          // console.warn("Invalid vault ID after conversion:", vaultId);
        }
      } catch (error) {
        // console.error("Error refreshing vault data:", error);
      }
    } else {
      // console.warn("Invalid vault ID for refresh:", vaultId);
    }
  };

  // Also check for transaction hashes in existing messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Check the last message if it's from the assistant
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && 
          lastMessage.content && 
          checkForTransactionHash(lastMessage.content.toString())) {
        // console.log("Transaction detected in latest message, refreshing vault data");
        refreshVaultData();
      }
    }
  }, [messages]);

  // Improved loadPreviousMessages function
  const loadPreviousMessages = async (retryCount = 0) => {
    // Skip if either value is missing
    if (!userId || !vaultId) {
      // console.log('Missing userId or vaultId, skipping chat history load');
      
      // If we've tried less than 3 times and we're not loading, retry
      if (retryCount < 3 && !loading) {
        // console.log(`Will retry loading messages in 1 second (attempt ${retryCount + 1} of 3)`);
        setTimeout(() => loadPreviousMessages(retryCount + 1), 1000);
      } else if (retryCount >= 3) {
        // After 3 attempts, show default greeting
        // console.log('Max retries reached, using default greeting');
        setShouldSetInitialGreeting(true);
      }
      return;
    }
    
    try {
      // Get numeric ID values (ensuring they're valid numbers)
      let numericUserId: number | null = null;
      let numericVaultId: number | null = null;
      
      try {
        numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
        numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId) : vaultId;
      } catch (e) {
        // console.error('Error parsing IDs:', e);
      }
      
      // Make sure we have valid numeric IDs
      if (!isValidNumber(numericUserId) || !isValidNumber(numericVaultId)) {
        // console.error('Invalid user ID or vault ID', { 
        //   userId, 
        //   vaultId, 
        //   numericUserId, 
        //   numericVaultId 
        // });
        
        // If we've tried less than 3 times, retry
        if (retryCount < 3) {
          // console.log(`Will retry with better IDs in 1 second (attempt ${retryCount + 1} of 3)`);
          setTimeout(() => loadPreviousMessages(retryCount + 1), 1000);
        } else {
          // After 3 attempts, show default greeting
          // console.log('Max retries reached, using default greeting');
          setShouldSetInitialGreeting(true);
        }
        return;
      }
      
      // console.log(`Fetching conversations for user ${numericUserId} and vault ${numericVaultId}`);
      
      // Get conversations for this user and vault
      const conversations = await fetchConversations(numericUserId as number, numericVaultId as number);
      
      if (!conversations || conversations.length === 0) {
        // console.warn('No conversations returned from database');
        setShouldSetInitialGreeting(true);
        setLoadedPreviousMessages(true); // Mark as loaded so we don't keep trying
        return;
      }
      
      // console.log(`Found ${conversations.length} conversations`);
      
      // Get the most recent conversation
      const conversationId = conversations[0].id;
      
      if (isValidNumber(conversationId)) {
        // console.log(`Loading messages for conversation ID ${conversationId}`);
        
        // Get messages for this conversation
        const previousMessages = await fetchMessages(Number(conversationId));
        
        if (!previousMessages || previousMessages.length === 0) {
          // console.warn('No messages returned from database');
          setShouldSetInitialGreeting(true);
          setLoadedPreviousMessages(true);
          return;
        }
        
        // console.log(`Found ${previousMessages.length} messages`);
        
        // Format messages for the chat component
        const formattedMessages = previousMessages.map(msg => ({
          id: msg.id?.toString() || `db-msg-${Math.random()}`,
          role: msg.role,
          content: msg.content
        }));
        
        // console.log('Setting formatted messages:', formattedMessages.length);
        
        // Set the messages in the chat
        setMessages(formattedMessages);
        setLoadedPreviousMessages(true);
        // console.log(`[ChatUI] Loaded ${formattedMessages.length} previous messages`);
      } else {
        // console.warn('Retrieved conversation has invalid ID:', conversationId);
        setShouldSetInitialGreeting(true);
      }
    } catch (error) {
      // console.error('Error loading previous messages:', error);
      
      // If we've tried less than 3 times, retry
      if (retryCount < 3) {
        // console.log(`Will retry loading messages in 1 second (attempt ${retryCount + 1} of 3)`);
        setTimeout(() => loadPreviousMessages(retryCount + 1), 1000);
      } else {
        // After 3 attempts, show default greeting
        // console.log('Max retries reached, using default greeting');
        setShouldSetInitialGreeting(true);
      }
    }
  };

  // Fetch previous conversation messages when userId and vaultId are available
  useEffect(() => {
    if (userId && vaultId && !loadedPreviousMessages) {
      // console.log(`Attempting to load previous messages (userId: ${userId}, vaultId: ${vaultId})`);
      loadPreviousMessages();
    }
  }, [userId, vaultId, loadedPreviousMessages, setMessages]);
  
  // Add a safeguard to ensure messages are loaded even if state changes
  useEffect(() => {
    // If no messages after 3 seconds and we've finished loading, try once more
    let checkTimeout: NodeJS.Timeout;
    
    if (!loading && messages.length === 0 && !shouldSetInitialGreeting && !loadedPreviousMessages) {
      checkTimeout = setTimeout(() => {
        // console.log('No messages after timeout - attempting to reload messages');
        loadPreviousMessages();
      }, 3000);
    }
    
    return () => {
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, [loading, messages.length, shouldSetInitialGreeting, loadedPreviousMessages]);

  // Check if we need to show the initial greeting
  useEffect(() => {
    // If not loading and no previous messages were loaded and chat is empty
    if (!loading && !loadedPreviousMessages && messages.length === 0) {
      // console.log('Setting initial greeting flag');
      setShouldSetInitialGreeting(true);
    }
  }, [loading, loadedPreviousMessages, messages.length]);

  // Apply the initial greeting when needed
  useEffect(() => {
    if (shouldSetInitialGreeting && setMessages) {
      // console.log('Adding initial greeting message');
      setMessages([
        {
          id: 'initial-zora-message',
          role: 'assistant',
          content: `Greetings, visitor! Welcome to the Zura Vault challenge.<br/><br/>
<span style="font-weight:bold;">Game Rules & Instructions:</span><br/>
<span>1. Each message you send costs 1 credit.</span><br/>
<span>2. You can buy 5 credits for 0.5 APT.</span><br/>
<span>3. Your goal: Convince Zura to unlock the vault by sending a compelling message.</span><br/>
<span>4. If you run out of credits, you can purchase more to continue playing.</span><br/>

Good luck!`,
        }
      ]);
      setShouldSetInitialGreeting(false);
    }
  }, [shouldSetInitialGreeting, setMessages]);

  // Count user attempts based on the messages from useChat
  const userAttempts = messages.filter(m => m.role === 'user').length;

  // Create a function to handle form submission with proper React state handling
  const handleSubmit = (e: React.FormEvent) => {
    // Prevent form submission default behavior
    e.preventDefault();
    
    console.log('🚀 Form submit attempted');
    console.log('📝 Input value:', input);
    console.log('💰 User credits:', userCredits);
    console.log('⏳ AI loading:', aiLoading);
    
    // Trim the message and check if it's empty
    const trimmedMessage = input.trim();
    if (!trimmedMessage) {
      console.log('❌ Message is empty, not submitting');
      return;
    }
    
    if (userCredits <= 0) {
      console.log('❌ No credits available, not submitting');
      return;
    }
    
    if (aiLoading) {
      console.log('❌ AI is loading, not submitting');
      return;
    }
    
    console.log('✅ All checks passed, submitting message');
    
    // Call the handleSubmit from useChat.
    // This will automatically append the user message and then handle the API call.
    handleChatSubmit(e);
  };

  // Toggle sidebar visibility for mobile view
  const toggleSidebar = () => {
    // Disable sidebar toggle for iPad Mini (768x1024) devices
    const isIpadMini = window.innerWidth === 768 && window.innerHeight === 1025 || 
                       window.innerWidth === 1024 && window.innerHeight === 768;
    
    if (isMobile || isIpadMini) return; // disable sidebar toggle on mobile and iPad Mini
    
    setSidebarVisible(!sidebarVisible);
    
    if (sidebarVisible) {
      document.body.style.overflow = 'auto';
      // Scroll chat to bottom after sidebar closes with a slight delay
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } else {
      // If opening sidebar, prevent background scrolling on mobile
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    }
  };

  useEffect(() => {
    if (error) {
      // console.error("[ChatUI useEffect] Detected error from useChat:", error);
    }
  }, [error]);

  // Handle Buy Credits button click
  const handleBuyCredits = async (amount = 5) => {
    if (!account || !account.address) {
      setPurchaseStatus("Wallet not connected. Please connect your wallet first.");
      return;
    }

    if (!isValidNumber(amount) || amount <= 0) {
      setPurchaseStatus("Invalid credit amount");
      return;
    }

    setIsBuying(true);
    setPurchaseStatus("Processing transaction...");
    setShowFaucetLink(false);
    setDebugError(null); // Reset debug error on new attempt
    
    try {
      // console.log('[CREDIT PURCHASE] Starting purchase process for', amount, 'credits');
      
      // Ensure we have the latest wallet address updated
      if (account.address) {
        setUserWalletAddressForChat(account.address);
      }
      
    
      
      const result = await purchaseCredits({
        buyAmount: amount,
        currentCredits: userCredits,
        signAndSubmitTransaction,
        updateCredits: (newCredits) => {
          setUserCredits(newCredits);
        },
        displayMessage: (message) => {
          setPurchaseStatus(message);
        },
        handleError: (error) => {
          // console.error("[CREDIT PURCHASE] Transaction error:", error);
          
          // Save detailed error for debugging
          setDebugError({source: "transaction", error});
          
          // Check for specific error types
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes("User rejected")) {
            setPurchaseStatus("Transaction cancelled by user.");
          } else if (errorMessage.includes("Insufficient balance")) {
            setPurchaseStatus("Insufficient balance in your wallet. Get testnet APT from the faucet.");
            setShowFaucetLink(true);
          } else if (errorMessage.includes("account not found") || errorMessage.includes("Account not found")) {
            setPurchaseStatus("Your wallet needs testnet APT. Visit Aptos Faucet to get free test tokens.");
            setShowFaucetLink(true);
          } else {
            setPurchaseStatus("Transaction failed. Please try again.");
          }
        }
      });
      
      if (result.success) {
        // console.log("[CREDIT PURCHASE] Purchase successful, new balance:", result.newCredits);
        
        // Update the database with the new credit balance
        const walletAddress = userWalletAddressForChat || localStorage.getItem('userWalletAddress') || account.address;
        if (isValidString(walletAddress)) {
          try {
            // console.log("[CREDIT PURCHASE] Updating user credits in database");
            const newDbCredits = await updateUserCreditsAPI(walletAddress, amount, 'add');
            if (newDbCredits !== null) {
              setUserCredits(newDbCredits); // Update with value from database
              // console.log("[CREDIT PURCHASE] Database credits updated to:", newDbCredits);
            }
            
            // Update vault balance - add 2 APT to the vault
            if (vaultId && isValidNumber(vaultId)) {
              try {
                // console.log("[CREDIT PURCHASE] Updating vault balance, adding 2 APT to vault:", vaultId);
                const currentVault = await fetchVaultById(Number(vaultId));
                
                if (currentVault) {
                  // Calculate new prize amounts - add 2 APT
                  const amountToAdd = 0.5; // 2 APT per purchase
                  const newTotalPrize = currentVault.total_prize + amountToAdd;
                  const newAvailablePrize = currentVault.available_prize + amountToAdd;
                  
                  // Update the vault with new prize amounts
                  const updatedVault = await updateVaultAPI(Number(vaultId), {
                    total_prize: newTotalPrize,
                    available_prize: newAvailablePrize
                  });
                  
                  if (updatedVault) {
                    // console.log("[CREDIT PURCHASE] Vault updated successfully, new total prize:", updatedVault.total_prize);
                    // Update the local vault data
                    setVaultData(updatedVault);
                  } else {
                    // console.error("[CREDIT PURCHASE] Failed to update vault balance");
                  }
                } else {
                  // console.error("[CREDIT PURCHASE] Could not fetch current vault data for update");
                }
              } catch (vaultError) {
                // console.error("[CREDIT PURCHASE] Error updating vault balance:", vaultError);
              }
            } else {
              // console.warn("[CREDIT PURCHASE] No valid vault ID for updating vault balance");
            }
          } catch (dbError) {
            // console.error("[CREDIT PURCHASE] Error updating credits in database:", dbError);
            // Transaction succeeded but DB update failed - we'll use the local credit update instead
          }
        } else {
          // console.error("[CREDIT PURCHASE] Invalid wallet address for updating credits:", walletAddress);
        }
        
        // Clear status after 5 seconds
        setTimeout(() => {
          setPurchaseStatus(null);
        }, 5000);
      }
    } catch (error) {
      // console.error("[CREDIT PURCHASE] Error purchasing credits:", error);
      setPurchaseStatus("Transaction failed. Please try again or contact support.");
    } finally {
      setIsBuying(false);
    }
  };

  // Effect to scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Replace the enhanced mobile experience useEffect with this simplified version
  // Enhanced mobile experience handling
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile) {
        // On larger screens, always show sidebar
        setSidebarVisible(true);
        document.body.style.overflow = 'auto';
      } else if (!document.hasMobileResizeRun) {
        // On smaller screens, hide sidebar by default (only on initial load)
        setSidebarVisible(false);
        document.hasMobileResizeRun = true;
      }
    };

    const handleOrientationChange = () => {
      // Force chat container to scroll to bottom after orientation change
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        
        // On orientation change, close the sidebar on mobile
        if (isMobile) {
          setSidebarVisible(false);
          document.body.style.overflow = 'auto';
        }
      }, 300);
    };
    
    // Set initial state
    handleResize();

    // Add event listener for orientation change only
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Clean up
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      // Reset overflow when component unmounts
      document.body.style.overflow = 'auto';
    };
  }, [isMobile]);

  // Add viewport meta tag for better mobile experience
  useEffect(() => {
    // Check if viewport meta tag exists
    let viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    
    // If it doesn't exist, create it
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta') as HTMLMetaElement;
      viewportMeta.name = 'viewport';
      document.getElementsByTagName('head')[0].appendChild(viewportMeta);
    }
    
    // Set the content attribute for better mobile experience
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    return () => {
      // Cleanup: restore original viewport meta or remove it
      if (viewportMeta) {
        viewportMeta.content = 'width=device-width, initial-scale=1.0';
      }
    };
  }, []);

  // Map the Vercel AI messages to the expected chat history format
  const chatHistory = messages.map((msg, index) => {
    let rejected = false;
    let accepted = false;

    // Only check for acceptance/rejection for assistant messages after the first two
    if (msg.role === 'assistant' && index > 1) {
      if (checkForTransactionHash(msg.content?.toString() || '')) {
        accepted = true;
      } else {
        rejected = true;
      }
    }
    // For the first two assistant messages, do not show accepted/rejected
    return {
      sender: msg.role === 'assistant' ? 'zora' : 'user',
      content: msg.content,
      rejected,
      accepted
    };
  });

  // Update chat configuration when account changes
  useEffect(() => {
    if (account?.address) {
      // console.log("Account address updated:", account.address);
      setUserWalletAddressForChat(account.address);
    }
  }, [account]);

  // Cleanup function to ensure body overflow is reset when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (routeValidationError) {
    return (
      <BorderFrame>
        <div className="flex-1 flex flex-col relative"> {/* Changed to flex-col and added relative */}
          <div className="flex items-center justify-center flex-1"> {/* Wrapped error message in another container */}
            <div className="bg-red-600 bg-opacity-25 border border-red-700 text-white px-6 py-4 rounded-lg text-center">
              <h2 className="text-2xl mb-2 font-bold">Access Error</h2>
              <p>{routeValidationError}</p>
              <p className="mt-2 text-sm">Redirecting...</p>
            </div>
          </div>
          
          {/* Footer with copyright text - absolute positioning for consistent placement */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-1 pt-1 bg-black bg-opacity-50">
            <div className="text-center">
              {/* Original footer for medium+ screens */}
              <div className="hidden sm:block text-gray-500 text-sm">
                / ALL RIGHT RESERVED Ⓒ 2025
              </div>
              
              {/* Compact footer for mobile only */}
              <div className="block sm:hidden text-gray-500 text-[10px] whitespace-nowrap">
                CLUSTER PROTOCOL ALL RIGHTS RESERVED 2025
              </div>
            </div>
          </div>
        </div>
      </BorderFrame>
    );
  }

  if (loading) {
    return (
      <BorderFrame>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-yellow-500 text-2xl">Loading chat...</div>
        </div>
            </BorderFrame>
    );
  }

  return (
    <BorderFrame vaultId={vaultId}>
      <Head>
        <style jsx global>{`
          @font-face {
            font-family: 'Clash Display';
            src: url('/dfusion/ClashDisplay-Variable.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `}</style>
      </Head>

      {/* Title directly under BorderFrame - improved responsive text sizing */}
      {isMobile && (
        <h1
          className={`text-yellow-500 text-2xl xs:text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-6 mb-5 text-center p-2`}
          style={{
            fontFamily: "vt323",
            textShadow: "0 0 10px rgba(255, 193, 7, 0.5)",
            letterSpacing: "0.04em",
            lineHeight: "1.2",
            paddingTop: "3px",
          }}
        >
          CONVINCE ZURA TO UNLOCK VAULT
        </h1>
      )}

      <div className={`relative z-10 w-full md:h-[900px] h-[500px] md:hidden ${isMobile ? 'mt-10 mb-6' : ''}`}>
        <Image
          src={vaultId === "113" ? "/dfusion/bluecard.png" : vaultId === "114" ? "/PAI/greencard.png" : "/panel.png"}
          alt="Panel Background"
          fill
          className="object-contain"
          style={{ filter: vaultId === "113" ? "none" : vaultId === "114" ? "none" : "drop-shadow(0 0 10px #1A56CB)" }}
        />

        <div className={`absolute top-0 left-0 w-full h-full flex flex-col items-center ${vaultId === "113" ? 'justify-start pt-3' : vaultId === "114" ? 'justify-start pt-3' : 'justify-start pt-4'} p-3`}>
          <div className={`${vaultId === "113" ? 'mb-2' : vaultId === "114" ? 'mb-2' : 'mb-3'}`}> {/* Adjusted mb for 113 and 114 */}
            <Image
              src={vaultId === "113" ? "/dfusion/mascoty.png" : vaultId === "114" ? "/PAI/greenhead.png" : getMascotImage()}
              alt="Zora Character"
              width={250}
              height={250}
              className={`h-auto w-auto ${vaultId === "113" ? 'max-w-[140px] max-h-[140px]' : vaultId === "114" ? 'max-w-[140px] max-h-[140px]' : 'max-w-[150px] max-h-[150px]'} object-contain`}
            />
          </div>
          <div className={`relative z-30 px-2 ${vaultId === "113" ? 'mt-0' : 'mt-0'} sm:px-16 md:px-18 flex flex-col`}>
            {/* ZORA VAULT title */}
            <div className={`text-center ${vaultId === "113" ? 'mb-1' : 'mb-2'}`}> {/* Adjusted mb for 113 */}
              <h2
                className={`${vaultId === "113" ? 'text-blue-500' : 'text-yellow-500'} ${vaultId === "113" ? 'text-2xl md:text-5xl' : 'text-3xl md:text-5xl'} font-bold tracking-wider`}
                style={{
                  fontFamily: "vt323",
                  textShadow: vaultId === "113" ? "0 0 10px rgba(0, 0, 255, 0.5)" : "0 0 10px rgba(255, 193, 7, 0.5)",
                }}
              >
                {vaultData?.name || "ZORA VAULT"}
              </h2>
            </div>

            {/* Prize amount */}
            <div className={`text-center ${vaultId === "113" ? 'mb-2' : vaultId === "114" ? 'mb-2' : 'mb-3'}`}> {/* Adjusted mb for 113 and 114 */}
              <div
                className={`${vaultId === "113" ? 'text-blue-500' : vaultId === "114" ? 'text-green-500' : 'text-yellow-500'} ${vaultId === "113" ? 'text-3xl md:text-6xl' : vaultId === "114" ? 'text-3xl md:text-6xl' : 'text-4xl md:text-6xl'} font-bold`}
                style={{
                  textShadow: vaultId === "113" ? "0 0 5px rgba(0, 0, 255, 0.5)" : vaultId === "114" ? "0 0 5px rgba(0, 255, 0, 0.5)" : "0 0 5px rgba(255, 193, 7, 0.5)",
                  fontFamily: vaultId === "114" ? "'Fira Code', monospace" : "vt323",
                  letterSpacing: "0.05em",
                }}
              >
                {vaultId === "113" 
                  ? `$${500 + parseFloat(convertAndFormatAptToUsd(vaultData?.total_prize || 0))}`
                  : vaultId === "114"
                  ? `$${700 + parseFloat(convertAndFormatAptToUsd(vaultData?.total_prize || 0))}`
                  : `$${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}`
                }
              </div>
              {/* Breakdown text */}
              {vaultId === "113" && (
                <div className="text-yellow-400 text-sm font-normal -mt-1 mb-1">
                  {isMobile ? `( $500+$${convertAndFormatAptToUsd(vaultData?.total_prize || 0)})` : `(${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}+$500 nodes)`}
                </div>
              )}
              {vaultId === "114" && (
                <div className="text-yellow-400 text-sm font-normal -mt-1 mb-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                  {isMobile ? `( $700+$${convertAndFormatAptToUsd(vaultData?.total_prize || 0)})` : `(${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}+$700 nodes)`}
                </div>
              )}
              <p className={`text-gray-400 ${vaultId === "113" ? 'text-[10px]' : 'text-xs md:text-base'}`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : undefined }}>
                in Prize Pool
              </p>
            </div>

            {/* Message price - MOBILE VIEW */}
            <div className={`flex justify-between items-center px-0.5 md:px-3 py-1 ${vaultId === "113" ? 'mb-1' : vaultId === "114" ? 'mb-1' : 'mb-2'} md:mb-3 border border-white/20 rounded-md bg-black bg-opacity-40 mx-2`}>
              <span className={`text-gray-400 ${vaultId === "113" ? 'text-[10px]' : vaultId === "114" ? 'text-[10px]' : 'text-xs'} md:text-base uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                MESSAGE PRICE
              </span>
              <span className={`text-white ${vaultId === "113" ? 'text-base' : vaultId === "114" ? 'text-base' : 'text-base'} md:text-xl font-medium mx-2`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                1 CREDIT
              </span>
            </div>

            {/* Total attempts - MOBILE VIEW */}
            <div className={`flex justify-between items-center px-0.5 md:px-2 ${vaultId === "113" ? 'py-0.5' : vaultId === "114" ? 'py-0.5' : 'py-2'} mb-2 border border-white/20 rounded-LG bg-black bg-opacity-10 mx-2`}>
              <span className={`text-gray-400 ${vaultId === "113" ? 'text-[10px]' : vaultId === "114" ? 'text-[10px]' : 'text-xs'} md:text-base uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                {" "}
                ATTEMPTS LEFT
              </span>
              <span className={`text-white ${vaultId === "113" ? 'text-base' : vaultId === "114" ? 'text-base' : 'text-base'} md:text-xl font-medium`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                {userCredits}
              </span>
            </div>

            {/* Buy Credits Button */}
            <div className={`${vaultId === "113" ? 'mt-1' : vaultId === "114" ? 'mt-1' : 'mt-3'} px-0.5 md:px-3`}>
              <div className={`flex justify-between items-center ${vaultId === "113" ? 'mb-1' : vaultId === "114" ? 'mb-1' : 'mb-2'} border border-white/20 rounded-md bg-black bg-opacity-40 px-0.5 py-1 mx-2`}>
                <span className={`text-gray-400 ${vaultId === "113" ? 'text-[10px]' : vaultId === "114" ? 'text-[10px]' : 'text-xs'} uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                  CREDIT PRICE
                </span>
                <span className={`text-white ${vaultId === "113" ? 'text-[10px]' : vaultId === "114" ? 'text-[10px]' : 'text-xs'} md:text-base`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                  0.1 APT per credit
                </span>
              </div>

              <button
                onClick={() => handleBuyCredits(5)}
                disabled={isBuying}
                className={`${vaultId === "113" ? 'w-full' : vaultId === "114" ? 'w-full' : 'w-full'} ${vaultId === "113" ? 'h-auto' : vaultId === "114" ? 'h-auto' : 'h-10'} py-0 rounded relative overflow-hidden ${
                  isBuying ? "bg-gray-700" : ""
                } text-black font-bold transition-all duration-200 flex items-center justify-center group`}
                style={{
                  boxShadow: isBuying
                    ? "none"
                    : vaultId === "113" 
                      ? "none" 
                      : vaultId === "114"
                      ? "none"
                      : "0 0 15px rgba(255, 193, 7, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.2)",
                  border: vaultId === "113" 
                    ? "none" 
                    : vaultId === "114"
                    ? "none"
                    : `1px solid rgba(255, 193, 7, 0.8)`,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                  backgroundColor: isBuying 
                    ? "#4a4a4a" 
                    : vaultId === "113" 
                      ? "transparent" 
                      : vaultId === "114"
                      ? "transparent"
                      : "transparent",
                  backgroundImage: isBuying
                    ? "none"
                    : vaultId === "113" 
                      ? "none"
                      : vaultId === "114"
                      ? "none"
                      : "linear-gradient(45deg, #FFBB33, #FF8800, #FFBB33)",
                  backgroundSize: "200% 200%",
                  animation: isBuying || vaultId === "113" || vaultId === "114"
                    ? "none"
                    : "gradientShift 3s ease infinite",
                }}
              >
                {isBuying ? (
                  <div className="flex items-center">
                    <span className="mr-2 text-sm md:text-base">
                      PROCESSING
                    </span>
                    <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <>
                    {/* Animated highlight overlay */}
                    {vaultId !== "113" && vaultId !== "114" && (
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    )}

                    {vaultId === "113" ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <Image
                          src="/dfusion/bluebutton.png"
                          alt="Buy Credits"
                          width={200} // Base for NextImage
                          height={50} // Base for NextImage
                          className="w-[160px] h-[70px] object-fill" // Adjusted for vault 113 mobile
                          style={{
                            borderRadius: "8px",
                            filter: vaultId === "113" ? "none" : "drop-shadow(0 0 2px rgba(26, 86, 203, 0.8))"
                          }}
                        />
                        <span
                          className={`tracking-wider text-[9px] absolute z-10 text-white font-bold text-center leading-tight`} // Adjusted for vault 113 mobile
                          style={{ fontFamily: vaultId === "113" ? `'Clash Display', monospace` : "vt323, monospace", textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)" }}
                        >
                          BUY 5 CREDITS<br />(0.5 APT)
                        </span>
                      </div>
                                          ) : vaultId === "114" ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <Image
                            src="/PAI/greenbtn.png"
                            alt="Buy Credits"
                            width={200} // Base for NextImage
                            height={50} // Base for NextImage
                            className="w-[160px] h-[70px] object-fill" // Adjusted for vault 114 mobile
                            style={{
                              borderRadius: "7px",
                              filter: "none",
                              border: "none",
                              outline: "none"
                            }}
                          />
                          <span
                            className={`tracking-wider text-[9px] absolute z-10 text-black font-bold text-center leading-tight`} // Changed to black text for vault 114 mobile
                            style={{ fontFamily: "'Fira Code', monospace", textShadow: "0 1px 2px rgba(255, 255, 255, 0.3)" }}
                          >
                            BUY 5 CREDITS<br />(0.5 APT)
                          </span>
                        </div>
                    ) : (
                      <div className="flex items-center justify-center relative z-10">
                        <span
                          className="tracking-wider text-sm"
                          style={{ fontFamily: "vt323, monospace" }}
                        >
                          BUY 5 CREDITS (0.5 APT)
                        </span>
                      </div>
                    )}
                  </>
                )}
              </button>

              {purchaseStatus && (
                <div
                  className="mt-2 text-xs md:text-sm text-center"
                  style={{
                    color: purchaseStatus.includes("failed")
                      ? "#ff6b6b"
                      : "#ffc107",
                  }}
                >
                  {purchaseStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Container for panels - enhanced flex behavior for better responsiveness */}
      <div className={`${isMobile ? 'h-[calc(100vh-60px)]' : 'h-[calc(100vh-20px)]'} flex relative overflow-hidden flex-col md:flex-row rounded-lg w-full mx-auto sm:h-full min-h-[700px]`}>
        {/* Left panel - Vault info with improved mobile layout */}

        <div
          className={`${ sidebarVisible ? "fixed md:relative inset-0 z-50" : "hidden" } md:flex md:h-full flex-col md:z-30 w-full md:w-[300px] lg:w-[350px] md:flex-shrink-0`}
        >
          {/* Dark overlay behind sidebar on mobile only */}
          {sidebarVisible && (
            <div
              className="fixed inset-0 bg-black bg-opacity-60 z-10 md:hidden"
              onClick={toggleSidebar}
            ></div>
          )}

          {/* Actual sidebar content container - positioned above overlay */}
          <div className="relative bg-black md:bg-transparent h-full overflow-visible z-20 md:m-0 rounded-lg md:rounded-none">
            {/* Close button for sidebar on mobile */}
            <button
              onClick={toggleSidebar}
              className="absolute top-2 right-2 z-50 md:hidden bg-yellow-600 text-white p-1 rounded-full"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Vector border image - only on desktop with responsive positioning */}
            <div
              className="absolute -top-8 -right-20 min-h-full left-0 sm:left-8 w-full sm:w-[380px] h-full hidden md:block"
              style={{
                backgroundImage: vaultId === "113" ? "url('/dfusion/bluecard1.png')" : vaultId === "114" ? "url('/PAI/greencard1.png')" : "url('/Vector 4.png')",
                backgroundSize: "90% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                overflow: "visible",
                marginBottom: "210px",
                zIndex: 30,
                filter: vaultId === "113" ? "none" : vaultId === "114" ? "none" : "drop-shadow(0 0 15px #1A56CB)"
              }}
            >
              <div className="relative z-30 px-6 sm:px-16 mt-10 md:px-18 py-4 md:py-8 flex flex-col">
                {/* ZORA VAULT title */}
                <div className="text-center mb-2">
                  <h2
                    className={`${vaultId === "113" ? 'text-blue-500' : vaultId === "114" ? 'text-green-500' : 'text-yellow-500'} ${vaultId === "113" ? 'text-4xl md:text-5xl' : vaultId === "114" ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'} font-bold tracking-wider`}
                    style={{
                      fontFamily: vaultId === "114" ? "'Fira Code', monospace" : "vt323",
                      textShadow: vaultId === "113" ? "0 0 10px rgba(0, 0, 255, 0.5)" : vaultId === "114" ? "0 0 10px rgba(0, 255, 0, 0.5)" : "0 0 10px rgba(255, 193, 7, 0.5)",
                    }}
                  >
                    {vaultData?.name || "ZORA VAULT"}
                  </h2>
                </div>

                {/* Prize amount */}
                <div className="text-center mb-6 md:mb-6">
                  <div
                    className={`${vaultId === "113" ? 'text-blue-500' : vaultId === "114" ? 'text-green-500' : 'text-yellow-500'} ${vaultId === "113" ? 'text-5xl md:text-6xl' : vaultId === "114" ? 'text-5xl md:text-6xl' : 'text-6xl md:text-7xl'} font-bold`}
                    style={{
                      textShadow: vaultId === "113" ? "0 0 5px rgba(0, 0, 255, 0.5)" : vaultId === "114" ? "0 0 5px rgba(0, 255, 0, 0.5)" : "0 0 5px rgba(255, 193, 7, 0.5)",
                      fontFamily: vaultId === "114" ? "'Fira Code', monospace" : "vt323",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {vaultId === "113" 
                      ? `$${500 + parseFloat(convertAndFormatAptToUsd(vaultData?.total_prize || 0))}`
                      : vaultId === "114"
                      ? `$${700 + parseFloat(convertAndFormatAptToUsd(vaultData?.total_prize || 0))}`
                      : `$${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}`
                    }
                  </div>
                  {/* Breakdown text */}
                  {vaultId === "113" && (
                    <div className="text-yellow-400 text-lg font-normal -mt-1 mb-2">
                      (${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}+$500 nodes)
                    </div>
                  )}
                  {vaultId === "114" && (
                    <div className="text-yellow-400 text-lg font-normal -mt-1 mb-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                      (${convertAndFormatAptToUsd(vaultData?.total_prize || 0)}+$700 nodes)
                    </div>
                  )}
                  <p className="text-gray-400 text-sm md:text-base">
                    in Prize Pool
                  </p>
                </div>

                {/* Message price - DESKTOP VIEW */}
                <div className="flex justify-between items-center px-1 md:px-3 py-2 mb-2 md:mb-3 border border-white/20 rounded-md bg-black bg-opacity-40 mx-3">
                  <span className={`text-gray-400 ${vaultId !== "113" && vaultId !== "114" ? 'text-sm' : 'text-sm'} md:text-base uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                    MESSAGE PRICE
                  </span>
                  <span className={`text-white ${vaultId !== "113" && vaultId !== "114" ? 'text-lg' : 'text-lg'} md:text-xl font-medium mx-2`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                    1 CREDIT
                  </span>
                </div>

                {/* Total attempts - DESKTOP VIEW */}
                <div className="flex justify-between items-center px-1 md:px-3 py-2 mb-2 md:mb-3 border border-white/20 rounded-md bg-black bg-opacity-40 mx-3">
                  <span className={`text-gray-400 ${vaultId !== "113" && vaultId !== "114" ? 'text-sm' : 'text-sm'} md:text-base uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                    {" "}
                    ATTEMPTS LEFT
                  </span>
                  <span className={`text-white ${vaultId !== "113" && vaultId !== "114" ? 'text-lg' : 'text-lg'} md:text-xl font-medium`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                    {userCredits}
                  </span>
                </div>

                {/* Buy Credits Button */}
                <div className="mt-3 px-1 md:px-3">
                  <div className="flex justify-between items-center mb-2 border border-white/20 rounded-md bg-black bg-opacity-40 px-1 py-0 mx-3">
                    <span className={`text-gray-400 ${vaultId !== "113" && vaultId !== "114" ? 'text-sm' : 'text-sm'} uppercase tracking-widest`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                      CREDIT PRICE
                    </span>
                    <span className={`text-white ${vaultId !== "113" && vaultId !== "114" ? 'text-sm' : 'text-sm'} md:text-base`} style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined }}>
                      0.1 APT per credit
                    </span>
                  </div>

                  <button
                    onClick={() => handleBuyCredits(5)}
                    disabled={isBuying}
                    className={`w-full py-2 md:py-3 rounded relative overflow-hidden ${
                      isBuying ? "bg-gray-700" : ""
                    } text-black font-bold transition-all duration-200 flex items-center justify-center group`}
                    style={{
                      boxShadow: isBuying
                        ? "none"
                        : vaultId === "113" 
                          ? "none" 
                          : vaultId === "114"
                          ? "none"
                          : "0 0 15px rgba(255, 193, 7, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.2)",
                      border: vaultId === "113" 
                        ? "none" 
                        : vaultId === "114"
                        ? "none"
                        : `1px solid rgba(255, 193, 7, 0.8)`,
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      backgroundColor: isBuying 
                        ? "#4a4a4a" 
                        : vaultId === "113" 
                          ? "transparent" 
                          : vaultId === "114"
                          ? "transparent"
                          : "transparent",
                      backgroundImage: isBuying
                        ? "none"
                        : vaultId === "113" 
                          ? "none"
                          : vaultId === "114"
                          ? "none"
                          : "linear-gradient(45deg, #FFBB33, #FF8800, #FFBB33)",
                      backgroundSize: "200% 200%",
                      animation: isBuying || vaultId === "113" || vaultId === "114"
                        ? "none"
                        : "gradientShift 3s ease infinite",
                    }}
                  >
                    {isBuying ? (
                      <div className="flex items-center">
                        <span className="mr-2 text-sm md:text-base">
                          PROCESSING
                        </span>
                        <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <>
                        {/* Animated highlight overlay */}
                        {vaultId !== "113" && vaultId !== "114" && (
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                        )}

                        {vaultId === "113" ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <Image
                              src="/dfusion/bluebutton.png"
                              alt="Buy Credits"
                              width={200} // Base for NextImage
                              height={50} // Base for NextImage
                              className="w-[300px] sm:w-full h-[90px] md:h-[120px] sm:h-full object-fill" // User had w-[300px], I changed md:h-[100px] to md:h-[120px]
                              style={{
                                borderRadius: "8px",
                                filter: vaultId === "113" ? "none" : "drop-shadow(0 0 2px rgba(26, 86, 203, 0.8))"
                              }}
                            />
                            <span
                              className={`tracking-wider text-xs md:text-base absolute z-10 text-white font-bold text-center leading-tight`} // Changed md:text-sm to md:text-base
                              style={{ fontFamily: vaultId === "113" ? `'Clash Display', monospace` : "vt323, monospace", textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)" }}
                            >
                              BUY 5 CREDITS<br />(0.5 APT)
                            </span>
                          </div>
                        ) : vaultId === "114" ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <Image
                              src="/PAI/greenbtn.png"
                              alt="Buy Credits"
                              width={200} // Base for NextImage
                              height={50} // Base for NextImage
                              className="w-[300px] sm:w-full h-[90px] md:h-[120px] sm:h-full object-fill"
                              style={{
                                borderRadius: "8px",
                                filter: "none",
                                border: "none",
                                outline: "none"
                              }}
                            />
                            <span
                              className={`tracking-wider text-xs md:text-base absolute z-10 text-black font-bold text-center leading-tight`}
                              style={{ fontFamily: "'Fira Code', monospace", textShadow: "0 1px 2px rgba(255, 255, 255, 0.3)" }}
                            >
                              BUY 5 CREDITS<br />(0.5 APT)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center relative z-10">
                            <span
                              className="tracking-wider text-sm md:text-lg"
                              style={{ fontFamily: "vt323, monospace" }}
                            >
                              BUY 5 CREDITS (0.5 APT)
                            </span>
                          </div>
                        )}

                        {/* Corner accents for non-113 vaults */}
                        {vaultId !== "113" && (
                          <>
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-black opacity-50"></div>
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-black opacity-50"></div>
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-black opacity-50"></div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-black opacity-50"></div>
                          </>
                        )}
                      </>
                    )}
                  </button>

                  {purchaseStatus && (
                    <div
                      className="mt-2 text-xs md:text-sm text-center"
                      style={{
                        color: purchaseStatus.includes("failed")
                          ? "#ff6b6b"
                          : "#ffc107",
                      }}
                    >
                      {purchaseStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Chat interface with improved responsive layout */}
        <div
          className={`${isMobile ? (vaultId === "114" ? 'border-2 border-green-600 rounded-lg mx-2 mb-2' : 'border-2 border-blue-600 rounded-lg mx-2 mb-2') : ''} flex-1 ${isMobile ? 'mr-4' : ''} relative z-1 overflow-hidden flex flex-col rounded-lg h-full`}
          style={{
            minHeight: isMobile ? "300px" : "680px", // Reduced to avoid overflow
            width: "100%",
            maxWidth: isMobile ? "calc(101% - 20px)" : "min(1270px, calc(100% - 20px))",
            marginLeft: isMobile ? "" : "-30px", // Negative margin to position under sidebar
            height: "100%",  // Reduced to prevent overflow
            maxHeight: "calc(120% - 20px)" // Ensure it stays within parent
          }}
        >
          {/* Improved sidebar toggle button - better positioned for all screen sizes */}
        

          {/* Background overlay with circuit patterns */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: vaultId === "113" ? "url('/dfusion/chatbj.png')" : vaultId === "114" ? "url('/PAI/chatbgj.png')" : "url('/chatbg.png')",
                backgroundSize: isMobile ? '120% 120%' : '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                height: '90%'
              }}
            ></div>
          </div>

          {/* Chat messages container - with improved spacing for all screens */}
          <div
            ref={chatContainerRef}
            className={`absolute inset-0 ${isMobile ? 'z-20' : 'z-10'} ${isMobile ? 'pt-16 pb-52' : 'pt-6 pb-24'} sm:pt-10 md:pt-4 px-2 sm:px-4 md:px-6 overflow-y-auto scrollbar-hide`}
            style={{
              backdropFilter: "blur(1px)",
              background: "rgba(0,0,0,0.1)",
              borderRadius: "8px",
              height: isMobile ? "calc(100% - 80px)" : "88%", // Ensure proper mobile height
              maxHeight: isMobile ? "calc(100% - 120px)" : "calc(100% - 60px)" // Prevent overlap with input
            }}
          >
            {/* Mascot Image - properly sized for all screens */}
            <div className="flex justify-center mb-4 md:mb-8">
              <div className="relative flex items-center justify-center">
                <Image
                  src={vaultId === "113" ? "/dfusion/mascoty.png" : vaultId === "114" ? "/PAI/fullgreen.png" : getMascotImage()}
                  alt="Zora Mascot"
                  width={300}
                  height={300}
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-[250px] md:h-[250px] lg:w-[300px] lg:h-[300px] object-contain"
                  style={{ animation: "float 3s ease-in-out infinite" }}
                />
                <style jsx global>{`
                  @keyframes float {
                    0% {
                      transform: translateY(0px);
                    }
                    50% {
                      transform: translateY(-10px);
                    }
                    100% {
                      transform: translateY(0px);
                    }
                  }
                  @keyframes gradientShift {
                    0% {
                      background-position: 0% 50%;
                    }
                    50% {
                      background-position: 100% 50%;
                    }
                    100% {
                      background-position: 0% 50%;
                    }
                  }
                `}</style>
              </div>
            </div>

            {/* Chat messages with improved spacing and sizing for all screens */}
            {chatHistory.map((chat, index) => (
              <div
                key={index}
                className={`flex ml-0 sm:ml-3 ${
                  chat.sender === "zora" ? "justify-start" : "justify-end"
                } relative mb-6 sm:mb-10 md:mb-8 max-w-[98%]`}
              >
                {chat.sender === "zora" && (
                  <div className="flex items-start max-w-[95%] sm:max-w-[90%] md:max-w-[80%]">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full overflow-hidden mr-1 sm:mr-2 md:mr-3 mt-1 flex-shrink-0 bg-yellow-600 p-0.5">
                      <Image
                        src={vaultId === "114" ? "/PAI/greenhead.png" : getMascotImage()} // Use greenhead.png for vault 114 AI chat avatar
                        alt="Zora"
                        width={40}
                        height={40}
                      />
                    </div>
                    <div
                      className="text-white text-sm sm:text-base md:text-2xl p-2 sm:p-3 md:p-4 rounded-lg"
                      style={{
                        backgroundImage: "url('/msgbg.png')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 193, 7, 0.3)",
                        fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined
                      }}
                    >
                      {/* Render HTML for initial greeting, plain text for others */}
                      {index === 0 && chat.sender === "zora" && chat.content.includes('<span') ? (
                        <span dangerouslySetInnerHTML={{ __html: chat.content }} />
                      ) : (
                        chat.content
                      )}

                      {/* Add ATTEMPT REJECTED below zora message with responsive positioning */}
                      {chat.rejected && (
                        <div className="absolute -bottom-4 sm:-bottom-6 md:-bottom-8 left-6 sm:left-8 md:left-12">
                          <span
                            className="text-white px-2 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-sm font-bold uppercase text-center tracking-wider"
                            style={{
                              backgroundImage: "url('/attemptrejectedbg.png')",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              boxShadow: "0 0 8px rgba(255, 0, 0, 0.5)",
                              letterSpacing: "1px",
                              fontSize: "8px",
                              lineHeight: "1.2",
                            }}
                          >
                            <span className="hidden xs:inline">
                              ATTEMPT REJECTED
                            </span>
                            <span className="inline xs:hidden">REJECTED</span>
                          </span>
                        </div>
                      )}

                      {/* Add ATTEMPT ACCEPTED below zora message with responsive positioning */}
                      {chat.accepted && (
                        <div className="absolute -bottom-4 sm:-bottom-6 md:-bottom-8 left-6 sm:left-8 md:left-12">
                          <span
                            className="text-white px-2 sm:px-4 md:px-5 py-1 sm:py-1.5 rounded-sm font-bold uppercase text-center tracking-wider"
                            style={{
                              backgroundImage: "url('/attemptsucessbg.png')",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              boxShadow: "0 0 8px rgba(0, 255, 0, 0.5)",
                              letterSpacing: "1px",
                              fontSize: "8px",
                              lineHeight: "1.2",
                            }}
                          >
                            <span className="hidden xs:inline">
                              ATTEMPT ACCEPTED
                            </span>
                            <span className="inline xs:hidden">ACCEPTED</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {chat.sender === "user" && (
                  <div className="flex items-start justify-end max-w-[95%] sm:max-w-[90%] md:max-w-[80%]">
                    <div
                      className="text-white text-sm sm:text-base md:text-xl lg:text-2xl p-2 sm:p-3 md:p-4 rounded-lg mr-1 sm:mr-2 md:mr-3"
                      style={{
                        backgroundImage: "url('/msgbg.png')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(100, 149, 237, 0.3)",
                        filter: "hue-rotate(240deg)", // Blue tint for user messages
                        fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : vaultId === "114" ? "'Fira Code', monospace" : undefined
                      }}
                    >
                      {chat.content}
                    </div>
                    <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full overflow-hidden mt-1 flex-shrink-0 p-0.5"></div>
                  </div>
                )}
              </div>
            ))}

            {/* Add AI typing indicator animation when waiting for response */}
            {aiLoading && (
              <div className="flex justify-start relative mb-3 sm:mb-5 md:mb-8">
                <div className="flex items-start max-w-[95%] sm:max-w-[90%] md:max-w-[80%]">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full overflow-hidden mr-1 sm:mr-2 md:mr-3 mt-1 flex-shrink-0 bg-yellow-600 p-0.5">
                    <Image
                      src={getMascotImage()} // Ensure this uses the function directly for mascoty2.png via user's change
                      alt="Zora"
                      width={40}
                      height={40}
                    />
                  </div>
                  <div
                    className="text-white text-sm sm:text-base md:text-lg p-2 sm:p-3 md:p-4 rounded-lg"
                    style={{
                      backgroundImage: "url('/msgbg.png')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 193, 7, 0.3)",
                      fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : undefined
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat input - improved for all screen sizes */}
          <div className="absolute bottom-3 sm:bottom-20 left-3 right-3 z-30 px-2 sm:px-3 md:px-4">
            {vaultData?.available_prize === 0 ? (
              <div className="bg-red-600 bg-opacity-25 border border-red-700 text-white px-4 py-3 rounded-lg text-center">
                <p className="font-bold text-lg" style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : undefined }}>VAULT EMPTIED</p>
                <p className="text-sm" style={{ fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : undefined }}>
                  This vault has been emptied and is no longer accepting
                  messages.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className={`${isMobile ? ' bg-black flex flex-col space-y-2' : 'bg-black flex items-center'}`}
                style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
              >
                <div
                  className={`${isMobile ? 'w-full' : 'flex-1 mb-0'} relative`}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="CONVINCE ZURA HERE ..."
                    disabled={aiLoading || userCredits <= 0}
                    className={`w-full bg-opacity-90 text-white border-none outline-none px-2 xs:px-3 ${
                      isMobile ? 'py-3 text-base rounded-none' : 'md:px-4 py-3 sm:py-3 text-sm xs:text-base md:text-lg rounded-l-md'
                    } ${(aiLoading || userCredits <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                      backgroundColor: isMobile ? "#333333" : "#2D2D2D",
                      caretColor: "#ffc107",
                      fontFamily: vaultId === "113" ? `'Clash Display', sans-serif` : "monospace",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={aiLoading || input.trim() === '' || userCredits <= 0}
                  className={`hover:opacity-90 transition flex items-center justify-center uppercase tracking-wide ${
                    isMobile
                      ? 'w-full text-black py-0 font-bold'
                      : 'text-black rounded-r-md h-full'
                  } ${(aiLoading || input.trim() === '' || userCredits <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={isMobile ? {
                    position: "relative",
                    overflow: "hidden"
                  } : {
                    position: "relative",
                  }}
                >
                  <Image 
                    src="/button.png" 
                    alt="Send Message"
                    width={isMobile ? 200 : 150}
                    height={isMobile ? 50 : 40}
                    className={`${(aiLoading || input.trim() === '' || userCredits <= 0) ? 'opacity-50' : ''}`}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-black font-bold">
                    {isMobile ? (
                      <span></span>
                    ) : (
                      <div className="flex items-center">
                        <span className="hidden sm:inline"></span>
                        <span className="inline sm:hidden"></span>

                      </div>
                    )}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </BorderFrame>
  );
}
