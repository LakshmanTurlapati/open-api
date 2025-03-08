// service-worker.js
// This script handles API requests from external applications

// Listen for requests to the extension
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.method === 'POST') {
      // Extract the request body
      const decoder = new TextDecoder('utf-8');
      const requestBody = decoder.decode(details.requestBody.raw[0].bytes);
      
      try {
        const request = JSON.parse(requestBody);
        
        // Process the API request
        processApiRequest(request, function(response) {
          // Send the response back
          return { redirectUrl: `data:application/json,${JSON.stringify(response)}` };
        });
        
        // Indicate that we'll handle the response
        return { cancel: true };
      } catch (error) {
        return { 
          redirectUrl: `data:application/json,${JSON.stringify({ 
            error: 'Invalid request format' 
          })}` 
        };
      }
    }
    return { cancel: false };
  },
  { urls: [`chrome-extension://${chrome.runtime.id}/*`] },
  ['blocking', 'requestBody']
);

// Function to process API requests
function processApiRequest(request, callback) {
  // Validate the API key
  chrome.storage.local.get('apiKey', function(result) {
    if (request.apiKey !== result.apiKey) {
      callback({ error: 'Invalid API key' });
      return;
    }
    
    // Handle different API actions
    if (request.action === 'query') {
      // Forward the query to the background script
      chrome.runtime.sendMessage({
        action: 'query',
        message: request.message,
        newConversation: request.newConversation || false
      }, function(response) {
        callback(response);
      });
    } else if (request.action === 'status') {
      // Get the status
      chrome.runtime.sendMessage({ action: 'getChatGPTStatus' }, function(response) {
        callback({
          status: 'ok',
          chatGPTTabOpen: response.chatGPTTabOpen
        });
      });
    } else {
      callback({ error: 'Invalid action' });
    }
  });
} 