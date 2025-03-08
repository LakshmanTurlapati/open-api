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
    'button[class*="new-chat"]',
    'a.rounded[href="/"]'
  ],
  // Response selectors - updated for 2024 structure
  responseElement: [
    '.markdown',
    'div[data-message-author-role="assistant"]',
    '.agent-turn',
    'div[data-message-author-role="assistant"] .markdown'
  ],
  // Selectors for completed responses
  completedResponse: [
    'div[data-message-author-role="assistant"]:last-of-type .markdown',
    'div[data-message-author-role="assistant"]:last-of-type',
    'div[data-message-id][data-message-author-role="assistant"]:last-of-type',
    'div.chat-message-container:last-child .chat-message[data-message-author-role="assistant"]',
    '.agent-turn:last-child',
    'div[data-message-id] div[data-message-author-role="assistant"]:last-child',
    'div.empty\\:hidden:last-child',
    'div[data-message-author-role="assistant"]:not([data-message-id=""]):last-child'
  ],
  // Loading indicator
  loadingIndicator: [
    '.text-token-text-secondary .animate-spin',
    '.result-streaming',
    '.result-thinking',
    'div[data-state="thinking"]',
    'svg.animate-spin',
    'div[data-testid="thinking"]',
    'button[aria-label="Stop generating"]',
    '.text-2xl.animate-spin'
  ],
  // Copy button
  copyButton: [
    'div[data-message-author-role="assistant"]:last-child button[aria-label="Copy message"]',
    'div[data-message-author-role="assistant"]:last-child button[aria-label="Copy to clipboard"]',
    'button[aria-label="Copy"]',
    'div[data-message-author-role="assistant"]:last-child button:has(svg)',
    'div[data-message-author-role="assistant"] button:has(svg)'
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
        if (Array.isArray(selectors)) {
          debug('Failed selectors:', selectors);
        }
        reject(new Error(`Timeout waiting for element: ${Array.isArray(selectors) ? selectors.join(', ') : selectors}`));
        return;
      }
      
      setTimeout(checkElement, 500);
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

// Function to get text from the latest assistant message - STEAM DECK FIX
function getLatestResponseText() {
  debug('Getting latest response text - STEAM DECK FIX');
  
  try {
    // DIRECT METHOD: Get all assistant messages and take the very last one
    const allAssistantMessages = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"]'));
    debug(`Found ${allAssistantMessages.length} total assistant messages`);
    
    if (allAssistantMessages.length > 0) {
      // Get the absolute LAST assistant message
      const lastMessage = allAssistantMessages[allAssistantMessages.length - 1];
      
      // Log some information about this message to help with debugging
      const messageId = lastMessage.getAttribute('data-message-id') || 'unknown';
      debug(`Last message ID: ${messageId}`);
      
      // First try to get text from a markdown container inside
      const markdown = lastMessage.querySelector('.markdown');
      if (markdown) {
        const text = markdown.innerText || markdown.textContent;
        debug(`Got text from last message's markdown: ${text.length} chars`);
        debug(`First 30 chars: "${text.substring(0, 30)}..."`);
        return text;
      }
      
      // If no markdown, get text directly from the container
      const text = lastMessage.innerText || lastMessage.textContent;
      debug(`Got text directly from last message: ${text.length} chars`);
      debug(`First 30 chars: "${text.substring(0, 30)}..."`);
      return text;
    }
    
    // FALLBACK METHOD 1: Try using querySelector with :last-of-type
    debug('Trying fallback method 1: querySelector with :last-of-type');
    const lastOfType = document.querySelector('div[data-message-author-role="assistant"]:last-of-type');
    if (lastOfType) {
      const text = lastOfType.innerText || lastOfType.textContent;
      debug(`Got text using :last-of-type: ${text.length} chars`);
      debug(`First 30 chars: "${text.substring(0, 30)}..."`);
      return text;
    }
    
    // FALLBACK METHOD 2: Try using :last-child on parent container
    debug('Trying fallback method 2: :last-child on parent containers');
    const conversationContainer = document.querySelector('.conversation-main, .conversation-container, main, [role="main"]');
    if (conversationContainer) {
      const lastAssistantInContainer = Array.from(
        conversationContainer.querySelectorAll('div[data-message-author-role="assistant"]')
      ).pop();
      
      if (lastAssistantInContainer) {
        const text = lastAssistantInContainer.innerText || lastAssistantInContainer.textContent;
        debug(`Got text from container's last assistant: ${text.length} chars`);
        debug(`First 30 chars: "${text.substring(0, 30)}..."`);
        return text;
      }
    }
    
    // FALLBACK METHOD 3: Try with different known selectors
    debug('Trying fallback method 3: Various known selectors');
    const selectors = [
      '.message:last-child',
      '.chat-message:last-child',
      '.markdown:last-child',
      '.agent-turn:last-child',
      'div.empty\\:hidden:last-child',
      '[data-message-author-role="assistant"]:last-child'
    ];
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.innerText || element.textContent;
          if (text && text.length > 0) {
            debug(`Got text using selector ${selector}: ${text.length} chars`);
            debug(`First 30 chars: "${text.substring(0, 30)}..."`);
            return text;
          }
        }
      } catch (error) {
        debug(`Error with selector ${selector}: ${error.message}`);
      }
    }
    
    // FALLBACK METHOD 4: Use the reversed DOM walker approach
    debug('Trying fallback method 4: Reversed DOM walker');
    // Get all elements that might contain text
    const allTextElements = document.querySelectorAll('p, pre, ol, ul, h1, h2, h3, h4, h5, h6, div.markdown');
    if (allTextElements && allTextElements.length > 0) {
      // Start from the end and work backwards to get the last visible elements
      for (let i = allTextElements.length - 1; i >= 0; i--) {
        const element = allTextElements[i];
        if (element.offsetParent !== null) { // Check if element is visible
          const text = element.innerText || element.textContent;
          if (text && text.length > 0) {
            debug(`Got text using DOM walker: ${text.length} chars`);
            debug(`First 30 chars: "${text.substring(0, 30)}..."`);
            return text;
          }
        }
      }
    }
    
    // EMERGENCY FALLBACK: Try document.body and search for specific text patterns
    debug('EMERGENCY FALLBACK: Searching for assistant patterns in document');
    const bodyText = document.body.innerText;
    const assistantPatterns = [
      "ChatGPT:",
      "As an AI language model,",
      "I'm an AI assistant",
      "I'd be happy to help",
      "Here's what I found"
    ];
    
    for (const pattern of assistantPatterns) {
      const index = bodyText.lastIndexOf(pattern);
      if (index !== -1) {
        // Get everything from this pattern to the end
        const text = bodyText.substring(index);
        debug(`Found text using pattern "${pattern}": ${text.length} chars`);
        debug(`First 30 chars: "${text.substring(0, 30)}..."`);
        return text;
      }
    }
    
    debug('Could not find any response text using any method');
    return '';
  } catch (error) {
    console.error('Error in getLatestResponseText:', error);
    debug(`Error in getLatestResponseText: ${error.message}`);
    return '';
  }
}

// CRITICAL FIX - Global variables to track the very last assistant response
let lastAssistantResponse = '';
let lastUserQuery = '';
let isWaitingForResponse = false;

// Create a MutationObserver to watch for new assistant messages
const createResponseObserver = () => {
  debug('Setting up DOM mutation observer for responses...');
  
  // Function to process mutations
  const handleMutations = (mutations) => {
    if (!isWaitingForResponse) return;
    
    for (const mutation of mutations) {
      // Look for added nodes
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check each added node
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is an assistant message or contains one
            const assistantMessage = node.getAttribute && node.getAttribute('data-message-author-role') === 'assistant' 
              ? node 
              : node.querySelector && node.querySelector('[data-message-author-role="assistant"]');
            
            if (assistantMessage) {
              debug('⭐ NEW ASSISTANT MESSAGE DETECTED THROUGH MUTATION OBSERVER!');
              
              // Extract the text content
              const markdown = assistantMessage.querySelector('.markdown');
              const content = markdown || assistantMessage;
              const text = content.innerText || content.textContent;
              
              if (text && text.length > 0) {
                lastAssistantResponse = text;
                debug(`📝 Saved new response (${text.length} chars): "${text.substring(0, 30)}..."`);
              }
            }
          }
        }
      }
      
      // Also check for text changes in existing assistant messages
      if (mutation.type === 'characterData') {
        const node = mutation.target;
        if (node.parentElement) {
          // Walk up to find assistant message
          let current = node.parentElement;
          let found = false;
          
          while (current && !found) {
            if (current.getAttribute && current.getAttribute('data-message-author-role') === 'assistant') {
              found = true;
              
              // Extract the text content
              const text = current.innerText || current.textContent;
              
              if (text && text.length > 0 && text !== lastAssistantResponse) {
                lastAssistantResponse = text;
                debug(`📝 Updated response from text change (${text.length} chars): "${text.substring(0, 30)}..."`);
              }
            } else {
              current = current.parentElement;
            }
          }
        }
      }
    }
  };
  
  // Create the observer
  const observer = new MutationObserver(handleMutations);
  
  // Start observing the entire document for all changes
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    characterData: true,
    characterDataOldValue: true
  });
  
  debug('DOM mutation observer set up successfully');
  return observer;
};

// Initialize the observer when the content script loads
let responseObserver = createResponseObserver();

// Completely override sendMessage function
async function sendMessage(message) {
  try {
    debug(`💬 Sending message: "${message.substring(0, 30)}..."`);
    
    // Store the user query
    lastUserQuery = message;
    // Reset the last response
    lastAssistantResponse = '';
    // Set waiting flag
    isWaitingForResponse = true;
    
    // Count assistant messages before
    const beforeCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`Before sending: ${beforeCount} assistant messages`);
    
    // Find the textarea or input area
    const inputElement = await waitForElement(SELECTORS.chatInput);
    if (!inputElement) {
      throw new Error('Cannot find input element');
    }
    
    debug('Found input element, setting value...');
    
    // Set the input value
    await setInputValue(inputElement, message);
    
    debug('Message inserted, looking for send button...');
    
    // Wait for the UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find and click the send button
    const sendButton = await waitForElement(SELECTORS.sendButton);
    if (!isElementReady(sendButton)) {
      throw new Error('Send button is not clickable');
    }
    
    debug('Clicking send button...');
    sendButton.click();
    
    // Wait for response to complete
    debug('Waiting for response to complete...');
    await waitForResponseComplete();
    
    // Reset waiting flag
    isWaitingForResponse = false;
    
    // Count assistant messages after
    const afterCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`After sending: ${afterCount} assistant messages (${afterCount - beforeCount} new)`);
    
    // Check if we have a stored response from our observer
    if (lastAssistantResponse && lastAssistantResponse.length > 0) {
      debug(`✅ Using response from mutation observer: "${lastAssistantResponse.substring(0, 30)}..."`);
      return lastAssistantResponse;
    }
    
    // Fallback to using getLatestResponseText
    debug('⚠️ No response from mutation observer, falling back to getLatestResponseText');
    const fallbackResponse = getLatestResponseText();
    
    // Return the response (either from observer or from fallback)
    return fallbackResponse;
  } catch (error) {
    console.error('Error sending message:', error);
    // Reset waiting flag
    isWaitingForResponse = false;
    throw error;
  }
}

// Modify the waitForResponseComplete function
async function waitForResponseComplete(timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let lastDotCount = 0;
    let lastResponseLength = 0;
    let stableCount = 0;
    
    const checkCompletion = async () => {
      try {
        // First check if loading indicator is present
        const loadingIndicator = querySelector(SELECTORS.loadingIndicator);
        
        if (loadingIndicator) {
          debug('Loading indicator found, still waiting...');
          
          if (Date.now() - startTime >= timeout) {
            isWaitingForResponse = false;
            reject(new Error('Timeout waiting for ChatGPT response'));
            return;
          }
          
          if (Math.floor((Date.now() - startTime) / 3000) > lastDotCount) {
            lastDotCount = Math.floor((Date.now() - startTime) / 3000);
            debug(`.`);
          }
          
          setTimeout(checkCompletion, 500);
          return;
        }
        
        debug('No loading indicator, checking if response is stable...');
        
        // Get the current response length (using our global var if available)
        const currentResponse = lastAssistantResponse || getLatestResponseText();
        const currentLength = currentResponse.length;
        
        // If we have nothing yet, but we're still within timeout
        if (currentLength === 0) {
          if (Date.now() - startTime >= timeout) {
            isWaitingForResponse = false;
            reject(new Error('No response received'));
            return;
          }
          
          setTimeout(checkCompletion, 500);
          return;
        }
        
        // If the response is still changing
        if (currentLength !== lastResponseLength) {
          debug(`Response changed: ${lastResponseLength} → ${currentLength} chars`);
          lastResponseLength = currentLength;
          stableCount = 0;
          setTimeout(checkCompletion, 500);
          return;
        }
        
        // Response has not changed, increment stable count
        stableCount++;
        debug(`Response stable for ${stableCount} checks (${currentLength} chars)`);
        
        // Consider it complete after several stable checks
        if (stableCount >= 5) {
          debug(`Response complete! Final length: ${currentLength} chars`);
          debug(`First 50 chars: "${currentResponse.substring(0, 50)}..."`);
          resolve(currentResponse);
          return;
        }
        
        // Keep checking
        setTimeout(checkCompletion, 500);
      } catch (error) {
        console.error('Error checking completion:', error);
        debug(`Error: ${error.message}`);
        
        if (Date.now() - startTime >= timeout) {
          isWaitingForResponse = false;
          reject(error);
        } else {
          setTimeout(checkCompletion, 1000);
        }
      }
    };
    
    // Start checking
    checkCompletion();
  });
}

// Completely override the onMessage listener
chrome.runtime.onMessage.removeListener(() => {}); // Remove any existing listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug('Content script received message:', request);
  
  if (request.action === 'sendMessage') {
    (async () => {
      try {
        debug(`📩 Processing message request: "${request.message.substring(0, 30)}..."`);
        debug(`New conversation flag: ${request.newConversation}`);
        
        // Reset tracked response
        lastAssistantResponse = '';
        
        // Start new chat if requested
        if (request.newConversation) {
          try {
            debug('Starting new chat...');
            await startNewChat();
            debug('New chat started successfully');
            // Wait for the UI to fully update
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (e) {
            debug(`Error starting new chat: ${e.message}`);
            // Continue anyway
          }
        } else {
          debug('Continuing in existing conversation');
          
          // Log the current state for debugging
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          debug(`Current conversation has ${assistantMessages.length} assistant messages`);
          
          if (assistantMessages.length > 0) {
            const lastMsg = assistantMessages[assistantMessages.length - 1];
            const text = lastMsg.innerText || lastMsg.textContent;
            debug(`Last message in conversation: "${text.substring(0, 30)}..."`);
          }
        }
        
        // Make sure our observer is active
        if (!responseObserver) {
          responseObserver = createResponseObserver();
        }
        
        // Send the message and get response
        const response = await sendMessage(request.message);
        
        // Wait a moment for any final updates
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the final response - prioritize our tracked response
        const finalResponse = lastAssistantResponse || response;
        
        debug(`🎯 FINAL RESPONSE (${finalResponse.length} chars): "${finalResponse.substring(0, 30)}..."`);
        sendResponse({ response: finalResponse });
      } catch (error) {
        console.error('Error in content script:', error);
        sendResponse({ error: error.message || 'Unknown error in content script' });
      }
    })();
    
    // Return true to indicate we'll respond asynchronously
    return true;
  } else if (request.action === 'ping') {
    debug('Received ping, sending pong');
    sendResponse({ status: 'pong', url: window.location.href });
    return true;
  }
  
  if (request.action === 'keepAlive') {
    debug('Received keepAlive message');
    sendResponse({ status: 'alive' });
    return true;
  }
});

// Immediately look for any existing assistant messages and log them
(() => {
  const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  debug(`Found ${assistantMessages.length} assistant messages on page load`);
  
  if (assistantMessages.length > 0) {
    debug('Listing messages:');
    assistantMessages.forEach((msg, i) => {
      const text = msg.innerText || msg.textContent;
      debug(`Message ${i+1}: "${text.substring(0, 30)}..."`);
    });
    
    // Store the last message
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const text = lastMsg.innerText || lastMsg.textContent;
    lastAssistantResponse = text;
    debug(`Initial lastAssistantResponse set to: "${text.substring(0, 30)}..."`);
  }
})();

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