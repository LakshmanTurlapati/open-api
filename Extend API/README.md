# OpenAPI

A Chrome extension and server combination that creates a bridge between your applications and your premium ChatGPT account, allowing you to use your subscription through an unofficial API.

## How It Works

This system consists of two parts:

1. **Chrome Extension**: Interacts with the ChatGPT web interface in your browser
2. **Node.js Server**: Provides a REST API that external applications can connect to

Together, they allow you to:
- Send messages to ChatGPT from any application using HTTP requests
- Receive responses as if you were using an official API
- Use your premium ChatGPT subscription programmatically

## Installation

### Chrome Extension

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the directory containing this extension
5. The extension will be installed and a new icon will appear in your toolbar

### Node.js Server

1. Make sure you have Node.js installed (v14 or later)
2. Install the required dependencies:

```bash
npm install express body-parser cors
```

3. Start the server:

```bash
node server.js
```

By default, the server runs on port 3000. You can change this by setting the PORT environment variable.

## Setup

1. Click on the extension icon to open the popup
2. Click "Open ChatGPT Tab" to open a ChatGPT session (you'll need to log in if you haven't already)
3. In the extension popup, enter the URL of your Node.js server (default: `http://localhost:3000`)
4. Click "Save" to connect the extension to the server
5. Once connected, copy your unique API key from the popup

## Using the API

Send HTTP POST requests to your server:

```
POST http://localhost:3000/api/query
```

Request body:

```json
{
  "apiKey": "YOUR_API_KEY",
  "message": "Hello, ChatGPT!",
  "newConversation": true
}
```

Parameters:
- `apiKey` (string, required): Your unique API key
- `message` (string, required): The message to send to ChatGPT
- `newConversation` (boolean, optional): Whether to start a new conversation (default: false)

Response:

```json
{
  "response": "The response text from ChatGPT",
  "error": null
}
```

## Checking Extension Status

```
GET http://localhost:3000/api/status/YOUR_API_KEY
```

Response:

```json
{
  "active": true,
  "extensionId": "abcdefghijklmnopqrstuvwxyz",
  "lastSeen": "2023-03-07T12:34:56.789Z"
}
```

## Testing with Postman

1. Open Postman and create a new request
2. Set the method to POST
3. Enter the URL: `http://localhost:3000/api/query`
4. Set the body type to JSON
5. Enter the request body as shown above
6. Click Send to test the API

## Security Considerations

- This extension generates a unique API key for you to protect your ChatGPT access
- The API key is stored locally and only shared with the server you specify
- Only applications that have your API key can access your ChatGPT account through this bridge
- All communications between components should be over HTTPS in production environments

## Limitations

- ChatGPT must remain open in a browser tab while using this API
- The extension relies on the DOM structure of ChatGPT's web interface, which may change over time
- This is an unofficial method and may stop working if OpenAI changes their web interface

### Tab Activation Feature

To help keep the ChatGPT tab active, the extension includes an optional "Tab Activation" feature:

1. This feature periodically brings the ChatGPT tab to the foreground to keep it active
2. You can enable/disable this feature from the extension popup
3. You can configure how often the tab is activated (in minutes)

**Note:** This feature is not recommended for regular use as it can disrupt your workflow by switching tabs unexpectedly. Use it only when necessary.

## Deployment

For production use, you should deploy the Node.js server to a secure environment with HTTPS enabled.

### Server Security Tips

1. Use HTTPS for all communications
2. Restrict API access using additional authentication
3. Consider implementing rate limiting
4. Deploy behind a reverse proxy like Nginx

## Disclaimer

This extension is provided for educational purposes only. Using it may violate OpenAI's terms of service. Use at your own risk.
