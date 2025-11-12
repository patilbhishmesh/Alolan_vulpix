const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require("discord.js");
const config = require("../config");

class CaptchaSolverAPI {
  constructor(options) {
    this.baseUrl = options.baseUrl || 'http://217.154.201.164:9701';
    this.licenseKey = options.licenseKey;
    this.timeout = options.timeout || 120000;
    this.maxRetries = options.maxRetries || 3;
  }

  async solveCaptcha(uid, token) {
    if (!uid || !token) {
      throw new Error('Both uid and token are required');
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempting to solve captcha (attempt ${attempt}/${this.maxRetries}) for user ${uid}`);
        
        const response = await axios.post(`${this.baseUrl}/solve-captcha`, {
          uid: uid,
          token: String(token)
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-license-key': this.licenseKey
          },
          timeout: this.timeout
        });

        console.log(`Captcha API response:`, JSON.stringify(response.data, null, 2));

        if (response.data && response.data.status === true) {
          return response.data;
        } else {
          throw new Error(response.data?.error || response.data?.message || 'Captcha solving failed with unknown error');
        }
      } catch (error) {
        console.error(`Captcha solving attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to solve captcha after ${this.maxRetries} attempts. Last error: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  async solveCaptchaGet(uid, token) {
    if (!uid || !token) {
      throw new Error('Both uid and token are required');
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempting to solve captcha via GET (attempt ${attempt}/${this.maxRetries}) for user ${uid}`);
        
        const response = await axios.get(`${this.baseUrl}/solve-captcha`, {
          params: {
            'x-license-key': this.licenseKey,
            uid: uid,
            token: String(token)
          },
          timeout: this.timeout
        });

        console.log(`Captcha API GET response:`, JSON.stringify(response.data, null, 2));

        if (response.data && response.data.status === true) {
          return response.data;
        } else {
          throw new Error(response.data?.error || response.data?.message || 'Captcha solving failed with unknown error');
        }
      } catch (error) {
        console.error(`Captcha solving GET attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to solve captcha via GET after ${this.maxRetries} attempts. Last error: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
}

const ENDPOINT_CONFIGS = {
  PTERODACTYL: {
    primary: 'http://217.154.201.164:9701',
    backup: 'http://37.187.150.205:1059',
    alternative: 'http://solver-api:1059'
  },
  NGROK: {
    permanent: 'https://unified-guppy-probably.ngrok-free.app',
    fallback: 'https://temporary-tunnel.ngrok-free.app'
  },
  LOCAL: {
    primary: 'http://localhost:1059',
    alternate: 'http://127.0.0.1:1059'
  },
  VPS: {
    primary: 'http://your-vps-ip:1059',
    https: 'https://your-domain.com'
  }
};

function createEndpointConfig(configType) {
  const config = ENDPOINT_CONFIGS[configType];
  if (!config) {
    throw new Error(`Unknown configuration type: ${configType}`);
  }

  return Object.entries(config).map(([key, url], index) => ({
    url,
    description: `${configType} ${key}`,
    priority: index + 1
  }));
}

async function solveCaptcha(apiKey, userId, token, hostname) {
  try {
    const solver = new CaptchaSolverAPI({
      baseUrl: hostname || 'http://217.154.201.164:9701',
      licenseKey: apiKey,
      timeout: 120000,
      maxRetries: 3
    });

    const result = await solver.solveCaptcha(userId, token);
    
    return {
      success: true,
      result: result.solution || result.data || 'Solved successfully'
    };
  } catch (error) {
    console.error(`🚨 Captcha solving failed:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

function checkApiKeyBalance(apiKey, hostname) {
  return new Promise((resolve) => {
    resolve({
      success: true,
      remaining: 9999,
      created: new Date().toISOString(),
      revoked: false
    });
  });
}

async function sendCaptchaMessage(username, userId, status, method = "Hoopa Captcha Solver", timeTaken = null) {
  try {
    const hook = new WebhookClient({ url: config.captchaHook });

    let embed;
    if (status === "detected") {
      embed = new EmbedBuilder()
        .setTitle("🔍 CAPTCHA Detected")
        .setColor("#FF8C00")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: "Server", value: "JS", inline: true },
          { name: "Link", value: `[Captcha](https://verify.poketwo.net/captcha/${userId})`, inline: true }
        )
        .setDescription("Attempting automatic solve...")
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    } else if (status === "solved") {
      embed = new EmbedBuilder()
        .setTitle("✅ CAPTCHA SOLVED SUCCESSFULLY")
        .setColor("#00FF00")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time Taken", value: timeTaken || "13.531s", inline: true },
          { name: "Solver Method", value: method, inline: true }
        )
        .setDescription(`Today at ${new Date().toLocaleTimeString()}`)
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    } else if (status === "failed") {
      embed = new EmbedBuilder()
        .setTitle("❌ CAPTCHA SOLVING FAILED")
        .setColor("#FF0000")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: "Solver Method", value: method, inline: true }
        )
        .setDescription("Manual intervention may be required")
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    }

    await hook.send({
      username: status === "solved" ? "Spidey Bot" : "Hoopa Captcha Solver",
      avatarURL: "https://pngimg.com/d/mario_PNG125.png",
      embeds: [embed],
    });
  } catch (error) {
    console.error("Error sending captcha message:", error);
  }
}

module.exports = {
  CaptchaSolverAPI,
  ENDPOINT_CONFIGS,
  createEndpointConfig,
  solveCaptcha,
  checkApiKeyBalance,
  sendCaptchaMessage
};