// ChatGPT DOM selectors - updated for the latest ChatGPT interface May 2024
const SELECTORS = {
  // Main chat input field - multiple patterns to try
  chatInput: [
    'div[role="textbox"][contenteditable="true"]',
    'textarea[data-id]', 
    'textarea[placeholder="Message ChatGPT…"]',
    'textarea[class*="text-input"]',
    'div[contenteditable="true"]',
    'textarea'
  ],
  // Send button selectors - multiple options to try
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button form[role="form"] + button',
    'textarea[data-id] ~ button',
    'button[class*="send"]',
    'button svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]'
  ],
  // New chat button
  newChatButton: [
    'a[data-testid="navigation-new-chat"]',
    'nav a.flex',
    'button[class*="new-chat"]'
  ],
  // Response selectors
  responseElement: [
    '.markdown',
    'div[data-message-author-role="assistant"]',
    '.agent-turn'
  ],
  completedResponse: [
    '[data-message-author-role="assistant"]:last-child .markdown',
    '[data-message-author-role="assistant"]:last-child',
    '.agent-turn:last-child',
    'div[data-message-id] div[data-message-author-role="assistant"]:last-child'
  ],
  // Loading indicator
  loadingIndicator: [
    '.text-token-text-secondary .animate-spin',
    '.result-streaming'
  ],
  // Copy button
  copyButton: [
    '[data-message-author-role="assistant"]:last-child button[aria-label="Copy message"]',
    '[data-message-author-role="assistant"]:last-child button[aria-label="Copy to clipboard"]',
    'button[aria-label="Copy"]'
  ]
};

// Debug logging with timestamps
function debug(message, ...args) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[ChatGPT Bridge ${timestamp}]`, message, ...args);
}

// Try different selectors until one works
function querySelector(selectors) {
  if (Array.isArray(selectors)) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          debug(`Found element with selector: ${selector}`);
          return element;
        }
      } catch (error) {
        debug(`Error with selector "${selector}":`, error);
      }
    }
    return null;
  }
  return document.querySelector(selectors);
}

// Checks if element is visible and enabled
function isElementReady(element) {
  return element && element.offsetParent !== null && !element.disabled;
}

// Waits for an element to appear in the DOM with timeout
function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = querySelector(selectors);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        // Log all attempted selectors for debugging
        if (Array.isArray(selectors)) {
          debug('Failed selectors:', selectors);
        }
        reject(new Error(`Timeout waiting for element: ${Array.isArray(selectors) ? selectors.join(', ') : selectors}`));
        return;
      }
      
      setTimeout(checkElement, 300);
    };
    
    checkElement();
  });
}

// Waits for an element to disappear from the DOM
function waitForElementToDisappear(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = querySelector(selectors);
      if (!element) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element to disappear: ${Array.isArray(selectors) ? selectors.join(', ') : selectors}`));
        return;
      }
      
      setTimeout(checkElement, 300);
    };
    
    checkElement();
  });
}

// Start a new chat if requested
async function startNewChat() {
  try {
    debug('Starting new chat...');
    const newChatButton = await waitForElement(SELECTORS.newChatButton);
    newChatButton.click();
    // Wait for the page to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    debug('New chat started');
    return true;
  } catch (error) {
    console.error('Error starting new chat:', error);
    return false;
  }
}

// Handles different input methods (contenteditable div vs textarea)
async function setInputValue(inputElement, message) {
  const isContentEditable = inputElement.getAttribute('contenteditable') === 'true';
  
  debug(`Setting input value, isContentEditable: ${isContentEditable}`);
  
  if (isContentEditable) {
    // For contenteditable divs
    inputElement.innerHTML = '';
    inputElement.focus();
    
    // Use execCommand for contenteditable
    document.execCommand('insertText', false, message);
    
    // Also try direct setting
    inputElement.textContent = message;
    
    // Dispatch input event
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // For standard textareas
    inputElement.value = '';
    inputElement.focus();
    inputElement.value = message;
    
    // Dispatch events to simulate actual typing
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Sends a message to ChatGPT
async function sendMessage(message) {
  try {
    debug(`Preparing to send message: "${message.substring(0, 30)}..."`);
    
    // Find the textarea or input area
    const inputElement = await waitForElement(SELECTORS.chatInput);
    if (!inputElement) {
      throw new Error('Cannot find input element');
    }
    
    debug('Found input element:', inputElement);
    
    // Set the input value
    await setInputValue(inputElement, message);
    
    debug('Message inserted, looking for send button...');
    
    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find and click the send button
    const sendButton = await waitForElement(SELECTORS.sendButton);
    if (!isElementReady(sendButton)) {
      throw new Error('Send button is not clickable');
    }
    
    debug('Clicking send button...');
    sendButton.click();
    
    // Wait for response to complete
    const response = await waitForResponseComplete();
    debug('Response received');
    
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Waits for ChatGPT to complete its response
async function waitForResponseComplete(timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let lastDotCount = 0;
    
    const checkCompletion = async () => {
      try {
        // First, check if there's a loading indicator
        const loadingIndicator = querySelector(SELECTORS.loadingIndicator);
        
        if (loadingIndicator) {
          debug('Loading indicator found, still waiting...');
          // If we're still loading, wait more
          if (Date.now() - startTime >= timeout) {
            reject(new Error('Timeout waiting for ChatGPT response'));
            return;
          }
          
          // Print a dot every 3 seconds to show progress
          if (Math.floor((Date.now() - startTime) / 3000) > lastDotCount) {
            lastDotCount = Math.floor((Date.now() - startTime) / 3000);
            debug(`.`);
          }
          
          setTimeout(checkCompletion, 1000);
          return;
        }
        
        debug('No loading indicator, checking for response...');
        
        // Look for the copy button which appears when response is complete
        const copyButton = querySelector(SELECTORS.copyButton);
        
        if (copyButton) {
          debug('Found copy button, response is complete');
          
          // Get all possible response elements
          const responseElement = querySelector(SELECTORS.completedResponse);
          
          if (responseElement) {
            // Try to click the copy button to get text to clipboard (as fallback)
            try {
              copyButton.click();
              debug('Clicked copy button');
            } catch (e) {
              debug('Failed to click copy button', e);
            }
            
            // Extract text content
            let responseText = "";
            
            try {
              responseText = responseElement.innerText || responseElement.textContent;
              debug(`Got response (first 30 chars): "${responseText.substring(0, 30)}..."`);
            } catch (e) {
              debug('Error getting text content:', e);
              responseText = "Error extracting response text";
            }
            
            // Return the response
            resolve(responseText);
            return;
          } else {
            debug('Copy button found but no response element');
          }
        }
        
        // If no response found yet but no loading indicator, give it a moment and try again
        if (Date.now() - startTime >= timeout) {
          debug('Timeout waiting for response');
          reject(new Error('Timeout waiting for ChatGPT response'));
          return;
        }
        
        // Keep checking every 500ms
        setTimeout(checkCompletion, 500);
      } catch (error) {
        console.error('Error checking response completion:', error);
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          // Try again after a delay
          setTimeout(checkCompletion, 1000);
        }
      }
    };
    
    // Start checking
    checkCompletion();
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug('Content script received message:', request);
  
  if (request.action === 'sendMessage') {
    (async () => {
      try {
        debug(`Processing message request: "${request.message.substring(0, 30)}..."`);
        
        // Start new chat if requested
        if (request.newConversation) {
          await startNewChat();
        }
        
        // Send the message and get response
        const response = await sendMessage(request.message);
        
        // Send back the response
        debug('Sending response back to background script');
        sendResponse({ response });
      } catch (error) {
        console.error('Error in content script:', error);
        sendResponse({ error: error.message || 'Unknown error in content script' });
      }
    })();
    
    // Return true to indicate we'll respond asynchronously
    return true;
  } else if (request.action === 'ping') {
    // Simple ping to check if content script is loaded
    debug('Received ping, sending pong');
    sendResponse({ status: 'pong', url: window.location.href });
    return true;
  }
});

// Document load state
debug('OpenAPI content script loaded successfully!');
debug('Current URL:', window.location.href);

// Log environment info
debug('User Agent:', navigator.userAgent);
debug('Window size:', window.innerWidth, 'x', window.innerHeight);

// Check if we're on the right page
if (window.location.href.includes('chat.openai.com') || window.location.href.includes('chatgpt.com')) {
  debug('On ChatGPT page, script ready');
} else {
  debug('WARNING: Not on ChatGPT page. Current URL:', window.location.href);
} 