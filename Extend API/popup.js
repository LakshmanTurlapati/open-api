// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const serverIndicator = document.getElementById('server-indicator');
  const serverStatus = document.getElementById('server-status');
  const apiKeyElement = document.getElementById('api-key');
  const serverUrlInput = document.getElementById('server-url');
  const saveServerButton = document.getElementById('save-server');
  const openChatGPTButton = document.getElementById('open-chatgpt');
  const copyKeyButton = document.getElementById('copy-key');
  const regenerateKeyButton = document.getElementById('regenerate-key');
  const manualPollButton = document.getElementById('manual-poll');
  
  // Tab activation elements
  const tabActivationToggle = document.getElementById('tab-activation-toggle');
  const activationIntervalInput = document.getElementById('activation-interval');
  const saveActivationButton = document.getElementById('save-activation');
  
  // Create reset button if it doesn't exist
  let resetChatGPTButton = document.getElementById('reset-chatgpt');
  if (!resetChatGPTButton) {
    // Find the parent of the openChatGPTButton
    const parent = openChatGPTButton.parentElement;
    
    // Create the reset button
    resetChatGPTButton = document.createElement('button');
    resetChatGPTButton.id = 'reset-chatgpt';
    resetChatGPTButton.textContent = 'Reset ChatGPT Connection';
    resetChatGPTButton.style.marginTop = '5px';
    resetChatGPTButton.style.backgroundColor = '#ff6b6b';
    
    // Insert the button after the openChatGPTButton
    parent.insertBefore(resetChatGPTButton, openChatGPTButton.nextSibling);
    
    // Add click event listener
    resetChatGPTButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to reset the ChatGPT tab connection?')) {
        statusText.textContent = 'Resetting ChatGPT connection...';
        chrome.runtime.sendMessage({ action: 'resetChatGPTTab' }, function(response) {
          if (response && response.success) {
            statusIndicator.classList.remove('connected');
            if (response.foundExistingTab) {
              statusText.textContent = `Found existing ChatGPT tab (ID: ${response.tabId}). Testing connection...`;
              setTimeout(checkChatGPTStatus, 1000);
            } else {
              statusText.textContent = 'ChatGPT tab connection reset. Please open a new tab.';
            }
          }
        });
      }
    });
  }
  
  // Create force script injection button if it doesn't exist
  let forceScriptButton = document.getElementById('force-script');
  if (!forceScriptButton) {
    // Find the parent
    const parent = resetChatGPTButton.parentElement;
    
    // Create the force script button
    forceScriptButton = document.createElement('button');
    forceScriptButton.id = 'force-script';
    forceScriptButton.textContent = 'Force Script Injection';
    forceScriptButton.style.marginTop = '5px';
    forceScriptButton.style.backgroundColor = '#ff9800';
    
    // Insert the button after the reset button
    parent.insertBefore(forceScriptButton, resetChatGPTButton.nextSibling);
    
    // Add click event listener
    forceScriptButton.addEventListener('click', function() {
      statusText.textContent = 'Forcing content script injection...';
      chrome.runtime.sendMessage({ action: 'forceInjectContentScript' }, function(response) {
        if (response && response.success) {
          statusText.textContent = `Script injection requested for tab ${response.tabId}. Testing...`;
          setTimeout(checkChatGPTStatus, 1000);
        } else {
          statusText.textContent = `Script injection failed: ${response.error || 'Unknown error'}`;
        }
      });
    });
  }
  
  // Create debug section if it doesn't exist
  let debugSection = document.querySelector('.debug-section');
  if (!debugSection) {
    const container = document.querySelector('.container');
    debugSection = document.createElement('div');
    debugSection.className = 'debug-section';
    debugSection.style.marginTop = '15px';
    debugSection.style.backgroundColor = '#f9f9f9';
    debugSection.style.padding = '10px';
    debugSection.style.borderRadius = '5px';
    debugSection.style.border = '1px solid #ddd';
    
    const debugTitle = document.createElement('h3');
    debugTitle.textContent = 'Debug Information';
    debugTitle.style.fontSize = '14px';
    debugTitle.style.margin = '0 0 10px 0';
    
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.fontFamily = 'monospace';
    debugInfo.style.whiteSpace = 'pre-wrap';
    debugInfo.style.maxHeight = '150px';
    debugInfo.style.overflow = 'auto';
    
    debugSection.appendChild(debugTitle);
    debugSection.appendChild(debugInfo);
    container.appendChild(debugSection);
  }
  
  // Get the API key
  chrome.runtime.sendMessage({ action: 'getApiKey' }, function(response) {
    if (response && response.apiKey) {
      apiKeyElement.textContent = response.apiKey;
    }
  });
  
  // Get the server URL and status
  updateServerStatus();
  
  // Check for errors
  updateDebugInfo();
  
  // Check ChatGPT connection status
  function checkChatGPTStatus() {
    chrome.runtime.sendMessage({ action: 'getChatGPTStatus' }, function(response) {
      if (response) {
        if (response.chatGPTTabOpen) {
          statusIndicator.classList.add('connected');
          statusText.textContent = 'ChatGPT tab is open';
          
          if (response.tabId) {
            statusText.textContent += ` (Tab ID: ${response.tabId})`;
          }
          
          if (response.pingResponse && response.pingResponse.url) {
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
              debugInfo.textContent += `\nTab URL: ${response.pingResponse.url}`;
            }
          }
        } else {
          statusIndicator.classList.remove('connected');
          statusText.textContent = response.error || 'ChatGPT tab is not open';
          
          // Add detailed debug info
          const debugInfo = document.getElementById('debug-info');
          if (debugInfo && response.debugInfo) {
            const details = JSON.stringify(response.debugInfo, null, 2);
            debugInfo.textContent += `\n\nConnection Details:\n${details}`;
          }
        }
      }
    });
  }
  
  function updateServerStatus() {
    chrome.runtime.sendMessage({ action: 'getServerStatus' }, function(response) {
      if (response && response.serverUrl) {
        serverUrlInput.value = response.serverUrl;
        
        if (response.isRegistered) {
          serverIndicator.classList.add('connected');
          serverStatus.textContent = 'Connected to server';
        } else {
          serverIndicator.classList.remove('connected');
          serverStatus.textContent = 'Not connected to server';
          
          if (response.lastError) {
            serverStatus.textContent += `: ${response.lastError}`;
          }
        }
      }
    });
  }
  
  function updateDebugInfo() {
    chrome.runtime.sendMessage({ action: 'getLastError' }, function(response) {
      const debugInfo = document.getElementById('debug-info');
      if (debugInfo) {
        let debugText = '';
        
        // Get current time
        const now = new Date();
        debugText += `Time: ${now.toLocaleTimeString()}\n\n`;
        
        if (response && response.lastError) {
          debugText += `Last Error: ${response.lastError}\n\n`;
        }
        
        // Add browser information
        debugText += `Browser: ${navigator.userAgent}\n`;
        
        // Add extension ID
        debugText += `Extension ID: ${chrome.runtime.id}\n`;
        
        // Check for open ChatGPT tabs
        chrome.tabs.query({url: "https://chat.openai.com/*"}, function(tabs) {
          if (tabs && tabs.length > 0) {
            debugText += `\nFound ${tabs.length} open ChatGPT tabs:\n`;
            tabs.forEach((tab, index) => {
              debugText += `- Tab ${index+1}: ID ${tab.id}, URL: ${tab.url}\n`;
            });
          } else {
            debugText += `\nNo open ChatGPT tabs found!\n`;
          }
          
          debugInfo.textContent = debugText;
        });
      }
    });
  }
  
  // Initial check
  checkChatGPTStatus();
  
  // Periodic check every 5 seconds
  setInterval(checkChatGPTStatus, 5000);
  setInterval(updateServerStatus, 5000);
  setInterval(updateDebugInfo, 5000);
  
  // Save server URL
  saveServerButton.addEventListener('click', function() {
    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
      alert('Please enter a valid server URL');
      return;
    }
    
    serverStatus.textContent = 'Connecting to server...';
    chrome.runtime.sendMessage({ 
      action: 'setServerUrl',
      serverUrl: serverUrl
    }, function(response) {
      setTimeout(updateServerStatus, 2000);
    });
  });
  
  // Open ChatGPT button
  openChatGPTButton.addEventListener('click', function() {
    statusText.textContent = 'Opening ChatGPT...';
    chrome.runtime.sendMessage({ action: 'openChatGPT' }, function(response) {
      if (response) {
        if (response.success) {
          statusText.textContent = `Opened ChatGPT tab (ID: ${response.tabId}). Checking status...`;
          setTimeout(checkChatGPTStatus, 1000);
        } else if (response.error) {
          statusText.textContent = `Error: ${response.error}`;
        }
      }
    });
  });
  
  // Copy API key button
  copyKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyElement.textContent;
    navigator.clipboard.writeText(apiKey).then(function() {
      const originalText = copyKeyButton.textContent;
      copyKeyButton.textContent = 'Copied!';
      setTimeout(function() {
        copyKeyButton.textContent = originalText;
      }, 2000);
    });
  });
  
  // Regenerate API key button
  regenerateKeyButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to regenerate your API key? This will invalidate any existing integrations.')) {
      chrome.runtime.sendMessage({ action: 'regenerateApiKey' }, function(response) {
        if (response && response.apiKey) {
          apiKeyElement.textContent = response.apiKey;
          
          const originalText = regenerateKeyButton.textContent;
          regenerateKeyButton.textContent = 'Key Regenerated!';
          setTimeout(function() {
            regenerateKeyButton.textContent = originalText;
          }, 2000);
        }
      });
    }
  });
  
  // Load tab activation settings
  chrome.storage.local.get(['isTabActivationEnabled', 'tabActivationInterval'], function(result) {
    if (result.isTabActivationEnabled !== undefined) {
      tabActivationToggle.checked = result.isTabActivationEnabled;
    }
    
    if (result.tabActivationInterval) {
      activationIntervalInput.value = result.tabActivationInterval;
    }
  });
  
  // Handle tab activation toggle
  tabActivationToggle.addEventListener('change', function() {
    const isEnabled = tabActivationToggle.checked;
    const intervalMinutes = parseInt(activationIntervalInput.value, 10) || 5;
    
    chrome.runtime.sendMessage({
      action: 'toggleTabActivation',
      enable: isEnabled,
      intervalMinutes: intervalMinutes
    }, function(response) {
      if (response && response.success) {
        console.log(`Tab activation ${isEnabled ? 'enabled' : 'disabled'}`);
      }
    });
  });
  
  // Handle save activation interval
  saveActivationButton.addEventListener('click', function() {
    const isEnabled = tabActivationToggle.checked;
    const intervalMinutes = parseInt(activationIntervalInput.value, 10) || 5;
    
    chrome.runtime.sendMessage({
      action: 'toggleTabActivation',
      enable: isEnabled,
      intervalMinutes: intervalMinutes
    }, function(response) {
      if (response && response.success) {
        console.log(`Tab activation interval set to ${intervalMinutes} minutes`);
      }
    });
  });
  
  // Handle manual poll button click
  manualPollButton.addEventListener('click', function() {
    serverStatus.textContent = 'Manually polling server...';
    manualPollButton.disabled = true;
    manualPollButton.textContent = 'Refreshing...';
    
    chrome.runtime.sendMessage({ action: 'pollManually' }, function(response) {
      if (response && response.success) {
        if (response.hadRequest) {
          serverStatus.textContent = 'Successfully processed a request!';
        } else {
          serverStatus.textContent = 'Refreshed, no pending requests.';
        }
      } else {
        serverStatus.textContent = 'Failed to refresh: ' + (response?.error || 'Unknown error');
      }
      
      manualPollButton.disabled = false;
      manualPollButton.textContent = 'Manual Refresh';
      
      // Update other status indicators
      updateServerStatus();
    });
  });
}); 