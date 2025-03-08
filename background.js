// Background script at the very beginning - log startup
console.log("OpenAPI background script started");

// Variables
let apiKey = null;
let chatGPTTabId = null;
let serverUrl = "http://localhost:3000"; // Change this to your server URL when deployed
let isRegistered = false;
let lastError = null;
let isTabActivationEnabled = false;
let isTabActivationInProgress = false; // Flag to track if tab activation is in progress
let lastPollTime = Date.now(); // Track the last poll time
let lastServerContact = Date.now(); // Track the last server contact time

// Constants
const CHAT_GPT_URLS = [
  "https://chat.openai.com",
  "https://chat.openai.com/",
  "https://chat.openai.com/c/",
  "https://chatgpt.com",
  "https://chatgpt.com/"
];

// Set up persistent alarms
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 }); // Every 30 seconds
chrome.alarms.create('serverPoll', { periodInMinutes: 0.1 }); // Every 6 seconds
chrome.alarms.create('checkConnection', { periodInMinutes: 1 }); // Every minute
chrome.alarms.create('tabKeepAlive', { periodInMinutes: 2 }); // Every 2 minutes

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('KeepAlive alarm triggered');
    keepBackgroundAlive();
  } else if (alarm.name === 'serverPoll') {
    console.log('ServerPoll alarm triggered');
    performServerPoll();
  } else if (alarm.name === 'checkConnection') {
    console.log('CheckConnection alarm triggered');
    // If it's been more than 2 minutes since our last server contact, re-establish connection
    if (Date.now() - lastServerContact > 120000) {
      console.log('Connection seems lost. Re-establishing...');
      isRegistered = false;
      registerWithServer();
    }
    
    // Also check ChatGPT tab
    if (chatGPTTabId) {
      verifyChatGPTTab(chatGPTTabId).catch(error => {
        console.error("Error verifying ChatGPT tab:", error);
      });
    }
  } else if (alarm.name === 'tabKeepAlive') {
    console.log('TabKeepAlive alarm triggered');
    if (chatGPTTabId) {
      // Send a keepAlive message to the content script
      chrome.tabs.sendMessage(chatGPTTabId, { action: 'keepAlive' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Could not send keepAlive to content script:', chrome.runtime.lastError);
          // Tab might be unresponsive, let's check it
          verifyChatGPTTab(chatGPTTabId).catch(() => { /* Ignore errors */ });
        } else {
          console.log('Content script responded to keepAlive:', response);
        }
      });
    }
  }
});

// Keep the background page alive by creating and releasing an object URL
function keepBackgroundAlive() {
  const blob = new Blob(['keepAlive']);
  const objURL = URL.createObjectURL(blob);
  
  // Clean up the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(objURL), 1000);
}

// Perform a single poll to the server
async function performServerPoll() {
  try {
    if (!apiKey) {
      console.log('No API key available. Skipping poll.');
      return;
    }
    
    console.log('Polling server:', serverUrl);
    const response = await fetch(`${serverUrl}/poll/${apiKey}`);
    const data = await response.json();
    
    lastPollTime = Date.now(); // Update the last successful poll time
    lastServerContact = Date.now(); // Update last server contact time
    
    // If we have a request to process
    if (data.requestId) {
      console.log('Received request:', data);
      handleServerRequest(data);
    }
  } catch (error) {
    console.error('Error polling server:', error);
    lastError = `Polling error: ${error.message || 'Unknown error'}`;
    
    // If it's been a while since our last successful contact, try to re-register
    if (Date.now() - lastServerContact > 60000) { // 1 minute
      isRegistered = false;
      registerWithServer();
    }
  }
}

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
chrome.storage.local.get(['apiKey', 'chatGPTTabId', 'serverUrl'], (result) => {
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
        
        return true;
      }
    }
    
    logWithTime('No existing ChatGPT tabs found');
    return false;
  } catch (error) {
    console.error('Error finding existing ChatGPT tab:', error);
    return false;
  }
}

// Function to register with the server
async function registerWithServer() {
  if (isRegistered || !apiKey) return;
  
  try {
    console.log(`Registering with server: ${serverUrl}`);
    
    const response = await fetch(`${serverUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extensionId: chrome.runtime.id,
        apiKey: apiKey,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Successfully registered with server');
      isRegistered = true;
      lastServerContact = Date.now();
      
      // Start persistent polling via alarms (legacy function call for compatibility)
      startPolling();
    } else {
      console.error('Failed to register with server:', data.error || 'Unknown error');
      lastError = `Registration error: ${data.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error registering with server:', error);
    lastError = `Registration error: ${error.message || 'Unknown error'}`;
    
    // Schedule a retry after a delay
    setTimeout(registerWithServer, 10000);
  }
}

// Function to start polling the server for requests - now uses alarms for persistence
function startPolling() {
  // We're now using alarms for persistent polling
  logWithTime('StartPolling called - now using alarm-based polling for persistence');
  
  // Do an immediate poll
  performServerPoll();
}

// Function to verify ChatGPT tab is still valid and working
async function verifyChatGPTTab(tabId) {
  if (!tabId) return Promise.reject(new Error('No tab ID provided'));
  
  try {
    // First check if tab exists
    const tab = await chrome.tabs.get(tabId);
    
    // Check if it's a ChatGPT URL
    if (!isChatGPTUrl(tab.url)) {
      throw new Error(`Tab exists but is not on a ChatGPT URL: ${tab.url}`);
    }
    
    // Check if content script is responsive by sending a ping
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          console.log('Content script not responsive:', chrome.runtime.lastError);
          
          // Try to inject the content script
          injectContentScriptIfNeeded(tabId)
            .then(() => resolve(true))
            .catch(error => reject(error));
        } else {
          console.log('Content script is responsive:', response);
          resolve(true);
        }
      });
      
      // Set a timeout for the ping response
      setTimeout(() => {
        reject(new Error('Timeout waiting for content script response'));
      }, 5000);
    });
  } catch (error) {
    console.error(`Error verifying tab ${tabId}:`, error);
    
    // If the tab doesn't exist, clear the stored tab ID
    if (error.message.includes('No tab with id')) {
      chatGPTTabId = null;
      chrome.storage.local.remove('chatGPTTabId');
    }
    
    return Promise.reject(error);
  }
}

// Function to inject content script if needed
async function injectContentScriptIfNeeded(tabId) {
  return new Promise((resolve, reject) => {
    // First check if content script is already loaded
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
      // If we get a response, content script is already loaded
      if (!chrome.runtime.lastError && response) {
        console.log('Content script already loaded:', response);
        resolve(true);
        return;
      }
      
      // Otherwise, we need to inject it
      console.log('Content script not detected, injecting...');
      
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }).then(() => {
        console.log('Content script injected, verifying...');
        
        // Verify it's now loaded
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'ping' }, verifyResponse => {
            if (chrome.runtime.lastError || !verifyResponse) {
              const error = chrome.runtime.lastError 
                ? chrome.runtime.lastError.message 
                : 'No response from content script after injection';
              console.error('Content script verification failed:', error);
              reject(new Error(error));
            } else {
              console.log('Content script verified:', verifyResponse);
              resolve(true);
            }
          });
        }, 1000); // Wait a second for the script to initialize
      }).catch(error => {
        console.error('Error injecting content script:', error);
        reject(error);
      });
    });
  });
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
    lastServerContact = Date.now(); // Update the last server contact time
    console.log('Sent response to server for request:', requestId);
  } catch (error) {
    console.error('Error sending response to server:', error);
    lastError = `Error sending response: ${error.message || 'Unknown error'}`;
  }
}

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

// Register message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background script:", message);
  
  // Handle different message types
  if (message.action === 'openChatGPTTab') {
    openChatGPTTab()
      .then(tabId => sendResponse({ success: true, tabId }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'openChatGPT') {
    openChatGPTTab()
      .then(tabId => sendResponse({ success: true, tabId }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'getChatGPTStatus') {
    // Check if we have a valid tab
    if (!chatGPTTabId) {
      sendResponse({ chatGPTTabOpen: false });
      return true;
    }
    
    verifyChatGPTTab(chatGPTTabId)
      .then(() => sendResponse({ chatGPTTabOpen: true, tabId: chatGPTTabId }))
      .catch(() => sendResponse({ chatGPTTabOpen: false }));
    return true;
  }
  
  if (message.action === 'resetChatGPTTab') {
    // Clear the current tab
    chatGPTTabId = null;
    chrome.storage.local.remove('chatGPTTabId');
    
    // Try to find an existing one
    findExistingChatGPTTab()
      .then(found => sendResponse({ 
        success: true, 
        foundExistingTab: found, 
        tabId: chatGPTTabId 
      }))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true;
  }
  
  if (message.action === 'forceInjectContentScript') {
    if (!chatGPTTabId) {
      sendResponse({ success: false, error: 'No ChatGPT tab found' });
      return true;
    }
    
    injectContentScriptIfNeeded(chatGPTTabId)
      .then(() => sendResponse({ success: true, tabId: chatGPTTabId }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'setTabActivation') {
    const { enabled, intervalMinutes } = message;
    
    if (enabled) {
      // Update the alarm interval
      chrome.alarms.create('tabKeepAlive', { 
        periodInMinutes: intervalMinutes || 2
      });
      console.log(`Tab activation set to ${intervalMinutes} minutes`);
    }
    
    sendResponse({ success: true, enabled });
    return true;
  }
  
  if (message.action === 'toggleTabActivation') {
    const { enable, intervalMinutes } = message;
    isTabActivationEnabled = enable;
    
    if (enable) {
      // Update the alarm interval
      chrome.alarms.create('tabKeepAlive', { 
        periodInMinutes: intervalMinutes || 2
      });
      console.log(`Tab activation set to ${intervalMinutes} minutes`);
    }
    
    // Save the setting
    chrome.storage.local.set({ 
      isTabActivationEnabled: enable,
      tabActivationInterval: intervalMinutes
    });
    
    sendResponse({ success: true, enabled: enable });
    return true;
  }
  
  if (message.action === 'getServerUrl') {
    sendResponse({ serverUrl });
    return true;
  }
  
  if (message.action === 'setServerUrl') {
    serverUrl = message.serverUrl;
    chrome.storage.local.set({ serverUrl });
    
    // Re-register with the new server
    isRegistered = false;
    registerWithServer();
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getApiKey') {
    sendResponse({ apiKey });
    return true;
  }
  
  if (message.action === 'getServerStatus') {
    sendResponse({
      serverUrl,
      isRegistered,
      lastError,
      lastServerContact: new Date(lastServerContact).toISOString()
    });
    return true;
  }
  
  if (message.action === 'regenerateApiKey') {
    // Generate a new API key
    apiKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    chrome.storage.local.set({ apiKey });
    
    // Re-register with the server
    isRegistered = false;
    registerWithServer();
    
    sendResponse({ success: true, apiKey });
    return true;
  }
  
  if (message.action === 'getStatus') {
    sendResponse({
      apiKey,
      chatGPTTabId,
      isRegistered,
      lastError,
      serverUrl,
      lastPollTime: new Date(lastPollTime).toISOString(),
      lastServerContact: new Date(lastServerContact).toISOString(),
      extensionId: chrome.runtime.id
    });
    return true;
  }
  
  if (message.action === 'getLastError') {
    sendResponse({
      lastError,
      timestamp: new Date().toISOString()
    });
    return true;
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!chatGPTTabId) return;
  
  if (tabId === chatGPTTabId && changeInfo.status === 'loading') {
    console.log(`ChatGPT tab ${tabId} is navigating to: ${tab.url || 'unknown URL'}`);
    
    // If it navigates away from ChatGPT, reset our tracking
    if (tab.url && !isChatGPTUrl(tab.url)) {
      console.log(`Tab ${tabId} is no longer on ChatGPT, resetting tracking`);
      chatGPTTabId = null;
      chrome.storage.local.remove('chatGPTTabId');
    }
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

// Log initial state
console.log("Background script initialized. Extension ID:", chrome.runtime.id);
