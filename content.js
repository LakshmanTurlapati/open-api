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

// Function to get text from the latest assistant message - updated for 2024 ChatGPT DOM structure
function getLatestResponseText() {
  debug('Getting latest response text');
  
  // Method 1: Find the most recent assistant message based on the latest chatgpt.com DOM structure
  // Look specifically for the last assistant message container in the current thread
  const assistantContainers = document.querySelectorAll('div[data-message-author-role="assistant"]');
  if (assistantContainers && assistantContainers.length > 0) {
    debug(`Found ${assistantContainers.length} assistant message containers`);
    
    // Get the last container which should have the most recent response
    const lastContainer = assistantContainers[assistantContainers.length - 1];
    
    // Try to find the markdown content inside the container
    const markdownContent = lastContainer.querySelector('.markdown');
    if (markdownContent) {
      const text = markdownContent.innerText || markdownContent.textContent;
      debug(`Got latest response from markdown container: ${text.length} chars`);
      return text;
    }
    
    // If no markdown content, get the text directly from the container
    const text = lastContainer.innerText || lastContainer.textContent;
    debug(`Got latest response from assistant container: ${text.length} chars`);
    return text;
  }
  
  // Method 2: Try to find the message by its position in the DOM - last message in the thread
  const messageElements = document.querySelectorAll('div[data-message-id]');
  if (messageElements && messageElements.length > 0) {
    // Get messages from the end, looking for the last assistant message
    for (let i = messageElements.length - 1; i >= 0; i--) {
      const element = messageElements[i];
      if (element.getAttribute('data-message-author-role') === 'assistant') {
        const text = element.innerText || element.textContent;
        debug(`Got latest response from message element: ${text.length} chars`);
        return text;
      }
    }
  }
  
  // Method 3: Try to find the last message content by specific class patterns
  // These selectors target various versions of the ChatGPT interface
  const possibleSelectors = [
    '.result-streaming:last-child',
    '.agent-turn:last-child',
    'div.empty\\:hidden:last-child',
    'div.chat-message:last-child',
    'div.chat-message-container:last-child .chat-message',
    'div[class*="message-content"]:last-child'
  ];
  
  for (const selector of possibleSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.innerText || element.textContent;
        if (text && text.trim().length > 0) {
          debug(`Got latest response using selector ${selector}: ${text.length} chars`);
          return text;
        }
      }
    } catch (error) {
      debug(`Error with selector ${selector}: ${error.message}`);
    }
  }
  
  // If all else fails, try to get text from any markdown container
  const allMarkdownContainers = document.querySelectorAll('.markdown');
  if (allMarkdownContainers && allMarkdownContainers.length > 0) {
    const lastMarkdown = allMarkdownContainers[allMarkdownContainers.length - 1];
    const text = lastMarkdown.innerText || lastMarkdown.textContent;
    debug(`Got response from last markdown element: ${text.length} chars`);
    return text;
  }
  
  debug('Could not find any response text using any method');
  return '';
}

// Sends a message to ChatGPT
async function sendMessage(message) {
  try {
    debug(`Preparing to send message: "${message.substring(0, 30)}..."`);
    
    // Take a snapshot of existing messages before sending
    const beforeAssistantContainers = document.querySelectorAll('div[data-message-author-role="assistant"]');
    const beforeCount = beforeAssistantContainers.length;
    debug(`Number of assistant messages before sending: ${beforeCount}`);
    
    // Store an array of existing message IDs to compare later
    const beforeMessageIds = Array.from(
      document.querySelectorAll('div[data-message-id]')
    ).map(el => el.getAttribute('data-message-id'));
    debug(`Collected ${beforeMessageIds.length} message IDs before sending`);
    
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
    const response = await waitForResponseComplete();
    
    // Take a snapshot after receiving a response
    const afterAssistantContainers = document.querySelectorAll('div[data-message-author-role="assistant"]');
    const afterCount = afterAssistantContainers.length;
    debug(`Number of assistant messages after response: ${afterCount}`);
    
    // Compare message IDs to find new messages
    const afterMessageIds = Array.from(
      document.querySelectorAll('div[data-message-id]')
    ).map(el => el.getAttribute('data-message-id'));
    
    const newMessageIds = afterMessageIds.filter(id => !beforeMessageIds.includes(id));
    debug(`Found ${newMessageIds.length} new message IDs after response`);
    
    // If we can directly identify the new message, get its text
    if (newMessageIds.length > 0) {
      const newMessageElements = newMessageIds.map(id => 
        document.querySelector(`div[data-message-id="${id}"][data-message-author-role="assistant"]`)
      ).filter(el => el !== null);
      
      if (newMessageElements.length > 0) {
        // Get the content from the newest assistant message
        const newestMessage = newMessageElements[newMessageElements.length - 1];
        const messageContent = newestMessage.querySelector('.markdown') || newestMessage;
        const directText = messageContent.innerText || messageContent.textContent;
        
        debug(`Got direct text from new message ID: ${directText.length} chars`);
        return directText;
      }
    }
    
    // If we detected a new assistant message
    if (afterCount > beforeCount) {
      debug('New assistant message detected by count comparison');
      // Get the latest assistant container and extract text from it
      const latestContainer = afterAssistantContainers[afterAssistantContainers.length - 1];
      const markdownContent = latestContainer.querySelector('.markdown');
      
      if (markdownContent) {
        const directText = markdownContent.innerText || markdownContent.textContent;
        debug(`Got text directly from latest markdown: ${directText.length} chars`);
        return directText;
      }
      
      const containerText = latestContainer.innerText || latestContainer.textContent;
      debug(`Got text directly from latest container: ${containerText.length} chars`);
      return containerText;
    }
    
    // If no new message was detected, fall back to the general response text
    debug(`Using general response text as fallback: ${response.length} chars`);
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
    
    // Capture the initial state of messages
    const initialAssistantCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
    const initialMessageIds = Array.from(
      document.querySelectorAll('div[data-message-id]')
    ).map(el => el.getAttribute('data-message-id'));
    
    debug(`Initial state: ${initialAssistantCount} assistant messages, ${initialMessageIds.length} total messages`);
    
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
        
        // Check for new messages that weren't present initially
        const currentMessageIds = Array.from(
          document.querySelectorAll('div[data-message-id]')
        ).map(el => el.getAttribute('data-message-id'));
        
        const newMessageIds = currentMessageIds.filter(id => !initialMessageIds.includes(id));
        
        // If we have new message IDs, find the newest assistant message among them
        if (newMessageIds.length > 0) {
          debug(`Found ${newMessageIds.length} new message IDs`);
          
          // Look for assistant messages among the new IDs
          const newAssistantElements = newMessageIds
            .map(id => document.querySelector(`div[data-message-id="${id}"][data-message-author-role="assistant"]`))
            .filter(el => el !== null);
          
          if (newAssistantElements.length > 0) {
            debug(`Found ${newAssistantElements.length} new assistant messages`);
            // Get the newest assistant element
            const newestAssistant = newAssistantElements[newAssistantElements.length - 1];
            
            // Extract the text content
            const markdownContent = newestAssistant.querySelector('.markdown');
            const textElement = markdownContent || newestAssistant;
            const currentText = textElement.innerText || textElement.textContent;
            const currentLength = currentText.length;
            
            debug(`Current text from newest assistant: ${currentLength} chars`);
            
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
                debug('New assistant message is complete and stable');
                resolve(currentText);
                return;
              }
            }
            
            // Still waiting for stability
            setTimeout(checkCompletion, 1000);
            return;
          }
        }
        
        // If no new message IDs found, check if the total number of assistant messages changed
        const currentAssistantCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
        
        if (currentAssistantCount > initialAssistantCount) {
          debug(`Assistant message count increased: ${initialAssistantCount} -> ${currentAssistantCount}`);
          
          // Get the most recent assistant message
          const assistantMessages = document.querySelectorAll('div[data-message-author-role="assistant"]');
          const latestMessage = assistantMessages[assistantMessages.length - 1];
          
          // Extract text from the latest message
          const markdownContent = latestMessage.querySelector('.markdown');
          const textElement = markdownContent || latestMessage;
          const currentText = textElement.innerText || textElement.textContent;
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
              resolve(currentText);
              return;
            }
          }
          
          // Still waiting for stability
          setTimeout(checkCompletion, 1000);
          return;
        }
        
        // Fallback to original method: get current response text
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
        
        // Take a snapshot of the current conversation state
        const beforeMessageIds = Array.from(
          document.querySelectorAll('div[data-message-id]')
        ).map(el => el.getAttribute('data-message-id'));
        
        const beforeAssistantCount = document.querySelectorAll('div[data-message-author-role="assistant"]').length;
        debug(`Initial state: ${beforeAssistantCount} assistant messages, ${beforeMessageIds.length} total messages`);
        
        // Start new chat if requested
        if (request.newConversation) {
          await startNewChat();
          debug('New chat started successfully');
          // Wait a bit more for UI to settle after starting new chat
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          debug('Continuing in existing conversation');
          // For existing conversations, make sure we're ready to capture the latest response
          debug(`Current conversation has ${beforeAssistantCount} assistant messages`);
          
          // Add a small delay to ensure the UI is ready for sending in existing conversation
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Send the message and get response
        const response = await sendMessage(request.message);
        
        // Double-check we got the right response by comparing with the latest state
        const afterMessageIds = Array.from(
          document.querySelectorAll('div[data-message-id]')
        ).map(el => el.getAttribute('data-message-id'));
        
        const newMessageIds = afterMessageIds.filter(id => !beforeMessageIds.includes(id));
        debug(`After sending: Found ${newMessageIds.length} new message IDs`);
        
        // Verify if we have the latest response
        if (newMessageIds.length > 0) {
          debug('New messages detected, verifying response is the latest');
          // Verify received response matches what's in the DOM for the newest message
          const latestResponse = getLatestResponseText();
          
          if (latestResponse !== response && latestResponse.length > 0) {
            debug(`Response mismatch detected!`);
            debug(`Received: ${response.substring(0, 30)}... (${response.length} chars)`);
            debug(`Latest DOM: ${latestResponse.substring(0, 30)}... (${latestResponse.length} chars)`);
            
            // Use the latest response from the DOM as it's more likely to be correct
            debug(`Using latest DOM response instead`);
            sendResponse({ response: latestResponse });
            return;
          }
        }
        
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