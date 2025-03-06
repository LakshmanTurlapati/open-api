// server.js - Simple server to bridge external requests to the extension
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Configure timeout for requests
const TIMEOUT = 180000; // 3 minutes

// Enable CORS for all routes
app.use(cors());
app.use(bodyParser.json());

// Store active connections
const activeExtensions = new Map();

// Debug logging
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Endpoint for extensions to register themselves
app.post('/register', (req, res) => {
  const { extensionId, apiKey } = req.body;
  
  if (!extensionId || !apiKey) {
    return res.status(400).json({ error: 'Missing extensionId or apiKey' });
  }
  
  // Store the extension connection details
  activeExtensions.set(apiKey, {
    extensionId,
    lastSeen: Date.now(),
    pending: new Map(), // Store pending requests
    responses: new Map(), // Store responses
  });
  
  logWithTimestamp(`Extension ${extensionId} registered with API key ${apiKey.substring(0, 8)}...`);
  res.json({ success: true });
});

// Endpoint for extensions to poll for requests
app.get('/poll/:apiKey', (req, res) => {
  const { apiKey } = req.params;
  const extension = activeExtensions.get(apiKey);
  
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found' });
  }
  
  // Update last seen timestamp
  extension.lastSeen = Date.now();
  
  // Check for pending requests
  const pendingKeys = [...extension.pending.keys()];
  if (pendingKeys.length > 0) {
    const requestId = pendingKeys[0];
    const request = extension.pending.get(requestId);
    extension.pending.delete(requestId);
    
    return res.json({
      requestId,
      action: request.action,
      message: request.message,
      newConversation: request.newConversation
    });
  }
  
  // No pending requests
  return res.json({ waiting: true });
});

// Endpoint for extensions to submit responses
app.post('/response/:apiKey/:requestId', (req, res) => {
  const { apiKey, requestId } = req.params;
  const { response, error } = req.body;
  
  const extension = activeExtensions.get(apiKey);
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found' });
  }
  
  // Store the response
  if (!extension.responses) {
    extension.responses = new Map();
  }
  
  extension.responses.set(requestId, { 
    response, 
    error, 
    timestamp: Date.now() 
  });
  
  logWithTimestamp(`Received response for request ${requestId}`);
  
  res.json({ success: true });
});

// API endpoint for external clients to query ChatGPT
app.post('/api/query', async (req, res) => {
  const { apiKey, message, newConversation } = req.body;
  
  if (!apiKey || !message) {
    return res.status(400).json({ error: 'Missing apiKey or message' });
  }
  
  const extension = activeExtensions.get(apiKey);
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found with this API key' });
  }
  
  // Check if extension is still active (last seen within 2 minutes)
  if (Date.now() - extension.lastSeen > 120000) {
    activeExtensions.delete(apiKey);
    return res.status(404).json({ error: 'Extension connection timed out' });
  }
  
  // Generate a request ID
  const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 15);
  
  // Store the request
  extension.pending.set(requestId, {
    action: 'query',
    message,
    newConversation: newConversation || false,
    timestamp: Date.now()
  });
  
  logWithTimestamp(`Added request ${requestId} to queue for ${apiKey.substring(0, 8)}...`);
  
  // Wait for the response with a timeout
  let attempts = 0;
  const checkInterval = 500; // Check every 500ms
  const maxAttempts = Math.ceil(TIMEOUT / checkInterval); // Calculate based on timeout
  
  try {
    while (attempts < maxAttempts) {
      if (extension.responses && extension.responses.has(requestId)) {
        const response = extension.responses.get(requestId);
        extension.responses.delete(requestId);
        
        // Log response details
        if (response.error) {
          logWithTimestamp(`Error response for ${requestId}: ${response.error}`);
        } else {
          logWithTimestamp(`Success response for ${requestId}: ${response.response ? response.response.substring(0, 30) + '...' : 'empty'}`);
        }
        
        return res.json(response);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      attempts++;
      
      // Log a waiting message every 10 seconds
      if (attempts % 20 === 0) {
        logWithTimestamp(`Still waiting for response to request ${requestId} (${(attempts * checkInterval) / 1000}s elapsed)`);
      }
    }
    
    // Timeout - remove the pending request
    extension.pending.delete(requestId);
    logWithTimestamp(`Request ${requestId} timed out after ${TIMEOUT/1000} seconds`);
    return res.status(504).json({ 
      error: 'Request timed out waiting for extension response',
      timestamp: Date.now() 
    });
  } catch (error) {
    logWithTimestamp(`Error processing request ${requestId}: ${error.message}`);
    extension.pending.delete(requestId);
    return res.status(500).json({ 
      error: `Server error: ${error.message}`, 
      timestamp: Date.now() 
    });
  }
});

// API endpoint to check extension status
app.get('/api/status/:apiKey', (req, res) => {
  const { apiKey } = req.params;
  const extension = activeExtensions.get(apiKey);
  
  if (!extension) {
    return res.json({ active: false });
  }
  
  // Check if extension is still active (last seen within 2 minutes)
  const isActive = (Date.now() - extension.lastSeen) < 120000;
  
  if (!isActive) {
    activeExtensions.delete(apiKey);
  }
  
  return res.json({
    active: isActive,
    extensionId: extension.extensionId,
    lastSeen: new Date(extension.lastSeen).toISOString(),
    pendingRequests: extension.pending ? extension.pending.size : 0
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeExtensions: activeExtensions.size,
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, () => {
  logWithTimestamp(`OpenAPI server running on port ${port}`);
}); 