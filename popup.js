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
  
  // Tab activation elements
  const tabActivationToggle = document.getElementById('tab-activation-toggle');
  const activationIntervalInput = document.getElementById('activation-interval');
  const saveActivationButton = document.getElementById('save-activation');
  
  // Additional Configuration collapsible section
  const additionalConfigToggle = document.getElementById('additional-config-toggle');
  const additionalConfigContent = document.getElementById('additional-config-content');
  
  // Handle Additional Configuration toggle
  additionalConfigToggle.addEventListener('click', function() {
    if (additionalConfigContent.style.display === 'block') {
      additionalConfigContent.style.display = 'none';
      additionalConfigToggle.querySelector('span:last-child').textContent = '▼';
    } else {
      additionalConfigContent.style.display = 'block';
      additionalConfigToggle.querySelector('span:last-child').textContent = '▲';
    }
  });
  
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
  
  // Get the API key
  chrome.runtime.sendMessage({ action: 'getApiKey' }, function(response) {
    if (response && response.apiKey) {
      apiKeyElement.textContent = response.apiKey;
    }
  });
  
  // Get the server URL and status
  updateServerStatus();
  
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
        } else {
          statusIndicator.classList.remove('connected');
          statusText.textContent = response.error || 'ChatGPT tab is not open';
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
  
  // Initial check
  checkChatGPTStatus();
  
  // Periodic check every 5 seconds
  setInterval(checkChatGPTStatus, 5000);
  setInterval(updateServerStatus, 5000);
  
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
    
    if (isEnabled) {
      // Show warning about potential interference
      if (confirm('Warning: Tab Activation may interfere with the extension\'s normal operation. Only use this if necessary.\n\nAre you sure you want to enable it?')) {
        const intervalMinutes = parseInt(activationIntervalInput.value, 10) || 5;
        
        chrome.runtime.sendMessage({
          action: 'toggleTabActivation',
          enable: true,
          intervalMinutes: intervalMinutes
        }, function(response) {
          if (response && response.success) {
            console.log(`Tab activation enabled with interval ${intervalMinutes} minutes`);
          }
        });
      } else {
        // If they cancel, revert the toggle
        tabActivationToggle.checked = false;
      }
    } else {
      // Disable tab activation
      chrome.runtime.sendMessage({
        action: 'toggleTabActivation',
        enable: false
      }, function(response) {
        if (response && response.success) {
          console.log('Tab activation disabled');
        }
      });
    }
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
}); 