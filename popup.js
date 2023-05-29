let AUTHORIZATION_HEADER = "***";
let textArea;
let cost;
let tokenCount;
let summarizeButton;
let summarizeButtonTitle;

let missingApiKey = false;

// define chrome if not defined
if (typeof chrome === "undefined") {
  var chrome = { tabs: { query: () => {} } };
}

const PREPROMPT = `
You are an internet browsing assistant.
Summarize the following webpage text content using bullet points.
Webpages are sent to you by the user in message. 1 message = 1 webpage.
The content is messy and contains useless information, you have to filter it.
Use "Sentence case" : first word with capital letter, the rest lowercase.
Use concise sentences.
`;

document.addEventListener("DOMContentLoaded", function () {
  conversationString = "";
  // document.getElementById("location").innerHTML = window.location.href;
  textArea = document.getElementById("text-area");
  summarizeButton = document.getElementById("summarize");
  cost = document.getElementById("cost");
  tokenCount = document.getElementById("token-count");
  summarizeButtonTitle = document.getElementById("summarize-title");
  apiKey = document.getElementById("api-key");

  // fill api key with local storage
  chrome.storage.local.get("apiKey", function (result) {
    if (result.apiKey) {
      AUTHORIZATION_HEADER = "Bearer " + result.apiKey;
      apiKey.value = result.apiKey;
    } else {
      missingApiKey = true;
    }
  });

  readApiKey();

  // on api key change, update extension storage
  apiKey.addEventListener("keyup", function () {
    chrome.storage.local.set({ apiKey: apiKey.value }, function () {
      AUTHORIZATION_HEADER = "Bearer " + apiKey.value;
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // document.getElementById("location").innerHTML = tabs[0].url;
    // if url extension is pdf
    if (tabs[0].url.split(".").pop() === "pdf") {
      textArea.value = "PDF not supported yet.";
      // textArea.value = "Loading pdf...";
      // // var pdfjsLib = window["pdfjs-dist/build/pdf"];
      // // pdfjsLib.GlobalWorkerOptions.workerSrc =
      // //   "https://mozilla.github.io/pdf.js/build/pdf.worker.js";
      // var loadingTask = pdfjsLib.getDocument({ data: pdfData });
      // loadingTask.promise.then(
      //   function (pdf) {
      //     textArea.value = "PDF loaded.";

      //     // // Fetch the first page
      //     // var pageNumber = 1;
      //     // // log(pdf);
      //     // textArea.value = pdf.numPages;
      //   },
      //   function (reason) {
      //     // PDF loading error
      //     textArea.value = "Error loading pdf. " + JSON.stringify(reason);
      //   }
      // );
    }
  });

  // Get the content of the current webpage
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { message: "getWebPageContent" },
      async function (response) {
        if (!(await checkEmptyApiKey())) return;
        // Display the content in the text area
        // textArea.value = response.content;
        textArea.value = response.content;
        // update token count
        // count words regex
        var wordCount = textArea.value.match(/\S+/g).length;
        tokenCount.innerText = Math.floor((wordCount * 100) / 75);
        cost.innerText = ((tokenCount.innerText * 0.002) / 1000).toFixed(4);
      }
    );
  });

  summarizeButton.addEventListener("click", function () {
    runSummarize();
  });
});

const checkEmptyApiKey = async () => {
  await readApiKey();
  if (!missingApiKey) return true;
  textArea.value =
    "ENTER API KEY\n\nPlease enter an API key in the input below then reopen the extension.";
  apiKey.className = "red-border";
  // when click on api key, set value to ""
  apiKey.addEventListener("click", function () {
    apiKey.value = "";
    apiKey.className = "";
  });

  // when unfocus api key, rerun this function
  apiKey.addEventListener("focusout", function () {
    checkEmptyApiKey();
  });
  return false;
};

// send log to content.js
const log = (data) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { message: "log", data });
  });
};

const sendPrompt = async () => {
  conversationString = "";
  const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: PREPROMPT,
      },
      {
        role: "user",
        content: textArea.value,
      },
    ],
    temperature: 0.2,
    stream: true,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTHORIZATION_HEADER,
    },
    body: JSON.stringify(requestBody),
  });

  //handle error
  if (!response.ok) {
    const error = await response.json();
    textArea.value = error.error.message;
    return;
  }

  const reader = response.body.getReader();
  let result = await reader.read();
  let decoder = new TextDecoder("utf-8");
  let partialData = "";

  while (!result.done) {
    partialData += decoder.decode(result.value, { stream: true });

    while (partialData.includes("data:")) {
      const startIndex = partialData.indexOf("data:");
      const endIndex = partialData.indexOf("\n", startIndex);
      const messageData = partialData.slice(startIndex + 5, endIndex).trim();

      if (messageData) {
        const message = JSON.parse(messageData);
        const content = message.choices[0].delta.content;

        if (message.choices[0].finish_reason === "stop") {
          summarizeButtonTitle.innerHTML = "Summarize";
          // Last message received, stop processing
          return;
        }

        if (content) {
          displayMessage("Assistant", content);
        }
      }

      partialData = partialData.slice(endIndex + 1);
    }

    result = await reader.read();
  }
};

// Variable to store the conversation
let conversationString = "";

// Function to display messages in the conversation
function displayMessage(role, content) {
  if (role === "User") return;
  log({ role, content });

  // Append the formatted message to the conversation string
  conversationString += content;

  // Update the conversation display
  textArea.value = conversationString;
}

// Example usage
async function runSummarize() {
  summarizeButtonTitle.innerHTML =
    "Thinking <img src='https://i.gifer.com/ZZ5H.gif' class='loader' />";
  // displayMessage("User", textArea.value);
  sendPrompt(textArea.value);
  textArea.value = "";
}

const readApiKey = () => {
  return new Promise((resolve, reject) => {
    // fill api key with local storage
    missingApiKey = true;
    chrome.storage.local.get("apiKey", function (result) {
      if (result.apiKey) {
        AUTHORIZATION_HEADER = "Bearer " + result.apiKey;
        apiKey.value = result.apiKey;
        missingApiKey = false;
      }
      resolve();
    });
  });
};

log("popup opened");
