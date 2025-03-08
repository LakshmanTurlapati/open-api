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

// Sends a message to ChatGPT
async function sendMessage(message) {
  try {
    debug(`Preparing to send message: "${message.substring(0, 30)}..."`);
    
    // COUNT ASSISTANT MESSAGES BEFORE SENDING
    const beforeAssistantCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
    debug(`⭐ BEFORE: Found ${beforeAssistantCount} assistant messages before sending`);
    
    // Log the first 3 and last 3 assistant messages to debug
    const beforeMessages = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"]'));
    if (beforeMessages.length > 0) {
      const messagesToLog = Math.min(3, beforeMessages.length);
      for (let i = 0; i < messagesToLog; i++) {
        const msgText = beforeMessages[i].innerText.substring(0, 30);
        debug(`👉 First message ${i+1}: "${msgText}..."`);
      }
      for (let i = Math.max(0, beforeMessages.length - 3); i < beforeMessages.length; i++) {
        const msgText = beforeMessages[i].innerText.substring(0, 30);
        debug(`👉 Last message ${i+1}: "${msgText}..."`);
      }
    }
    
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
    debug('Waiting for response to complete...');
    await waitForResponseComplete();
    
    // Now check the number of assistant messages AFTER sending
    const afterAssistantCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
    debug(`⭐ AFTER: Found ${afterAssistantCount} assistant messages after sending`);
    
    // Also log the content of the new messages for debugging
    const afterMessages = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"]'));
    
    if (afterMessages.length > beforeAssistantCount) {
      debug(`👏 NEW MESSAGES DETECTED: ${afterMessages.length - beforeAssistantCount} new messages`);
      // Log the new messages
      for (let i = beforeAssistantCount; i < afterMessages.length; i++) {
        const msgText = afterMessages[i].innerText.substring(0, 30);
        debug(`✅ New message ${i+1}: "${msgText}..."`);
      }
    } else {
      debug(`⚠️ NO NEW MESSAGES DETECTED. Messages before: ${beforeAssistantCount}, after: ${afterAssistantCount}`);
    }
    
    // Get the latest response
    const latestResponse = getLatestResponseText();
    debug(`💬 FINAL response: ${latestResponse.length} chars`);
    debug(`First 30 chars: "${latestResponse.substring(0, 30)}..."`);
    
    return latestResponse;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Waits for ChatGPT to complete its response - STEAM DECK FIX
async function waitForResponseComplete(timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let lastDotCount = 0;
    let lastResponseLength = 0;
    let stableCount = 0;
    
    // Simply count the initial messages
    const initialMessageCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
    debug(`Initial message count: ${initialMessageCount}`);
    
    const checkCompletion = async () => {
      try {
        // First, check if there's a loading indicator
        const loadingIndicator = querySelector(SELECTORS.loadingIndicator);
        
        if (loadingIndicator) {
          debug('Loading indicator found, still waiting...');
          if (Date.now() - startTime >= timeout) {
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
        
        debug('No loading indicator, checking response stability...');
        
        // Get the latest text content
        const currentText = getLatestResponseText();
        const currentLength = currentText.length;
        
        // If nothing found yet but we haven't timed out, keep checking
        if (currentLength === 0) {
          if (Date.now() - startTime >= timeout) {
            debug('Timeout waiting for any response');
            reject(new Error('Timeout waiting for ChatGPT response - no content found'));
            return;
          }
          debug('No content found yet, continuing to check...');
          setTimeout(checkCompletion, 500);
          return;
        }
        
        // If text is still growing, keep waiting
        if (currentLength !== lastResponseLength) {
          if (currentLength > lastResponseLength) {
            debug(`Response still growing: ${lastResponseLength} → ${currentLength} chars`);
          } else {
            debug(`Response length changed: ${lastResponseLength} → ${currentLength} chars`);
          }
          lastResponseLength = currentLength;
          stableCount = 0;
          setTimeout(checkCompletion, 500);
          return;
        }
        
        // Text has stopped growing, check if it's stable
        stableCount++;
        debug(`Response stable for ${stableCount} checks (${currentLength} chars)`);
        
        // Consider the response complete after it's been stable for several checks
        if (stableCount >= 5) {  // Increased from 3 to 5 for more stability
          debug('Response is complete and stable');
          
          // Try to click the copy button if available
          try {
            const copyButton = querySelector(SELECTORS.copyButton);
            if (copyButton) {
              debug('Found copy button, clicking it');
              copyButton.scrollIntoView({ behavior: 'auto' });
              await new Promise(resolve => setTimeout(resolve, 300));
              copyButton.click();
              debug('Clicked copy button');
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              debug('No copy button found');
            }
          } catch (e) {
            debug('Error handling copy button:', e);
          }
          
          debug(`Final response length: ${currentText.length} chars`);
          debug(`Response first 30 chars: "${currentText.substring(0, 30)}..."`);
          
          resolve(currentText);
          return;
        }
        
        // Continue checking for stability
        setTimeout(checkCompletion, 500);
      } catch (error) {
        console.error('Error checking response completion:', error);
        debug(`Error in checkCompletion: ${error.message}`);
        
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
        
        // Log the current state of the conversation for debugging
        const beforeAssistantMessages = document.querySelectorAll('div[data-message-author-role="assistant"]');
        debug(`⭐ Before processing: ${beforeAssistantMessages.length} assistant messages`);
        
        // Start new chat if requested
        if (request.newConversation) {
          debug('Starting new chat as requested');
          await startNewChat();
          debug('New chat started successfully');
          // Wait longer for UI to settle after starting new chat
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          debug('Continuing in existing conversation');
          // For existing conversations, log the current state
          if (beforeAssistantMessages.length > 0) {
            // Get text from the last assistant message for debugging
            const lastMessage = beforeAssistantMessages[beforeAssistantMessages.length - 1];
            const lastText = lastMessage.innerText || lastMessage.textContent;
            debug(`Last message in existing conversation: "${lastText.substring(0, 30)}..."`);
          }
          // Wait for UI to be ready
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Send the message and get response
        debug('Sending message to ChatGPT...');
        const response = await sendMessage(request.message);
        debug(`Got response: "${response.substring(0, 30)}..."`);
        
        // STEAM DECK SPECIFIC: Force one more check of the latest response
        // Wait a moment for any final DOM updates
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the absolute latest response directly one more time
        const finalResponse = getLatestResponseText();
        
        // If the final response is different and not empty, use it instead
        if (finalResponse !== response && finalResponse.length > 0) {
          debug(`Using updated response from final check: "${finalResponse.substring(0, 30)}..."`);
          sendResponse({ response: finalResponse });
        } else {
          // Send back the original response
          debug(`Using original response: "${response.substring(0, 30)}..."`);
          sendResponse({ response });
        }
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