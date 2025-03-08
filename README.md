
![Icon](https://github.com/LakshmanTurlapati/open-api/blob/main/Extend%20API/icons/icon128.png?raw=true)

# **OpenAPI Documentation** – *Unleash the Power of ChatGPT*

So you wanna play with the premium ChatGPT API, huh? Well, here’s your chance—without the usual red tape. This Chrome extension and Node.js server combo create the ultimate bridge between your apps and your ChatGPT account. Go ahead, flex that premium subscription like a boss.

## How It Works

This isn’t rocket science, but it is *pretty cool*. You get two main components:

1. **Chrome Extension**: Hangs out with the ChatGPT web interface in your browser.
2. **Node.js Server**: The backbone that lets your external applications talk to ChatGPT like a pro.

Together, they let you:
- Send messages to ChatGPT from **any** app via simple HTTP requests.
- Get responses like you’re using the *real* API.
- Put your premium subscription to work in ways you’ve never imagined.

## Installation

### Chrome Extension

1. Clone or download this repository. Yeah, it’s that easy.
2. Open Chrome and head to `chrome://extensions/`.
3. Flip the switch to "Developer mode" at the top right.
4. Hit "Load unpacked" and select the directory where you stashed this extension.
5. You’ll see a fresh icon in your toolbar, signaling the magic is about to begin.

### Node.js Server

1. Make sure you have **Node.js** installed (v14 or later). If you don't, what are you even doing?
2. Install the dependencies you’ll need:

    ```bash
    npm install express body-parser cors ng-cronk
    ```

3. Start the server like a boss:

    ```bash
    node server.js
    ```

Boom! By default, the server runs on port 3000. Want to change that? Set the `PORT` environment variable and you’re good to go.

---

## **Tunneling Your Local Server with ngrok**

Now, you want your **local server** to be accessible from anywhere on the web, right? That's where **ngrok** comes in. It creates a **secure tunnel** to your local machine, allowing external applications to call your API just like they would with any remote server.

### Steps to Set Up ngrok:

1. **Install ngrok**:
   - Download and install ngrok from [https://ngrok.com/download](https://ngrok.com/download).
   
2. **Start ngrok**:
   - Run the following command in your terminal to create a tunnel to your local Node.js server (assuming it's running on port 3000):

    ```bash
    ngrok http 3000
    ```

3. **Copy the ngrok URL**:
   - Once ngrok is up and running, it will provide you with a public URL, something like `http://<random-string>.ngrok.io`. This URL now acts as a public endpoint for your local server.

4. **Update the Extension**:
   - In the Chrome extension popup, change the URL to your ngrok URL (e.g., `http://<random-string>.ngrok.io`) instead of `http://localhost:3000`.

   - Click "Save" and **voila**—your local server is now accessible to the web through ngrok!

---

## Setup

1. Click the extension icon to open the popup.
2. Hit "Open ChatGPT Tab" to fire up a session (you’ll need to log in if you haven’t already).
3. In the popup, enter the URL of your Node.js server (default: `http://localhost:3000`, or your **ngrok URL** if you're using that).
4. Click "Save" to link the extension to your server.
5. Take a moment to bask in your newly acquired **API key**.

---

## Using the API

Send a simple POST request to your server (via **ngrok URL** if you’ve tunneled it):

```
POST http://<random-string>.ngrok.io/api/query
```

Request body:

```json
{
  "apiKey": "YOUR_API_KEY",
  "message": "Hello, ChatGPT!",
  "newConversation": true
}
```

### Parameters:
- `apiKey` (string, required): This is your magic key to the universe.
- `message` (string, required): Send a message to ChatGPT and wait for the *wizardry*.
- `newConversation` (boolean, optional): Want to start fresh? Set it to `true`. Default is `false`.

### Response:

```json
{
  "response": "The response text from ChatGPT",
  "error": null
}
```

---

## Security Considerations

Let’s be real: You don’t want just *anyone* accessing your ChatGPT. That’s why we’ve got your back:

- The extension generates a **unique** API key for your protection.
- The API key stays **local** and only gets shared with your specified server.
- Only the apps that have your API key can access your ChatGPT account via this bridge.
- For **production**? Use HTTPS. Seriously.

---

## Limitations

- ChatGPT **must** stay open in a browser tab. You knew this wasn’t going to be *perfect*, right?
- The extension is heavily reliant on the DOM structure of ChatGPT’s web interface, which can change without warning.
- This is an unofficial bridge. If OpenAI messes with their web interface, it might break. Use wisely.

### Tab Activation Feature

Tired of the ChatGPT tab falling asleep? We've got you:

1. The extension **periodically** brings the ChatGPT tab to the front to keep it active.
2. Enable/disable this feature straight from the extension popup.
3. Configure the frequency at which the tab is activated (in minutes).

**Note**: This feature isn’t for the faint of heart. It might mess with your workflow by switching tabs unexpectedly. Use only when necessary.

## Deployment

Going **live**? Here’s what you need to do:

### Server Security Tips

1. **Always** use HTTPS. Don’t be basic.
2. Add some extra authentication to restrict API access.
3. Rate limit the calls so no one abuses the system.
4. Deploy behind a reverse proxy like **Nginx** for an extra layer of protection.

## Disclaimer

This extension is **for educational purposes only**. Using it may violate OpenAI’s terms of service. Proceed at your own risk.



### Notes

Okay, here’s the deal: You need to run the server and the Chrome tab on **one** system. Make sure that the GPT page stays open in the Chrome tab as part of the server config. Keep it set to `localhost`. Install the necessary packages, like `ng-cronk`, and make sure everything’s configured **properly**. 

Be smart about this—use it for local dev and deployment only. The API depends on the **current** DOM structure of ChatGPT, which could break at any moment. Don’t get too comfortable, but for now, enjoy using it while it lasts.

And remember: **This is for educational purposes only.**
