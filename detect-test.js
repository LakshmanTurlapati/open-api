// Simple script to test if the extension is detecting the ChatGPT tab
console.log("ChatGPT detection test script loaded");

// Function to check if the current URL is a ChatGPT URL
function isChatGPTUrl(url) {
  const CHAT_GPT_URLS = [
    "https://chat.openai.com",
    "https://chat.openai.com/",
    "https://chat.openai.com/c/",
    "https://chatgpt.com",
    "https://chatgpt.com/"
  ];
  
  return CHAT_GPT_URLS.some(chatUrl => url.startsWith(chatUrl));
}

// Check the current URL
const currentUrl = window.location.href;
console.log("Current URL:", currentUrl);
console.log("Is ChatGPT URL:", isChatGPTUrl(currentUrl));

// Create a visual indicator
function createIndicator() {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.top = '10px';
  div.style.left = '10px';
  div.style.zIndex = '9999';
  div.style.backgroundColor = isChatGPTUrl(currentUrl) ? '#10a37f' : 'red';
  div.style.color = 'white';
  div.style.padding = '10px';
  div.style.borderRadius = '5px';
  div.style.fontFamily = 'Arial, sans-serif';
  div.style.fontSize = '14px';
  div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  div.textContent = isChatGPTUrl(currentUrl) 
    ? '✓ ChatGPT URL Detected' 
    : '✗ Not a ChatGPT URL';
  
  document.body.appendChild(div);
}

// Run when the page is loaded
if (document.readyState === "complete") {
  createIndicator();
} else {
  window.addEventListener("load", createIndicator);
} 