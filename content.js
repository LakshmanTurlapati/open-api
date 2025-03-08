// ChatGPT DOM selectors - updated for the latest ChatGPT interface May 2024
const SELECTORS = {
  chatInput: [
    'div[role="textbox"][contenteditable="true"]',
    'textarea[data-id]',
    'textarea[placeholder="Message ChatGPT…"]',
    'textarea[class*="text-input"]',
    'div[contenteditable="true"]',
    'textarea'
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button form[role="form"] + button',
    'textarea[data-id] ~ button',
    'button[class*="send"]',
    'button svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]'
  ],
  newChatButton: [
    'a[data-testid="navigation-new-chat"]',
    'nav a.flex',
    'button[class*="new-chat"]',
    'a.rounded[href="/"]'
  ],
  responseElement: [
    '.markdown',
    'div[data-message-author-role="assistant"]',
    '.agent-turn',
    'div[data-message-author-role="assistant"] .markdown'
  ],
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
    inputElement.innerHTML = '';
    inputElement.focus();
    document.execCommand('insertText', false, message);
    inputElement.textContent = message;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    inputElement.value = '';
    inputElement.focus();
    inputElement.value = message;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Function to get text from the latest assistant message
function getLatestResponseText() {
  debug('Getting latest response text');
  
  try {
    const allAssistantMessages = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"]'));
    debug(`Found ${allAssistantMessages.length} total assistant messages`);
    
    if (allAssistantMessages.length > 0) {
      const lastMessage = allAssistantMessages[allAssistantMessages.length - 1];
      const messageId = lastMessage.getAttribute('data-message-id') || 'unknown';
      debug(`Last message ID: ${messageId}`);
      
      const markdown = lastMessage.querySelector('.markdown');
      const text = markdown ? (markdown.innerText || markdown.textContent) : (lastMessage.innerText || lastMessage.textContent);
      debug(`Got text: ${text.length} chars, First 30: "${text.substring(0, 30)}..."`);
      return text;
    }
    
    debug('No assistant messages found');
    return '';
  } catch (error) {
    console.error('Error in getLatestResponseText:', error);
    debug(`Error: ${error.message}`);
    return '';
  }
}

// Global variables to track the latest assistant response and mutation time
let lastAssistantResponse = '';
let lastUserQuery = '';
let isWaitingForResponse = false;
let lastMutationTime = 0; // Tracks last DOM mutation in assistant message

// Create a MutationObserver to watch for new assistant messages
const createResponseObserver = () => {
  debug('Setting up DOM mutation observer for responses...');
  
  const handleMutations = (mutations) => {
    if (!isWaitingForResponse) return;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const assistantMessage = node.getAttribute && node.getAttribute('data-message-author-role') === 'assistant'
              ? node
              : node.querySelector && node.querySelector('[data-message-author-role="assistant"]');
            
            if (assistantMessage) {
              debug('⭐ NEW ASSISTANT MESSAGE DETECTED');
              const markdown = assistantMessage.querySelector('.markdown');
              const content = markdown || assistantMessage;
              const text = content.innerText || content.textContent;
              
              if (text && text.length > 0) {
                lastAssistantResponse = text;
                lastMutationTime = Date.now();
                debug(`📝 Saved response (${text.length} chars): "${text.substring(0, 30)}..."`);
              }
            }
          }
        }
      }
      
      if (mutation.type === 'characterData') {
        const node = mutation.target;
        if (node.parentElement) {
          let current = node.parentElement;
          let found = false;
          
          while (current && !found) {
            if (current.getAttribute && current.getAttribute('data-message-author-role') === 'assistant') {
              found = true;
              const text = current.innerText || current.textContent;
              if (text && text.length > 0 && text !== lastAssistantResponse) {
                lastAssistantResponse = text;
                lastMutationTime = Date.now();
                debug(`📝 Updated response (${text.length} chars): "${text.substring(0, 30)}..."`);
              }
            }
            current = current.parentElement;
          }
        }
      }
    }
  };
  
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true
  });
  
  debug('DOM mutation observer set up');
  return observer;
};

// Initialize the observer
let responseObserver = createResponseObserver();

// Send message function
async function sendMessage(message) {
  try {
    debug(`💬 Sending message: "${message.substring(0, 30)}..."`);
    
    lastUserQuery = message;
    lastAssistantResponse = '';
    isWaitingForResponse = true;
    lastMutationTime = 0;
    
    const beforeCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`Before sending: ${beforeCount} assistant messages`);
    
    const inputElement = await waitForElement(SELECTORS.chatInput);
    if (!inputElement) throw new Error('Cannot find input element');
    
    debug('Found input element, setting value...');
    await setInputValue(inputElement, message);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const sendButton = await waitForElement(SELECTORS.sendButton);
    if (!isElementReady(sendButton)) throw new Error('Send button is not clickable');
    
    debug('Clicking send button...');
    sendButton.click();
    
    debug('Waiting for response...');
    const response = await waitForResponseComplete();
    
    isWaitingForResponse = false;
    
    const afterCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
    debug(`After sending: ${afterCount} assistant messages (${afterCount - beforeCount} new)`);
    
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    isWaitingForResponse = false;
    throw error;
  }
}

// Updated waitForResponseComplete function
async function waitForResponseComplete(timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let noLoadingStart = null;
    
    const checkCompletion = () => {
      try {
        const loadingIndicator = querySelector(SELECTORS.loadingIndicator);
        const timeSinceLastMutation = Date.now() - lastMutationTime;
        
        if (loadingIndicator) {
          noLoadingStart = null;
        } else {
          if (noLoadingStart === null) noLoadingStart = Date.now();
          
          const timeSinceNoLoading = Date.now() - noLoadingStart;
          
          if (timeSinceNoLoading >= 5000 && timeSinceLastMutation >= 5000) {
            const response = lastAssistantResponse || getLatestResponseText();
            debug(`Response complete! (${response.length} chars)`);
            resolve(response);
            return;
          }
        }
        
        if (Date.now() - startTime >= timeout) {
          isWaitingForResponse = false;
          reject(new Error('Timeout waiting for ChatGPT response'));
          return;
        }
        
        setTimeout(checkCompletion, 500);
      } catch (error) {
        console.error('Error checking completion:', error);
        if (Date.now() - startTime >= timeout) {
          isWaitingForResponse = false;
          reject(error);
        } else {
          setTimeout(checkCompletion, 1000);
        }
      }
    };
    
    checkCompletion();
  });
}

// Message listener
chrome.runtime.onMessage.removeListener(() => {});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debug('Received message:', request);
  
  if (request.action === 'sendMessage') {
    (async () => {
      try {
        debug(`📩 Processing: "${request.message.substring(0, 30)}...", New: ${request.newConversation}`);
        
        if (request.newConversation) {
          await startNewChat();
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          debug('Continuing conversation');
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          debug(`Current messages: ${assistantMessages.length}`);
        }
        
        if (!responseObserver) responseObserver = createResponseObserver();
        
        const response = await sendMessage(request.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const finalResponse = lastAssistantResponse || response;
        debug(`🎯 Final response (${finalResponse.length} chars): "${finalResponse.substring(0, 30)}..."`);
        sendResponse({ response: finalResponse });
      } catch (error) {
        console.error('Error:', error);
        sendResponse({ error: error.message || 'Unknown error' });
      }
    })();
    return true;
  } else if (request.action === 'ping') {
    debug('Ping received');
    sendResponse({ status: 'pong', url: window.location.href });
    return true;
  } else if (request.action === 'keepAlive') {
    debug('KeepAlive received');
    sendResponse({ status: 'alive' });
    return true;
  }
});

// Initial setup
(() => {
  const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  debug(`Found ${assistantMessages.length} messages on load`);
  
  if (assistantMessages.length > 0) {
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const text = lastMsg.innerText || lastMsg.textContent;
    lastAssistantResponse = text;
    debug(`Initial response: "${text.substring(0, 30)}..."`);
  }
})();

debug('Script loaded!');
debug('URL:', window.location.href);
debug('User Agent:', navigator.userAgent);
debug('Window:', window.innerWidth, 'x', window.innerHeight);

if (window.location.href.includes('chat.openai.com') || window.location.href.includes('chatgpt.com')) {
  debug('On ChatGPT page');
} else {
  debug('WARNING: Not on ChatGPT page:', window.location.href);
}
