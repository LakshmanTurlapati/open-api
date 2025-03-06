// Background script at the very beginning - log startup
console.log("OpenAPI background script started");

// Variables
let apiKey = null;
let chatGPTTabId = null;
let serverUrl = "http://localhost:3000"; // Change this to your server URL when deployed
let pollInterval = null;
let isRegistered = false;
let lastError = null;
let tabActivationInterval = null;
let isTabActivationEnabled = false;

// Constants
const CHAT_GPT_URLS = [
  "https://chat.openai.com",
  "https://chat.openai.com/",
  "https://chat.openai.com/c/",
  "https://chatgpt.com",
  "https://chatgpt.com/"
];

// Helper function to check if a URL is a ChatGPT URL
function isChatGPTUrl(url) {
  if (!url) return false;
  return CHAT_GPT_URLS.some(chatUrl => url.startsWith(chatUrl));
}

// Generate a random API key if not already set
function generateApiKey() {
  if (!apiKey) {
    apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    chrome.storage.local.set({ apiKey });
  }
  return apiKey;
}

// Helper: Log to console with timestamp
function logWithTime(message) {
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${time}] ${message}`);
}

// Load stored API key and server URL on startup
chrome.storage.local.get([
  'apiKey', 
  'chatGPTTabId', 
  'serverUrl',
  'isRegistered',
  'lastError'
], (result) => {
  console.log("Loading stored data:", result);
  
  if (result.apiKey) {
    apiKey = result.apiKey;
    console.log("Loaded API key from storage");
  } else {
    generateApiKey();
    console.log("Generated new API key");
  }
  
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    console.log("Loaded server URL from storage:", serverUrl);
  }
  
  if (result.isRegistered !== undefined) {
    isRegistered = result.isRegistered;
    console.log("Loaded registration status from storage:", isRegistered);
  }
  
  if (result.lastError) {
    lastError = result.lastError;
    console.log("Loaded last error from storage:", lastError);
  }
  
  if (result.chatGPTTabId) {
    chatGPTTabId = result.chatGPTTabId;
    console.log("Loaded ChatGPT tab ID from storage:", chatGPTTabId);
    
    // Verify the tab still exists
    verifyChatGPTTab(chatGPTTabId).catch(error => {
      console.error("Error verifying ChatGPT tab:", error);
      chatGPTTabId = null;
      chrome.storage.local.remove('chatGPTTabId');
    });
  }
  
  // Find any open ChatGPT tab and store it
  findExistingChatGPTTab();
  
  // Register with the server
  registerWithServer();
});

// Find existing ChatGPT tab if any
async function findExistingChatGPTTab() {
  try {
    const tabs = await chrome.tabs.query({});
    logWithTime(`Found ${tabs.length} tabs, checking for ChatGPT...`);
    
    for (const tab of tabs) {
      if (isChatGPTUrl(tab.url)) {
        logWithTime(`Found existing ChatGPT tab: ${tab.id}, URL: ${tab.url}`);
        chatGPTTabId = tab.id;
        chrome.storage.local.set({ chatGPTTabId });
        
        // Inject the content script if needed
        try {
          await injectContentScriptIfNeeded(tab.id);
          logWithTime(`Content script verification for tab ${tab.id} completed`);
        } catch (e) {
          logWithTime(`Error ensuring content script in existing tab: ${e.message}`);
        }
        
        return tab.id;
      }
    }
    logWithTime('No existing ChatGPT tabs found');
    return null;
  } catch (error) {
    console.error('Error finding existing ChatGPT tabs:', error);
    return null;
  }
}

// Inject content script if it's not already there
async function injectContentScriptIfNeeded(tabId) {
  try {
    // Try to ping the content script first to see if it's already loaded
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          // Content script is not loaded, we need to inject it
          logWithTime(`Content script not detected in tab ${tabId}, injecting...`);
          reject(new Error('Content script not loaded'));
        } else if (response && response.status === 'pong') {
          logWithTime(`Content script already active in tab ${tabId}`);
          resolve();
        } else {
          reject(new Error('Invalid response from content script'));
        }
      });
    }).catch(async () => {
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      logWithTime(`Content script injected into tab ${tabId}`);
      
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the script was loaded
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
          if (chrome.runtime.lastError || !response || response.status !== 'pong') {
            logWithTime(`Content script injection verification failed for tab ${tabId}`);
            reject(new Error('Content script injection failed'));
          } else {
            logWithTime(`Content script injection verified for tab ${tabId}`);
            resolve();
          }
        });
      });
    });
  } catch (error) {
    console.error(`Error injecting content script into tab ${tabId}:`, error);
    throw error;
  }
}

// Verify a tab is a valid ChatGPT tab
async function verifyChatGPTTab(tabId) {
  console.log(`Verifying tab ${tabId} is a ChatGPT tab`);
  
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error("Tab not found");
    }
    
    if (!isChatGPTUrl(tab.url)) {
      throw new Error(`Not a ChatGPT URL: ${tab.url}`);
    }
    
    // Ping the content script to make sure it's loaded
    try {
      await injectContentScriptIfNeeded(tabId);
      return true;
    } catch (error) {
      throw new Error(`Content script verification failed: ${error.message}`);
    }
  } catch (error) {
    console.error(`Tab ${tabId} is not a valid ChatGPT tab:`, error);
    throw error;
  }
}

// Function to register the extension with the server
async function registerWithServer() {
  if (!apiKey) {
    generateApiKey();
  }
  
  try {
    console.log(`Registering with server at ${serverUrl}`);
    const response = await fetch(`${serverUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extensionId: chrome.runtime.id,
        apiKey: apiKey
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Successfully registered with server');
      isRegistered = true;
      saveRegistrationStatus();
      lastError = null;
      
      // Start polling for requests
      startPolling();
    } else {
      console.error('Failed to register with server:', data.error);
      lastError = `Server registration failed: ${data.error || 'Unknown error'}`;
      isRegistered = false;
      saveRegistrationStatus();
      // Retry after 30 seconds
      setTimeout(registerWithServer, 30000);
    }
  } catch (error) {
    console.error('Error registering with server:', error);
    lastError = `Server connection error: ${error.message || 'Unknown error'}`;
    isRegistered = false;
    saveRegistrationStatus();
    // Retry after 30 seconds
    setTimeout(registerWithServer, 30000);
  }
}

// Function to start polling the server for requests
function startPolling() {
  // Don't start automatic polling - only poll when manually requested
  console.log('Automatic polling disabled. Using manual polling only.');
}

// Function to manually poll once
async function pollOnce() {
  try {
    const response = await fetch(`${serverUrl}/poll/${apiKey}`);
    const data = await response.json();
    
    // If we have a request to process
    if (data.requestId) {
      console.log('Received request:', data);
      handleServerRequest(data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error polling server:', error);
    lastError = `Polling error: ${error.message || 'Unknown error'}`;
    // If we can't reach the server, try to re-register
    isRegistered = false;
    saveRegistrationStatus();
    registerWithServer();
    return false;
  }
}

// Function to handle requests from the server
async function handleServerRequest(request) {
  if (request.action === 'query') {
    try {
      // Make sure ChatGPT tab is open and valid
      await ensureChatGPTTabIsOpen();
      
      console.log(`Sending message to ChatGPT in tab ${chatGPTTabId}`);
      
      // Send the request to the content script with a longer timeout
      const sendMessagePromise = new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          chatGPTTabId,
          {
            action: 'sendMessage',
            message: request.message,
            newConversation: request.newConversation || false
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error from sendMessage:", chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            if (response && response.error) {
              reject(new Error(response.error));
            } else if (response) {
              resolve(response);
            } else {
              reject(new Error('No response received from content script'));
            }
          }
        );
      });
      
      // Set a timeout to ensure we don't wait forever
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout waiting for content script response')), 30000);
      });
      
      // Wait for either the message response or the timeout
      const response = await Promise.race([sendMessagePromise, timeoutPromise]);
      await sendResponseToServer(request.requestId, response.response);
      
    } catch (error) {
      console.error("Error handling server request:", error);
      lastError = `Request handling error: ${error.message || 'Unknown error'}`;
      await sendResponseToServer(request.requestId, null, error.message || 'Unknown error');
    }
  }
}

// Ensure a ChatGPT tab is open and working
async function ensureChatGPTTabIsOpen() {
  console.log("Ensuring ChatGPT tab is open...");
  
  if (!chatGPTTabId) {
    console.log("No ChatGPT tab found. Opening a new one...");
    await openChatGPTTab();
    // Wait for tab to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    return;
  }
  
  // Verify the tab is still valid
  try {
    await verifyChatGPTTab(chatGPTTabId);
    console.log(`ChatGPT tab ${chatGPTTabId} is valid`);
  } catch (error) {
    console.log("Existing tab is invalid. Opening a new ChatGPT tab...", error);
    await openChatGPTTab();
    // Wait for tab to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Function to send a response back to the server
async function sendResponseToServer(requestId, response, error = null) {
  try {
    await fetch(`${serverUrl}/response/${apiKey}/${requestId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response,
        error
      }),
    });
    console.log('Sent response to server for request:', requestId);
  } catch (error) {
    console.error('Error sending response to server:', error);
    lastError = `Error sending response: ${error.message || 'Unknown error'}`;
  }
}

// Handle request from the popup to open ChatGPT
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message from popup:", request);
  
  if (request.action === 'openChatGPT') {
    openChatGPTTab().then((tabId) => {
      sendResponse({ success: true, tabId });
    }).catch(error => {
      console.error("Error opening ChatGPT tab:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'getApiKey') {
    sendResponse({ apiKey: apiKey || generateApiKey() });
  } else if (request.action === 'regenerateApiKey') {
    apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    chrome.storage.local.set({ apiKey });
    
    // Re-register with the server
    registerWithServer();
    
    sendResponse({ apiKey });
  } else if (request.action === 'getServerStatus') {
    sendResponse({
      serverUrl,
      isRegistered,
      lastError
    });
  } else if (request.action === 'setServerUrl') {
    serverUrl = request.serverUrl;
    chrome.storage.local.set({ serverUrl });
    
    // Re-register with the new server
    registerWithServer();
    
    sendResponse({ success: true });
  } else if (request.action === 'getChatGPTStatus') {
    let status = {
      chatGPTTabOpen: false,
      tabId: chatGPTTabId,
      debugInfo: {}
    };
    
    if (chatGPTTabId) {
      chrome.tabs.get(chatGPTTabId, (tab) => {
        if (chrome.runtime.lastError) {
          status.error = `Error: ${chrome.runtime.lastError.message}`;
          status.debugInfo.errorType = 'Tab access error';
          sendResponse(status);
          return;
        }
        
        if (!tab) {
          status.error = "Tab no longer exists";
          status.debugInfo.errorType = 'Tab not found';
          sendResponse(status);
          return;
        }
        
        status.debugInfo.tabUrl = tab.url;
        status.debugInfo.tabStatus = tab.status;
        
        if (!isChatGPTUrl(tab.url)) {
          status.error = `Tab exists but URL is not ChatGPT: ${tab.url}`;
          status.debugInfo.errorType = 'Not ChatGPT URL';
          sendResponse(status);
          return;
        }
        
        // Try to ping the tab to see if content script is active
        chrome.tabs.sendMessage(chatGPTTabId, { action: 'ping' }, pingResponse => {
          if (chrome.runtime.lastError) {
            status.error = `Content script not responding: ${chrome.runtime.lastError.message}`;
            status.debugInfo.errorType = 'Content script not responding';
            status.debugInfo.scriptError = chrome.runtime.lastError.message;
            
            // Try to inject the content script
            chrome.scripting.executeScript({
              target: { tabId: chatGPTTabId },
              files: ['content.js']
            }).then(() => {
              status.debugInfo.scriptInjectionAttempted = true;
            }).catch(err => {
              status.debugInfo.scriptInjectionError = err.message;
            }).finally(() => {
              sendResponse(status);
            });
            return true; // Keep channel open
          }
          
          status.chatGPTTabOpen = true;
          status.pingResponse = pingResponse;
          sendResponse(status);
        });
        return true; // Keep channel open for async response
      });
      return true; // Keep channel open for async response
    } else {
      // Check if there are any ChatGPT tabs open that we missed
      chrome.tabs.query({}, (tabs) => {
        status.debugInfo.totalTabs = tabs.length;
        const chatGptTabs = tabs.filter(tab => isChatGPTUrl(tab.url));
        status.debugInfo.chatGptTabsFound = chatGptTabs.length;
        
        if (chatGptTabs.length > 0) {
          const tab = chatGptTabs[0];
          status.debugInfo.foundChatGptTab = true;
          status.debugInfo.foundTabUrl = tab.url;
          status.debugInfo.foundTabId = tab.id;
          
          // Store this tab for future use
          chatGPTTabId = tab.id;
          chrome.storage.local.set({ chatGPTTabId });
          
          // Try to ping the content script
          chrome.tabs.sendMessage(tab.id, { action: 'ping' }, pingResponse => {
            if (chrome.runtime.lastError) {
              status.debugInfo.contentScriptMissing = true;
              // Inject the content script
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              }).then(() => {
                status.debugInfo.scriptInjected = true;
                sendResponse(status);
              }).catch(err => {
                status.debugInfo.scriptInjectionError = err.message;
                sendResponse(status);
              });
              return true; // Keep channel open
            }
            
            status.chatGPTTabOpen = true;
            status.tabId = tab.id;
            status.pingResponse = pingResponse;
            sendResponse(status);
          });
          return true; // Keep channel open for async response
        } else {
          sendResponse(status);
        }
      });
      return true; // Keep channel open for async response
    }
  } else if (request.action === 'getLastError') {
    sendResponse({ lastError });
  } else if (request.action === 'resetChatGPTTab') {
    chatGPTTabId = null;
    chrome.storage.local.remove('chatGPTTabId');
    
    // Look for any open ChatGPT tabs
    findExistingChatGPTTab().then(tabId => {
      sendResponse({ 
        success: true, 
        tabId,
        foundExistingTab: tabId !== null
      });
    }).catch(error => {
      sendResponse({ 
        success: true, 
        error: error.message
      });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'forceInjectContentScript') {
    if (chatGPTTabId) {
      chrome.scripting.executeScript({
        target: { tabId: chatGPTTabId },
        files: ['content.js']
      }).then(() => {
        sendResponse({ success: true, tabId: chatGPTTabId });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'No ChatGPT tab found' });
    }
  } else if (request.action === "toggleTabActivation") {
    const result = toggleTabActivation(request.enable, request.intervalMinutes || 5);
    sendResponse(result);
    return true;
  } else if (request.action === "pollManually") {
    pollOnce().then(hadRequest => {
      sendResponse({ success: true, hadRequest });
    }).catch(error => {
      sendResponse({ success: false, error: error.toString() });
    });
    return true;
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If this is a chatGPT tab and it's done loading
  if (changeInfo.status === 'complete' && tab.url && isChatGPTUrl(tab.url)) {
    console.log(`ChatGPT tab ${tabId} updated. URL: ${tab.url}`);
    
    // Store this as our current ChatGPT tab
    chatGPTTabId = tabId;
    chrome.storage.local.set({ chatGPTTabId });
    
    // Inject the content script after a delay to ensure the page is fully loaded
    setTimeout(() => {
      injectContentScriptIfNeeded(tabId).catch(error => {
        console.error(`Error ensuring content script in updated tab ${tabId}:`, error);
      });
    }, 1000);
  } else if (chatGPTTabId === tabId && changeInfo.status === 'complete' && tab.url && !isChatGPTUrl(tab.url)) {
    console.log(`Tab ${tabId} is no longer on ChatGPT`);
    chatGPTTabId = null;
    chrome.storage.local.remove('chatGPTTabId');
  }
});

// Listen for tab closures
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (chatGPTTabId === tabId) {
    console.log(`ChatGPT tab ${tabId} was closed`);
    chatGPTTabId = null;
    chrome.storage.local.remove('chatGPTTabId');
  }
});

// Function to open a ChatGPT tab
async function openChatGPTTab() {
  return new Promise((resolve, reject) => {
    // Check if we already have a ChatGPT tab open
    if (chatGPTTabId) {
      chrome.tabs.get(chatGPTTabId, (tab) => {
        if (!chrome.runtime.lastError && tab && isChatGPTUrl(tab.url)) {
          chrome.tabs.update(chatGPTTabId, { active: true });
          console.log(`Activated existing ChatGPT tab: ${chatGPTTabId}`);
          resolve(chatGPTTabId);
          return;
        }
        
        // Tab doesn't exist or is not ChatGPT, create a new one
        console.log("Existing tab invalid, creating new one");
        createNewChatGPTTab(resolve, reject);
      });
    } else {
      console.log("No existing tab, creating new one");
      createNewChatGPTTab(resolve, reject);
    }
  });
}

// Helper function to create a new ChatGPT tab
function createNewChatGPTTab(resolve, reject) {
  chrome.tabs.create({ url: 'https://chat.openai.com/', active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      reject(new Error(`Failed to create tab: ${chrome.runtime.lastError.message}`));
      return;
    }
    
    chatGPTTabId = tab.id;
    chrome.storage.local.set({ chatGPTTabId });
    console.log(`Created new ChatGPT tab: ${chatGPTTabId}`);
    
    // Wait for the page to load and initialize content script
    let loadingTimeout = null;
    
    const onTabUpdated = function(tabId, changeInfo, updatedTab) {
      if (tabId === chatGPTTabId && changeInfo.status === 'complete' && 
          updatedTab.url && isChatGPTUrl(updatedTab.url)) {
        
        console.log("ChatGPT tab fully loaded");
        
        // Clear the timeout since the tab loaded correctly
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        
        // Wait a bit for the page to fully initialize and content scripts to load
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          console.log("ChatGPT tab ready for interaction");
          
          // Inject content script
          chrome.scripting.executeScript({
            target: { tabId: chatGPTTabId },
            files: ['content.js']
          }).then(() => {
            console.log("Content script injected successfully");
            
            // Verify content script is active
            chrome.tabs.sendMessage(chatGPTTabId, { action: 'ping' }, response => {
              if (chrome.runtime.lastError) {
                console.warn("Content script not responding yet:", chrome.runtime.lastError);
                // Still resolve since the tab is open
                resolve(chatGPTTabId);
                return;
              }
              
              console.log("Content script responded to ping:", response);
              resolve(chatGPTTabId);
            });
          }).catch(error => {
            console.error("Error injecting content script:", error);
            resolve(chatGPTTabId); // Still resolve to allow manual retry
          });
        }, 5000);  // Wait 5 seconds to ensure everything is fully loaded
      }
    };
    
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    
    // Set a timeout in case the tab never fully loads
    loadingTimeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      reject(new Error('Timeout waiting for ChatGPT tab to load'));
    }, 30000);  // 30-second timeout
  });
}

// Function to periodically activate the ChatGPT tab
function startTabActivation(intervalMinutes = 5) {
  // Clear any existing interval
  if (tabActivationInterval) {
    clearInterval(tabActivationInterval);
    tabActivationInterval = null;
  }
  
  if (!isTabActivationEnabled) return;
  
  // Convert minutes to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;
  
  tabActivationInterval = setInterval(async () => {
    if (chatGPTTabId) {
      try {
        // Check if the tab still exists
        const tab = await chrome.tabs.get(chatGPTTabId);
        if (tab) {
          // Briefly activate the tab
          await chrome.tabs.update(chatGPTTabId, { active: true });
          
          // After a short delay, send the tab back to the background
          setTimeout(async () => {
            try {
              // Get the current active tab
              const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (currentTab && currentTab.id === chatGPTTabId) {
                // Only move back if the ChatGPT tab is still active
                // Find another tab to activate
                const tabs = await chrome.tabs.query({ 
                  active: false, 
                  currentWindow: true
                });
                
                // Filter out the ChatGPT tab
                const otherTabs = tabs.filter(t => t.id !== chatGPTTabId);
                
                if (otherTabs.length > 0) {
                  await chrome.tabs.update(otherTabs[0].id, { active: true });
                }
              }
            } catch (error) {
              console.error("Error returning from tab activation:", error);
            }
          }, 1000); // 1 second delay
        }
      } catch (error) {
        console.error("Error during tab activation:", error);
        // Tab might not exist anymore
        if (error.message.includes("No tab with id")) {
          clearInterval(tabActivationInterval);
          tabActivationInterval = null;
          chatGPTTabId = null;
        }
      }
    }
  }, intervalMs);
  
  console.log(`Tab activation started with interval of ${intervalMinutes} minutes`);
}

function stopTabActivation() {
  if (tabActivationInterval) {
    clearInterval(tabActivationInterval);
    tabActivationInterval = null;
    console.log("Tab activation stopped");
  }
}

function toggleTabActivation(enable, intervalMinutes) {
  isTabActivationEnabled = enable;
  
  if (enable) {
    startTabActivation(intervalMinutes);
  } else {
    stopTabActivation();
  }
  
  // Save the setting
  chrome.storage.local.set({ 
    isTabActivationEnabled: enable,
    tabActivationInterval: intervalMinutes
  });
  
  return { success: true, enabled: enable };
}

// Initialize settings from storage
chrome.storage.local.get(["isTabActivationEnabled", "tabActivationInterval"], (result) => {
  if (result.isTabActivationEnabled) {
    isTabActivationEnabled = result.isTabActivationEnabled;
    if (isTabActivationEnabled) {
      startTabActivation(result.tabActivationInterval || 5);
    }
  }
});

// Function to save registration status
function saveRegistrationStatus() {
  chrome.storage.local.set({ isRegistered });
}

// Update error handling to save the last error
function setLastError(error) {
  lastError = error;
  chrome.storage.local.set({ lastError });
} 