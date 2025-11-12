const axios = require("axios");
const http = require('http');
const key = "rishixyz";
const apiBaseUrl = "http://37.114.41.51:6078/identify";

async function getName(imageUrl, altName) {
  try {
    const response = await axios.post(
      apiBaseUrl,
      { url: imageUrl, alt_name: altName },
      { headers: { "X-Authorization": key } }
    );

    if (response.data.error) {
      console.log(response.data.error);
      return [null, 0];
    }

    const { predicted_class: pokemonName, confidence } = response.data;
    return [pokemonName.toLowerCase(), confidence];
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "An error occurred while getting the name. Please contact the admin!"
    );
    return [null, 0];
  }
}

// Updated solveCaptcha function to use the remote API instead of local endpoint
async function solveCaptcha(apiKey, userId, token, hostname) {
  try {
    // Import the CaptchaSolverAPI class
    const { CaptchaSolverAPI } = require('./captchaSolver');
    
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

module.exports = {
  getName,
  solveCaptcha,
};