const { Client } = require("discord.js-selfbot-v13");
const { EmbedBuilder, WebhookClient } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { captchaHook } = require("../config");
const { checkRarity, getImage, solveHint } = require("pokehint");
const { log, formatPokemon, logHook, colors } = require("../utils/utils");
const { getName, solveCaptcha } = require("../utils/api");
const { sendCaptchaMessage } = require('../utils/captchaSolver');
const { captchaApiKey, captchaApiHostname } = require("../config");

const poketwo = "716390085896962058";
const p2ass = "854233015475109888";
const p2Filter = (p2) => p2.author.id === poketwo;

// ---------------- Editable settings ----------------
const targetChannelId = "1202219864044089395";
const userIdToWaitFor = "716390085896962058";
// --------------------------------------------------

// Placeholder list 1: Used for the 'ra' and 'evolve' sequence
const POKEMON_NAMES_EVOLVE = ["Bulbasaur", "Ivysaur",
"Charmander", "Charmeleon",
"Squirtle", "Wartortle",
"Caterpie", "Metapod",
"Weedle", "Kakuna",
"Pidgey", "Pidgeotto",
"Rattata",
"Spearow",
"Ekans",
"Sandshrew",
"Nidoran♀", "Nidorina",
"Nidoran♂", "Nidorino",
"Zubat",
"Oddish",
"Paras",
"Venonat",
"Diglett",
"Meowth",
"Psyduck",
"Mankey",
"Poliwag", "Poliwhirl",
"Machop", "Machoke",
"Bellsprout", "Weepinbell",
"Tentacool",
"Geodude", "Graveler",
"Ponyta",
"Slowpoke",
"Magnemite",
"Doduo",
"Seel",
"Grimer",
"Gastly", "Haunter",
"Drowzee",
"Krabby",
"Voltorb",
"Cubone",
"Koffing",
"Rhyhorn",
"Horsea",
"Goldeen",
"Chikorita", "Bayleef",
"Cyndaquil", "Quilava",
"Totodile", "Croconaw",
"Sentret",
"Hoothoot",
"Ledyba",
"Spinarak",
"Chinchou",
"Mareep", "Flaaffy",
"Hoppip", "Skiploom",
"Wooper",
"Slugma",
"Swinub",
"Remoraid",
"Houndour",
"Phanpy",
"Treecko", "Grovyle",
"Torchic", "Combusken",
"Mudkip", "Marshtomp",
"Poochyena",
"Zigzagoon",
"Wurmple", "Silcoon", "Cascoon",
"Lotad",
"Seedot",
"Taillow",
"Shroomish",
"Wingull",
"Surskit",
"Whismur", "Loudred",
"Makuhita",
"Aron", "Lairon",
"Meditite",
"Electrike",
"Numel",
"Spoink",
"Spheal", "Sealeo",
"Bagon", "Shelgon",
"Beldum", "Metang"]; 

// Placeholder list 2: Used for the 'dc add' sequence.
const POKEMON_NAMES_DC = ["Pidgey", "Pidgeotto", "Pidgeot", "Rattata", "Raticate", "Spearow", "Fearow", "Ekans", "Arbok", "Sandshrew", "Sandslash", "Nidoran♀", "Nidorina", "Nidoqueen", "Nidoran♂", "Nidorino", "Nidoking", "Zubat", "Golbat", "Crobat", "Oddish", "Gloom", "Vileplume", "Paras", "Parasect", "Venonat", "Venomoth", "Diglett", "Dugtrio", "Meowth", "Persian", "Psyduck", "Golduck", "Mankey", "Primeape", "Growlithe", "Arcanine", "Poliwag", "Poliwhirl", "Poliwrath", "Bellsprout", "Weepinbell", "Victreebel", "Tentacool", "Tentacruel", "Geodude", "Graveler", "Golem", "Ponyta", "Rapidash", "Slowpoke", "Slowbro", "Slowking", "Farfetch’d", "Seel", "Dewgong", "Grimer", "Muk", "Gastly", "Haunter", "Gengar", "Drowzee", "Hypno", "Krabby", "Kingler", "Cubone", "Marowak", "Koffing", "Weezing", "Rhyhorn", "Rhydon", "Horsea", "Seadra", "Kingdra", "Goldeen", "Seaking", "Magikarp", "Gyarados", "Sentret", "Furret", "Hoothoot", "Noctowl", "Ledyba", "Ledian", "Spinarak", "Ariados", "Chinchou", "Lanturn", "Mareep", "Flaaffy", "Ampharos", "Marill", "Azumarill", "Hoppip", "Skiploom", "Jumpluff", "Wooper", "Quagsire", "Slugma", "Magcargo", "Swinub", "Piloswine", "Mamoswine", "Remoraid", "Octillery", "Houndour", "Houndoom", "Phanpy", "Donphan", "Poochyena", "Mightyena", "Zigzagoon", "Linoone", "Wurmple", "Silcoon", "Beautifly", "Cascoon", "Dustox", "Lotad", "Lombre", "Ludicolo", "Seedot", "Nuzleaf", "Shiftry", "Taillow", "Swellow", "Shroomish", "Breloom", "Wingull", "Pelipper", "Surskit", "Masquerain", "Whismur", "Loudred", "Exploud", "Makuhita", "Hariyama", "Aron", "Lairon", "Aggron", "Meditite", "Medicham", "Electrike", "Manectric", "Numel", "Camerupt", "Spoink", "Grumpig", "Spheal", "Sealeo", "Walrein", "Bagon", "Shelgon", "Salamence"];

class AutoCatcher {

  constructor(token) {
    // ... constructor properties remain the same ...
    this.token = token;
    this.client = new Client();
    this.captcha = false;
    this.catch = true;
    this.aiCatch = false;
    this.stats = {
      tcoins: 0,
      coins: 0,
      shards: 0,
      catches: 0,
      shinies: 0,
      legs: 0,
      myths: 0,
      ubs: 0,
      ivs: 0,
      forms: 0,
      events: 0,
      rares: 0,
      lastCatch: new Date(),
    };
    this.pokemonData = {
      legendary: [],
      shiny: [],
      mythical: [],
      ultraBeast: [],
      rareIV: [],
      event: [],
      regional: [],
      all: []
    };
  }

  login() {
    this.client.login(this.token).catch((err) => {
      if (err.code === `TOKEN_INVALID`) {
        console.log(`Failed to Login Invalid Token`.red);
      }
      if (err) return false;
    });
  }

  start(res) {
    this.client.on("ready", async () => {
      log(`Logged in as ${this.client.user.tag}`.green);
      res(`Logged in as ${this.client.user.tag}`.green);
      
      // *** START THE AUTO-RA TASK HERE ***
      this.limitedTask(); 
    });
  }

  // --- NEW AUTOCATCHER METHODS START HERE ---

  /**
   * Utility function to handle the two-step click reply chain.
   */
  async handleTwoStepClick(channel, initialReply) {
      if (!initialReply) return;
      
      // 1. Reply to the initial message with .click
      try {
          await initialReply.reply(".click");
          console.log("handleDcSequence: Replied '.click' to the first message in the chain.");
      } catch (err) {
          console.error("handleDcSequence: Failed to send first .click reply:", err);
          return;
      }

      // 2. Wait for the second reply from the user (replying to the bot's .click)
      const collected2 = await channel.awaitMessages({
          filter: (m) => m.author && m.author.id === userIdToWaitFor && m.reference && m.reference.messageId === initialReply.id,
          max: 1,
          time: 8000,
      });
      const reply2 = collected2.first();

      if (!reply2) {
          console.log("handleDcSequence: Second reply (from user) not received. Ending click chain.");
          return;
      }

      // 3. Reply to the user's second message with .click
      try {
          await reply2.reply(".click");
          console.log("handleDcSequence: Replied '.click' to the second message in the chain.");
      } catch (err) {
          console.error("handleDcSequence: Failed to send second .click reply:", err);
      }
  }


  /**
   * Handles the DC Add sequence (runs twice).
   */
  async handleDcSequence(channel) {
      for (let i = 0; i < 2; i++) {
          console.log(`handleDcSequence: Starting DC sequence run #${i + 1}.`);

          const randomPokemon = POKEMON_NAMES_DC[Math.floor(Math.random() * POKEMON_NAMES_DC.length)];
          const searchCommand = `<@${userIdToWaitFor}> p --n ${randomPokemon}`;
          
          // 1. Send the 'p --n' command
          await channel.send(searchCommand);
          console.log(`handleDcSequence: Sent command: ${searchCommand}`);

          // 2. Wait up to 8 seconds for a reply from the specific user
          const collected = await channel.awaitMessages({
              filter: (m) => m.author && m.author.id === userIdToWaitFor,
              max: 1,
              time: 8000,
          });

          const reply = collected.first();

          if (!reply) {
              console.log("handleDcSequence: No reply received for 'p --n' command. Aborting DC sequence run.");
              continue; 
          }

          // 3. Extract the first Male and first Female IDs
          const content = reply.content || "";
          const maleRegex = /^\s*(\d{1,6}).*<:male:/gm;
          const femaleRegex = /^\s*(\d{1,6}).*<:female:/gm;

          let maleMatch = maleRegex.exec(content);
          let femaleMatch = femaleRegex.exec(content);

          const maleId = maleMatch ? maleMatch[1] : null;
          const femaleId = femaleMatch ? femaleMatch[1] : null;

          if (!maleId || !femaleId) {
              console.log("handleDcSequence: Could not find both Male and Female IDs. Skipping DC command.");
              await new Promise((r) => setTimeout(r, 1000));
              continue;
          }

          // 4. Send the final 'dc add' command
          const dcCommand = `<@${userIdToWaitFor}> dc add ${maleId} ${femaleId}`;
          let dcMessage;
          try {
              dcMessage = await channel.send(dcCommand);
              console.log(`handleDcSequence: Successfully sent dc add command: ${dcCommand}`);
          } catch (err) {
              console.error("handleDcSequence: Failed to send dc add command:", err);
              await new Promise((r) => setTimeout(r, 1000));
              continue;
          }

          // 5. Handle the two-step click reply chain
          // Wait for the user's initial reply to the dc add command
          const collectedInitial = await channel.awaitMessages({
              filter: (m) => m.author && m.author.id === userIdToWaitFor && m.reference && m.reference.messageId === dcMessage.id,
              max: 1,
              time: 8000,
          });
          const initialReply = collectedInitial.first();
          
          if (initialReply) {
              // Now using the class's method reference:
              await this.handleTwoStepClick(channel, initialReply); 
          } else {
              console.log("handleDcSequence: Initial reply for DC click chain not received.");
          }

          // Small delay before the next iteration
          if (i < 1) {
              await new Promise((r) => setTimeout(r, 1000));
          }
      }
  }


  /**
   * Handles the initial Evolve sequence: p --n and evolve.
   */
  async handleEvolveSequence(channel) {
      console.log("handleEvolveSequence: Starting primary evolve sequence.");

      const randomPokemon = POKEMON_NAMES_EVOLVE[Math.floor(Math.random() * POKEMON_NAMES_EVOLVE.length)];
      const searchCommand = `<@${userIdToWaitFor}> p --n ${randomPokemon}`;
      
      // 1. Send the 'p --n' command
      await channel.send(searchCommand);
      console.log(`handleEvolveSequence: Sent command: ${searchCommand}`);

      // 2. Wait up to 8 seconds for a reply from the specific user
      const collected = await channel.awaitMessages({
          filter: (m) => m.author && m.author.id === userIdToWaitFor,
          max: 1,
          time: 8000,
      });

      const reply = collected.first();

      if (!reply) {
          console.log("handleEvolveSequence: No reply received for 'p --n' command. Aborting evolve sequence.");
          return;
      }

      // 3. Extract the first 7 IDs
      const content = reply.content || "";
      const idRegex = /^\s*(\d{1,6})/gm; 
      
      let match;
      const ids = [];
      
      while ((match = idRegex.exec(content)) !== null && ids.length < 7) {
          ids.push(match[1]);
      }

      if (ids.length === 0) {
          console.log("handleEvolveSequence: Could not find any Pokémon IDs in the reply.");
          return;
      }

      // 4. Send the final 'evolve' command
      const idList = ids.join(' ');
      const evolveCommand = `<@${userIdToWaitFor}> evolve ${idList}`;
      
      try {
          await channel.send(evolveCommand);
          console.log(`handleEvolveSequence: Successfully sent evolve command: ${evolveCommand}`);
      } catch (err) {
          console.error("handleEvolveSequence: Failed to send evolve command:", err);
      }
  }

  /**
   * Main scheduling task.
   */
  async limitedTask() {
    const interval = 25 * 60 * 1000; // 25 minutes

    // Helper to start the next run after the interval
    const scheduleNext = () => {
        setTimeout(() => {
            this.runOnce(); // Use this.runOnce()
        }, interval);
    };
    
    // single run loop that handles the IV-decreasing inner loop
    const runOnce = async () => {
      let iv = 50;

      try {
        // Use this.client here:
        const channel = await this.client.channels.fetch(targetChannelId); 
        if (!channel) {
          console.error("limitedTask: target channel not found:", targetChannelId);
          return scheduleNext();
        }

        // inner loop: keep sending while replies contain "shiny"
        while (true) {
          // send the ping + ra command
          const sent = await channel.send(`<@${userIdToWaitFor}> ra --iv <${iv} --lim 10`);
          
          // wait up to 8 seconds for a reply from the specific user
          const collected = await channel.awaitMessages({
            filter: (m) => m.author && m.author.id === userIdToWaitFor,
            max: 1,
            time: 8000,
          });

          const reply = collected.first();

          if (!reply) {
            // no reply — abort this run, reset, and wait next interval
            console.log(`limitedTask: no reply received. Resetting IV and waiting next interval.`);
            iv = 50;
            break;
          }

          const content = (reply.content || "").toLowerCase();

          if (content.includes("shiny")) {
            // reply contains shiny -> decrease iv by 2 and try again
            iv -= 2;
            if (iv <= 0) {
              console.log("limitedTask: IV reached zero or less; resetting to 50 and ending this run.");
              iv = 50;
              break;
            }
            console.log(`limitedTask: reply contained "shiny". Decreasing IV to ${iv} and retrying...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          } else {
            // reply does NOT contain shiny -> reply with .click to that message
            try {
              await reply.reply(".click");
              console.log("limitedTask: replied '.click' to the non-shiny reply.");
              
              // --- EXECUTE SECONDARY SEQUENCES (using 'this') ---
              // 1. Evolve sequence
              await this.handleEvolveSequence(channel); 
              
              // 2. DC Add sequence (runs twice)
              await this.handleDcSequence(channel); 

            } catch (err) {
              console.error("limitedTask: failed to execute click or secondary sequences:", err);
            }
            iv = 50;
            break;
          }
        }
      } catch (err) {
        console.error("limitedTask: error during run:", err);
      } finally {
        // Schedule next run after interval (runs indefinitely)
        scheduleNext();
      }
    };
    
    // Attach runOnce to 'this' so scheduleNext can call it
    this.runOnce = runOnce; 

    // start the first run immediately
    runOnce();
  }
  
  // --- EXISTING AUTOCATCHER METHODS BELOW ---
  
  catcher() {
    this.client.on("messageCreate", async (message) => {
      // ... (Rest of catcher logic remains the same)
    });
  }

  parseClickCommand(content) {
    // ... (logic remains the same)
  }

  async handleClickCommand(message, args) {
    // ... (logic remains the same)
  }
}

// *** REMOVED: limitedTask(client); ***

module.exports = {AutoCatcher};
