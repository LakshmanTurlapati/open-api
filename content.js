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
    'div[data-message-id] div[data-message-author-role="assistant"]:last-child',
    // Specific selectors for existing conversations
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
    'div[data-testid="thinking"]'
  ],
  // Copy button
  copyButton: [
    '[data-message-author-role="assistant"]:last-child button[aria-label="Copy message"]',
    '[data-message-author-role="assistant"]:last-child button[aria-label="Copy to clipboard"]',
    'button[aria-label="Copy"]',
    '[data-message-author-role="assistant"]:last-child button:has(svg)',
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

// Simple function to get text from the latest assistant message
function getLatestResponseText() {
  debug('Getting latest response text');
  
  // Method 1: Try to find the most recent assistant message in the current conversation
  // Look for the last message with data-message-author-role="assistant"
  const allAssistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (allAssistantMessages && allAssistantMessages.length > 0) {
    const lastMessage = allAssistantMessages[allAssistantMessages.length - 1];
    const text = lastMessage.innerText || lastMessage.textContent;
    debug(`Got response from last assistant message (${allAssistantMessages.length} total): ${text.length} chars`);
    return text;
  }
  
  // Method 2: Try with the selector for completed responses
  const responseElement = querySelector(SELECTORS.completedResponse);
  if (responseElement) {
    const text = responseElement.innerText || responseElement.textContent;
    debug(`Got response from completed response element: ${text.length} chars`);
    return text;
  }
  
  // Method 3: Look for markdown content in the last message
  const markdownElements = document.querySelectorAll('.markdown');
  if (markdownElements && markdownElements.length > 0) {
    const lastMarkdown = markdownElements[markdownElements.length - 1];
    const text = lastMarkdown.innerText || lastMarkdown.textContent;
    debug(`Got response from last markdown element: ${text.length} chars`);
    return text;
  }
  
  debug('Could not find any response text');
  return '';
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
    
    // Count the number of assistant messages before sending
    const beforeCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`Number of assistant messages before sending: ${beforeCount}`);
    
    debug('Clicking send button...');
    sendButton.click();
    
    // Wait for response to complete
    debug('Waiting for response to complete...');
    const response = await waitForResponseComplete();
    
    // Verify we got a new response by checking if the number of assistant messages increased
    const afterCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`Number of assistant messages after response: ${afterCount}`);
    
    if (afterCount <= beforeCount) {
      debug('Warning: No new assistant message detected. Trying alternative method to get response.');
      // Try to get the latest response text again
      const latestResponse = getLatestResponseText();
      if (latestResponse) {
        debug(`Got response using alternative method (${latestResponse.length} chars)`);
        return latestResponse;
      }
    }
    
    debug(`Response received (${response.length} chars)`);
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
    let lastResponseLength = 0;
    let stableCount = 0;
    
    // Get the initial count of assistant messages
    const initialAssistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`Initial assistant message count: ${initialAssistantCount}`);
    
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
        
        // Check if a new assistant message has appeared
        const currentAssistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
        if (currentAssistantCount > initialAssistantCount) {
          debug(`New assistant message detected: ${initialAssistantCount} -> ${currentAssistantCount}`);
          // Focus on the newest message
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          const newestMessage = assistantMessages[assistantMessages.length - 1];
          
          // Get current response text from the newest message
          const currentText = newestMessage.innerText || newestMessage.textContent;
          const currentLength = currentText.length;
          
          // If text is still growing, keep waiting
          if (currentLength > lastResponseLength) {
            debug(`Response still growing: ${lastResponseLength} -> ${currentLength} chars`);
            lastResponseLength = currentLength;
            stableCount = 0;
            setTimeout(checkCompletion, 1000);
            return;
          }
          
          // Text has stopped growing, check if it's stable
          if (currentLength > 0) {
            stableCount++;
            debug(`Response stable for ${stableCount} checks (${currentLength} chars)`);
            
            // Consider the response complete after it's been stable for 3 checks
            if (stableCount >= 3) {
              debug('Response is complete and stable');
              
              // Try to click the copy button if available
              const copyButton = querySelector(SELECTORS.copyButton);
              if (copyButton) {
                try {
                  debug('Found copy button, clicking it');
                  copyButton.scrollIntoView({ behavior: 'auto' });
                  await new Promise(resolve => setTimeout(resolve, 300));
                  copyButton.click();
                  debug('Clicked copy button');
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                  debug('Error clicking copy button:', e);
                }
              }
              
              resolve(currentText);
              return;
            }
          }
        } else {
          // No new assistant message, use the standard method
          // Get current response text
          const currentText = getLatestResponseText();
          const currentLength = currentText.length;
          
          // If text is still growing, keep waiting
          if (currentLength > lastResponseLength) {
            debug(`Response still growing: ${lastResponseLength} -> ${currentLength} chars`);
            lastResponseLength = currentLength;
            stableCount = 0;
            setTimeout(checkCompletion, 1000);
            return;
          }
          
          // Text has stopped growing, check if it's stable
          if (currentLength > 0) {
            stableCount++;
            debug(`Response stable for ${stableCount} checks (${currentLength} chars)`);
            
            // Consider the response complete after it's been stable for 3 checks
            if (stableCount >= 3) {
              debug('Response is complete and stable');
              
              // Try to click the copy button if available
              const copyButton = querySelector(SELECTORS.copyButton);
              if (copyButton) {
                try {
                  debug('Found copy button, clicking it');
                  copyButton.scrollIntoView({ behavior: 'auto' });
                  await new Promise(resolve => setTimeout(resolve, 300));
                  copyButton.click();
                  debug('Clicked copy button');
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                  debug('Error clicking copy button:', e);
                }
              }
              
              resolve(currentText);
              return;
            }
          }
        }
        
        // No response text found, check again shortly
        if (Date.now() - startTime >= timeout) {
          debug('Timeout waiting for response');
          
          // Return whatever text we have even if empty
          const finalText = getLatestResponseText();
          if (finalText.trim()) {
            resolve(finalText);
          } else {
            reject(new Error('Timeout waiting for ChatGPT response'));
          }
          return;
        }
        
        setTimeout(checkCompletion, 1000);
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
        debug(`New conversation flag: ${request.newConversation}`);
        
        // Start new chat if requested
        if (request.newConversation) {
          await startNewChat();
          debug('New chat started successfully');
          // Wait a bit more for UI to settle after starting new chat
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          debug('Continuing in existing conversation');
          // For existing conversations, make sure we're ready to capture the latest response
          // Count current assistant messages to track when a new one appears
          const currentAssistantCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
          debug(`Current assistant message count: ${currentAssistantCount}`);
        }
        
        // Send the message and get response
        const response = await sendMessage(request.message);
        
        // Send back the response
        debug(`Sending response back to background script (length: ${response.length})`);
        sendResponse({ response });
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