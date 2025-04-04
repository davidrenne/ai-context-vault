import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  gatherAllContextData,
  syncFullDataToGist,
} from "../storage/contextStorage";
import { encryptPAT, decryptPAT } from "../services/patEncryption";

function OptionsPage() {
  const [pat, setPat] = useState("");
  const [gistUrl, setGistUrl] = useState("");
  const [, setNothing] = useState("");

  useEffect(() => {
    // Load both encrypted PAT and gistURL from chrome.storage.local
    chrome.storage.local.get(["encryptedPAT", "gistURL"], async (res) => {
      if (res.encryptedPAT) {
        try {
          const decryptedPAT = await decryptPAT(res.encryptedPAT);
          setPat(decryptedPAT);
        } catch (error) {
          console.error("[AI Context Vault] Failed to decrypt PAT:", error);
        }
      }
      if (res.gistURL) setGistUrl(res.gistURL);
    });
  }, []);

  const handleManualPAT = async (pat) => {
    if (!pat || pat.length < 10) {
      alert("Please provide a valid PAT token");
      return;
    }

    try {
      const encryptedData = await encryptPAT(pat);
      chrome.storage.local.set({ encryptedPAT: encryptedData }, () => {
        console.log("[AI Context Vault] Saved encrypted GitHub PAT");
        alert("GitHub PAT saved!");
      });
    } catch (error) {
      console.error("[AI Context Vault] Failed to encrypt PAT:", error);
      alert("Failed to save PAT. Please try again.");
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>AI Context Vault - Options</h1>
      <hr />

      <h2>GitHub Gist Sync Settings</h2>
      <label htmlFor="pat">GitHub PAT:</label>
      <input
        id="pat"
        type="password"
        className="input"
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        placeholder="Paste your GitHub Personal Access Token"
        style={{ width: 300, marginRight: 8 }}
      />
      <button className="button" onClick={() => handleManualPAT(pat)}>
        Save Token
      </button>

      <button
        onClick={() => createOrUpdateGist(setNothing)}
        className="button"
        style={{ marginLeft: 10 }}
      >
        Create/Update Gist
      </button>

      <hr />

      <h3>Use Existing Gist</h3>
      <input
        type="text"
        className="input"
        value={gistUrl}
        onChange={(e) => setGistUrl(e.target.value)}
        placeholder="https://gist.github.com/username/gistId"
        style={{ width: 400, marginRight: 8 }}
      />
      <button onClick={() => saveGistURL(gistUrl)}>Save Gist URL</button>
    </div>
  );
}

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);
root.render(<OptionsPage />);

////////////////////////////////////////////////////////////////////////////////
// GITHUB GIST SYNC - ADDED AT BOTTOM
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// GITHUB GIST SYNC - ADDED AT BOTTOM
////////////////////////////////////////////////////////////////////////////////

/**
 * (Optional) If you want to run any init code upon loading the options
 */
function initGitHubGistSyncUI() {
  chrome.storage.local.get(["githubToken"], (res) => {
    console.log(
      "[AI Context Vault] Current stored GitHub token:",
      res.githubToken
    );
  });
}

/**
 * Minimal function storing a GitHub token in local storage
 */
export function handleSaveGitHubToken(token) {
  chrome.storage.local.set({ githubToken: token }, () => {
    console.log("[AI Context Vault] GitHub token saved in local storage");
  });
}

export function handleCreateOrUpdateGist(gistData) {
  chrome.storage.local.get(["githubToken"], (res) => {
    if (!res.githubToken) {
      console.error("[AI Context Vault] No GitHub token found!");
      return;
    }
    const token = res.githubToken;
    // placeholder for gist logic
  });
}

/**
 * createOrUpdateGist
 * 1) If gistURL is set, do a PATCH to update that Gist
 * 2) Otherwise, do a POST to create a new Gist
 * 3) Always store the final gistURL in chrome.storage.local
 */
export async function createOrUpdateGist(callbackFunc) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["gistPAT", "gistURL"], async (res) => {
      const pat = res.gistPAT;
      let gistUrl = res.gistURL || "";
      if (!pat) {
        alert("No GitHub PAT found. Please provide one first.");
        return reject("No PAT");
      }

      // 1) Gather data from the new chrome.storage local approach
      const data = await gatherAllContextData();

      // 2) Build gist payload
      const gistPayload = {
        description: "AI Context Vault Sync",
        public: false,
        files: {
          "ai_context_vault_data.json": {
            content: JSON.stringify(data, null, 2),
          },
        },
      };

      try {
        let resp;
        if (gistUrl && gistUrl.includes("/")) {
          // Attempt an update
          // E.g. gistUrl = "https://gist.github.com/username/123abc"
          // We need to extract gistId ("123abc")
          const gistId = gistUrl.split("/").pop();
          resp = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: "PATCH",
            headers: {
              Authorization: `token ${pat}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gistPayload),
          });
        } else {
          // If gistURL isn't set, create a brand-new gist
          resp = await fetch("https://api.github.com/gists", {
            method: "POST",
            headers: {
              Authorization: `token ${pat}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gistPayload),
          });
        }

        if (!resp.ok) {
          const errData = await resp.json();
          console.error(
            "[AI Context Vault] Gist creation/update error:",
            errData
          );
          alert("Gist creation/update failed. Check console.");
          return reject(errData);
        } else {
          const gistInfo = await resp.json();
          console.log(
            "[AI Context Vault] Created/Updated Gist:",
            gistInfo.html_url
          );
          if (gistUrl && gistUrl.includes("/")) {
            alert("Gist updated successfully!");
          } else {
            alert("Gist created successfully!");
          }
          callbackFunc();

          // Always store the final gistURL
          chrome.storage.local.set({ gistURL: gistInfo.html_url }, () => {
            console.log("[AI Context Vault] Stored gistURL in local storage.");
          });

          resolve(gistInfo);
        }
      } catch (err) {
        console.error("[AI Context Vault] createOrUpdateGist error:", err);
        alert(`Error creating/updating gist: ${err.message}`);
        reject(err);
      }
    });
  });
}

export function saveGistURL(gistURL) {
  chrome.storage.local.set({ gistURL }, () => {
    console.log("[AI Context Vault] Saved Gist URL:", gistURL);
    alert(`Gist URL saved: ${gistURL}`);
    syncFullDataToGist();
  });
}

export async function loadGistURL() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["gistURL"], (res) => {
      resolve(res.gistURL || "");
    });
  });
}

initGitHubGistSyncUI();
