// server.js - Simple server to bridge external requests to the extension
/*
 * To expose this server externally using ngrok:
 * 1. Ensure ngrok is installed on your system (download from https://ngrok.com/download or install via npm: `npm install -g ngrok`).
 * 2. Start this server by running: `node server.js`
 * 3. In another terminal, run: `ngrok http 3000` (replace 3000 with your port if different).
 * 4. Ngrok will display a public URL, e.g., `https://abc123.ngrok.io`.
 * 5. External clients can access the API via `https://abc123.ngrok.io/api/query` using the same JSON format.
 * 6. The Chrome extension should connect to `http://localhost:3000` for /register, /poll, and /response endpoints.
 * Note: Ensure the server port matches the port used in the ngrok command.
 */
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Configure timeout for requests (in milliseconds)
const TIMEOUT = 180000; // 3 minutes

// Middleware setup
app.use(cors()); // Enable CORS for all routes (restrict in production)
app.use(bodyParser.json()); // Parse JSON request bodies

// Store active extensions and their data
const activeExtensions = new Map();

// Utility function for timestamped logging
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// **Registration Endpoint**: Allows extensions to register with the server
app.post('/register', (req, res) => {
  const { extensionId, apiKey } = req.body;

  // Validate required fields
  if (!extensionId || !apiKey) {
    logWithTimestamp(`Registration failed: Missing extensionId or apiKey`);
    return res.status(400).json({ error: 'Missing extensionId or apiKey' });
  }

  let extension = activeExtensions.get(apiKey);
  if (!extension) {
    // Initialize new extension if it doesn't exist
    extension = {
      extensionId,
      lastSeen: Date.now(),
      pending: new Map(), // Queue for pending requests
      responses: new Map(), // Store for responses from extension
    };
    activeExtensions.set(apiKey, extension);
  } else {
    // Update existing extension
    extension.extensionId = extensionId;
    extension.lastSeen = Date.now();
    // Preserve existing pending and responses maps
  }

  logWithTimestamp(`Extension ${extensionId} registered with API key ${apiKey.substring(0, 8)}...`);
  res.json({ success: true });
});

// **Polling Endpoint**: Extensions check for pending requests
app.get('/poll/:apiKey', (req, res) => {
  const { apiKey } = req.params;
  const extension = activeExtensions.get(apiKey);

  // Check if extension is registered
  if (!extension) {
    logWithTimestamp(`Poll attempt with unknown API key: ${apiKey.substring(0, 8)}...`);
    return res.status(404).json({ error: 'Extension not found' });
  }

  // Log polling activity for debugging
  logWithTimestamp(`Extension ${extension.extensionId} polled with API key ${apiKey.substring(0, 8)}...`);
  extension.lastSeen = Date.now();

  // Send first pending request if available
  const pendingKeys = [...extension.pending.keys()];
  if (pendingKeys.length > 0) {
    const requestId = pendingKeys[0];
    const request = extension.pending.get(requestId);
    extension.pending.delete(requestId);

    logWithTimestamp(`Sent request ${requestId} to extension ${extension.extensionId}`);
    return res.json({
      requestId,
      action: request.action,
      message: request.message,
      newConversation: request.newConversation,
    });
  }

  // No requests pending
  return res.json({ waiting: true });
});

// **Response Endpoint**: Extensions submit responses to requests
app.post('/response/:apiKey/:requestId', (req, res) => {
  const { apiKey, requestId } = req.params;
  const { response, error } = req.body;

  const extension = activeExtensions.get(apiKey);
  if (!extension) {
    logWithTimestamp(`Response submission failed for request ${requestId}: Extension not found`);
    return res.status(404).json({ error: 'Extension not found' });
  }

  // Ensure responses map exists
  if (!extension.responses) {
    extension.responses = new Map();
  }

  // Store response or error
  extension.responses.set(requestId, {
    response,
    error,
    timestamp: Date.now(),
  });

  logWithTimestamp(`Received response for request ${requestId}`);
  res.json({ success: true });
});

// **Query Endpoint**: External clients send queries to the extension
app.post('/api/query', async (req, res) => {
  const { apiKey, message, newConversation } = req.body;

  // Validate request
  if (!apiKey || !message) {
    logWithTimestamp(`Query failed: Missing apiKey or message`);
    return res.status(400).json({ error: 'Missing apiKey or message' });
  }

  const extension = activeExtensions.get(apiKey);
  if (!extension) {
    logWithTimestamp(`Query failed: Extension not found with API key ${apiKey.substring(0, 8)}...`);
    return res.status(404).json({ error: 'Extension not found with this API key' });
  }

  // Check extension activity (timeout after 2 minutes of inactivity)
  if (Date.now() - extension.lastSeen > 120000) {
    activeExtensions.delete(apiKey);
    logWithTimestamp(`Extension timed out for API key ${apiKey.substring(0, 8)}...`);
    return res.status(404).json({ error: 'Extension connection timed out' });
  }

  // Generate unique request ID
  const requestId = `${Date.now()}${Math.random().toString(36).substring(2, 15)}`;

  // Queue the request
  extension.pending.set(requestId, {
    action: 'query',
    message,
    newConversation: newConversation || false,
    timestamp: Date.now(),
  });

  logWithTimestamp(`Added request ${requestId} to queue for ${apiKey.substring(0, 8)}...`);

  // Wait for response with timeout
  const checkInterval = 500; // Check every 500ms
  const maxAttempts = Math.ceil(TIMEOUT / checkInterval);
  let attempts = 0;

  try {
    while (attempts < maxAttempts) {
      if (extension.responses?.has(requestId)) {
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

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      attempts++;

      // Log progress every 10 seconds
      if (attempts % 20 === 0) {
        logWithTimestamp(`Still waiting for response to request ${requestId} (${(attempts * checkInterval) / 1000}s elapsed)`);
      }
    }

    // Handle timeout
    extension.pending.delete(requestId);
    logWithTimestamp(`Request ${requestId} timed out after ${TIMEOUT / 1000} seconds`);
    return res.status(504).json({
      error: 'Request timed out waiting for extension response',
      timestamp: Date.now(),
    });
  } catch (error) {
    logWithTimestamp(`Error processing request ${requestId}: ${error.message}`);
    extension.pending.delete(requestId);
    return res.status(500).json({
      error: `Server error: ${error.message}`,
      timestamp: Date.now(),
    });
  }
});

// **Status Endpoint**: Check the status of an extension
app.get('/api/status/:apiKey', (req, res) => {
  const { apiKey } = req.params;
  const extension = activeExtensions.get(apiKey);

  if (!extension) {
    return res.json({ active: false });
  }

  // Check if extension is active (last seen within 2 minutes)
  const isActive = Date.now() - extension.lastSeen < 120000;
  if (!isActive) {
    activeExtensions.delete(apiKey);
    logWithTimestamp(`Extension status: Inactive, removed API key ${apiKey.substring(0, 8)}...`);
  }

  return res.json({
    active: isActive,
    extensionId: extension.extensionId,
    lastSeen: new Date(extension.lastSeen).toISOString(),
    pendingRequests: extension.pending?.size || 0,
  });
});

// **Health Check Endpoint**: Basic server health status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeExtensions: activeExtensions.size,
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(port, () => {
  logWithTimestamp(`OpenAPI server running on port ${port}`);
});