const { Client } = require("discord.js-selfbot-v13"); // <-- FIXED: Changed 'client' to 'Client'
const { EmbedBuilder, WebhookClient } = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { captchaHook } = require("../config");
const { checkRarity, getImage, solveHint } = require("pokehint");
const { log, formatPokemon, logHook, colors } = require("../utils/utils");
const { getName, solveCaptcha } = require("../utils/api");
const { sendCaptchaMessage } = require('../utils/captchaSolver');
const { captchaApiKey, captchaApiHostname } = require("../config");

// *** NEW: Import the Pokémon names from the separate file ***
// Make sure you create this file with arrays named POKEMON_NAMES_EVOLVE and POKEMON_NAMES_DC
const { POKEMON_NAMES_EVOLVE, POKEMON_NAMES_DC } = require("./pokemonLists"); 

const poketwo = "716390085896962058";
const p2ass = "854233015475109888";
const p2Filter = (p2) => p2.author.id === poketwo;

// ---------------- Editable settings ----------------
const targetChannelId = "1202219864044089395"; // CHANNEL ID FOR RA/EVOLVE/DC COMMANDS
const userIdToWaitFor = "716390085896962058"; // Pokétwo ID
// --------------------------------------------------

class AutoCatcher {

  constructor(token) {
    this.token = token;
    // Added { checkUpdate: false } for stability
    this.client = new Client({ checkUpdate: false }); 
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

  // --- LOGIN FIX APPLIED HERE ---
  async login() {
    try {
        // Use await to correctly handle the promise and errors
        await this.client.login(this.token); 
    } catch (err) {
        if (err.code === `TOKEN_INVALID` || (err.message && err.message.includes('token is invalid'))) {
            console.log(`FATAL: Failed to Login. The provided token is invalid.`.red);
        } else {
            console.log(`FATAL: An unexpected error occurred during login: ${err.message}`.red);
        }
        // Exit the application on a critical failure like invalid token
        process.exit(1); 
    }
  }

  start(res) {
    this.client.on("ready", async () => {
      log(`Logged in as ${this.client.user.tag}`.green);
      res(`Logged in as ${this.client.user.tag}`.green);
      // *** Start the auto-ra/evolve/dc task ***
      this.limitedTask(); 
    });
  }

  // ------------------------------------------------------------------
  // *** NEW METHODS FOR RA, EVOLVE, DC COMMANDS WITH 5-SECOND DELAYS ***
  // ------------------------------------------------------------------

  async handleTwoStepClick(channel, initialReply) {
      if (!initialReply) return;
      
      try {
          await wait(5000); 
          await initialReply.reply(".click");
          console.log("handleDcSequence: Replied '.click' to the first message in the chain.");
      } catch (err) {
          console.error("handleDcSequence: Failed to send first .click reply:", err);
          return;
      }

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

      try {
          await wait(5000); 
          await reply2.reply(".click");
          console.log("handleDcSequence: Replied '.click' to the second message in the chain.");
      } catch (err) {
          console.error("handleDcSequence: Failed to send second .click reply:", err);
      }
  }


  async handleDcSequence(channel) {
      for (let i = 0; i < 2; i++) {
          console.log(`handleDcSequence: Starting DC sequence run #${i + 1}.`);

          const randomPokemon = POKEMON_NAMES_DC[Math.floor(Math.random() * POKEMON_NAMES_DC.length)];
          const searchCommand = `<@${userIdToWaitFor}> p --n ${randomPokemon}`;
          
          await wait(5000); // 5-second delay before p --n
          await channel.send(searchCommand);
          console.log(`handleDcSequence: Sent command: ${searchCommand}`);

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

          const content = reply.content || "";
          
          // *** FIX: Updated Regex to correctly parse IDs from the output format (e.g., "4815  • Seel ♂ • 74.73% • ...")
          // This uses lookbehind to ensure we only capture the IDs at the start of the line, followed by space/bullet, ignoring the LVL lines.
          const maleRegex = /(^\s*\d+)\s+.*♂/gm; 
          const femaleRegex = /(^\s*\d+)\s+.*♀/gm;

          let maleMatch = maleRegex.exec(content);
          let femaleMatch = femaleRegex.exec(content);
          
          // Get the first matching ID for each gender
          const maleId = maleMatch ? maleMatch[1].trim() : null;
          const femaleId = femaleMatch ? femaleMatch[1].trim() : null;
          
          console.log(`handleDcSequence: Parsed Male ID: ${maleId}, Female ID: ${femaleId}`);

          if (!maleId || !femaleId) {
              console.log("handleDcSequence: Could not find both Male and Female IDs. Skipping DC command.");
              await new Promise((r) => setTimeout(r, 1000));
              continue;
          }

          const dcCommand = `<@${userIdToWaitFor}> dc add ${maleId} ${femaleId}`;
          let dcMessage;
          try {
              await wait(5000); // 5-second delay before dc add
              dcMessage = await channel.send(dcCommand);
              console.log(`handleDcSequence: Successfully sent dc add command: ${dcCommand}`);
          } catch (err) {
              console.error("handleDcSequence: Failed to send dc add command:", err);
              await new Promise((r) => setTimeout(r, 1000));
              continue;
          }

          const collectedInitial = await channel.awaitMessages({
              filter: (m) => m.author && m.author.id === userIdToWaitFor && m.reference && m.reference.messageId === dcMessage.id,
              max: 1,
              time: 8000,
          });
          const initialReply = collectedInitial.first();
          
          if (initialReply) {
              await this.handleTwoStepClick(channel, initialReply); 
          } else {
              console.log("handleDcSequence: Initial reply for DC click chain not received.");
          }

          if (i < 1) {
              await new Promise((r) => setTimeout(r, 1000));
          }
      }
  }


  async handleEvolveSequence(channel) {
      console.log("handleEvolveSequence: Starting primary evolve sequence.");

      const randomPokemon = POKEMON_NAMES_EVOLVE[Math.floor(Math.random() * POKEMON_NAMES_EVOLVE.length)];
      const searchCommand = `<@${userIdToWaitFor}> p --n ${randomPokemon}`;
      
      await wait(5000); // 5-second delay before p --n
      await channel.send(searchCommand);
      console.log(`handleEvolveSequence: Sent command: ${searchCommand}`);

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

      const content = reply.content || "";
      // Regex to capture IDs on lines that start with a number (ID), followed by a space or a bullet point
      const idRegex = /^\s*(\d{1,6})\s*[\.\•]/gm; 
      
      let match;
      const ids = [];
      
      while ((match = idRegex.exec(content)) !== null && ids.length < 7) {
          ids.push(match[1]);
      }

      if (ids.length === 0) {
          console.log("handleEvolveSequence: Could not find any Pokémon IDs in the reply.");
          return;
      }

      const idList = ids.join(' ');
      const evolveCommand = `<@${userIdToWaitFor}> evolve ${idList}`;
      
      try {
          await wait(5000); // 5-second delay before evolve
          await channel.send(evolveCommand);
          console.log(`handleEvolveSequence: Successfully sent evolve command: ${evolveCommand}`);
      } catch (err) {
          console.error("handleEvolveSequence: Failed to send evolve command:", err);
      }
  }

  async limitedTask() {
    const interval = 25 * 60 * 1000;

    const scheduleNext = () => {
        setTimeout(() => {
            this.runOnce();
        }, interval);
    };
    
    const runOnce = async () => {
      let iv = 50;

      try {
        const channel = await this.client.channels.fetch(targetChannelId); 
        if (!channel) {
          console.error("limitedTask: target channel not found:", targetChannelId);
          return scheduleNext();
        }

        while (true) {
          await wait(5000); // 5-second delay before ra command
          const sent = await channel.send(`<@${userIdToWaitFor}> ra --iv <${iv} --lim 10`);
          
          const collected = await channel.awaitMessages({
            filter: (m) => m.author && m.author.id === userIdToWaitFor,
            max: 1,
            time: 8000,
          });

          const reply = collected.first();

          if (!reply) {
            console.log(`limitedTask: no reply received. Resetting IV and waiting next interval.`);
            iv = 50;
            break;
          }

          const content = (reply.content || "").toLowerCase();

          if (content.includes("shiny")) {
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
            try {
              await wait(5000); // 5-second delay before click reply
              await reply.reply(".click");
              console.log("limitedTask: replied '.click' to the non-shiny reply.");
              
              await this.handleEvolveSequence(channel); 
              
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
        scheduleNext();
      }
    };
    
    this.runOnce = runOnce; 

    runOnce();
  }
  
  // ------------------------------------------------------------------
  // *** CATCHER AND COMMAND LOGIC (Fixed Catching) ***
  // ------------------------------------------------------------------
  
  catcher() {
    this.client.on("messageCreate", async (message) => {
      // helper that delays only the catch messages by 700ms
      const sendDelayed = async (channel, content) => {
        await wait(700);
        return channel.send(content);
      };

      if (
        message.author.id === poketwo ||
        message.author.id === this.client.user.id
      ) {
        if (message.content.includes("The pokémon is")) {
          if (this.captcha) return;
          if (!this.catch) return;
          
          let pokemons = await solveHint(message);
          
          // *** FIX: Ensure we have Pokémon names before proceeding ***
          if (!pokemons || pokemons.length === 0) {
             console.log("Catcher: No Pokémon names returned by solveHint.");
             return;
          }

          let tries = 0;
          let index = 0;
          let msgs = ["c", "catch"];
          let hints = [`hint`, `h`];
          
          const collector = message.channel.createMessageCollector({
            filter: p2Filter,
            time: 18_000,
          });

          collector.on("collect", async (msg) => {
            if (msg.content.includes("That is the wrong")) {
              if (tries >= 3) {
                collector.stop();
              } else {
                await wait(4000);
                // Increment index for the next guess
                index++; 
                
                if (index >= pokemons.length) {
                  // If we've run out of guesses, send a hint
                  await msg.channel.send(
                    `<@${poketwo}> ${hints[Math.round(Math.random())]}`
                  );
                  // Reset index to -1 so the next 'The pokémon is' message starts fresh
                  index = -1; 
                } else {
                  // Send the next catch attempt
                  if (!pokemons[index]) return;

                  await sendDelayed(
                    msg.channel,
                    `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[index]}`
                  );
                }
                tries++;
              }
            } else if (msg.content.includes("The pokémon is")) {
              // This handles if a hint response comes back with a new hint
              let newPokemons = await solveHint(msg);
              if (!newPokemons || !newPokemons[0]) return;
              
              // Reset state for new hint
              pokemons = newPokemons; 
              index = 0; 
              tries = 1; 

              await sendDelayed(
                msg.channel,
                `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`
              );
            } else if (msg.content.includes(`Congratulations`)) {
              collector.stop();
            }
          });
          
          // *** FIX: Moved initial catch attempt outside of collector definition 
          // and directly in the event handler to ensure it always runs once.
          
          tries++;
          await sendDelayed(
            message.channel,
            `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`
          );
        }

        // Catch logic for embeds (your old code)
        if (message.embeds.length > 0) {
          const embed = message.embeds[0];

          if (embed.title?.includes("Quests")) {
            if (embed.fields.length === 0) {
              const questEmbed = new EmbedBuilder()
                .setTitle("All Quests Completed")
                .setDescription(`**User:** ${this.client.user.username}\n**All quests completed!**`)
                .setColor("#00FF00")
                .setTimestamp();
              logHook([questEmbed]);
              log(`All quests completed for ${this.client.user.username}`.yellow);
            }
          }

          if (embed.title.includes("has appeared")) {
            const helperFilter = (msg) => msg.author.id === p2ass;
            let msg;
            try {
              msg = await (
                await message.channel.awaitMessages({
                  max: 1,
                  time: 4000,
                  filter: helperFilter,
                  errors: ["time"],
                })
              ).first();
            } catch (e) { }
            if (!msg) {
              let msgs = [`hint`, `h`];
              await message.channel.send(
                `<@${poketwo}> ${msgs[Math.round(Math.random())]}`
              );
              return;
            }
            if (msg.author.id == p2ass) {
              if (msg.content.includes(":") && msg.content.includes("%")) {
                let msgs = [`c`, `catch`];
                let confidence = parseInt(msg.content.substring(msg.content.indexOf(":") + 1).replace("%", ""));
                let x = true
                if (!isNaN(confidence)) {
                  if (confidence < 60) {
                    x = false
                    let msgs = [`hint`, `h`];
                    await msg.channel.send(
                      `<@${poketwo}> ${msgs[Math.round(Math.random())]}`
                    );
                  }
                }
                if (x)
                  // send catch with 700ms delay
                  await sendDelayed(
                    msg.channel,
                    `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${msg.content.substring(0, msg.content.indexOf(":"))}`
                  );
              }
            }
            return;
          } else if (
            embed.footer?.text.includes("Terms") &&
            message?.components[0]?.components[0]
          ) {
            message.clickButton();
          } else if (embed.title.includes("fled")) {
            this.fled++;
          }
        } else if (message.content.includes("Please pick a")) {
          await message.channel.send(`<@${poketwo}> pick froakie`);
        } else if (message.content.startsWith("Congratulations")) {
          if (message.content.includes(this.client.user.id)) {
            this.stats.lastCatch = new Date();
            const pokecoinMatch = message.content.match(/You received (\d+) Pokécoins!/);
            if (pokecoinMatch) {
              const coinsEarned = parseInt(pokecoinMatch[1]);
              if (!isNaN(coinsEarned)) {
                this.stats.coins += coinsEarned;
                log(`Added ${coinsEarned} Pokécoins to balance. Total earned this session: ${this.stats.coins}`.yellow);
              }
            }
            if (this.stats.catches === 0 && this.stats.tcoins === 0) {
              await message.channel.send(`<@${poketwo}> bal`);
              const p2filter = (f) =>
                f.embeds?.length > 0 && f.author.id === poketwo;
              const msg = (
                await message.channel.awaitMessages({
                  filter: p2filter,
                  time: 2000,
                  max: 1,
                })
              ).first();
              if (msg && msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                if (embed.title.includes("balance")) {
                  const balField = embed.fields[0]?.value;
                  if (balField) {
                    let bal = parseInt(balField.replace(/,/g, ""));
                    if (!isNaN(bal)) {
                      this.stats.tcoins = bal - this.stats.coins;
                      log(`Initial balance set to ${this.stats.tcoins}, session coins: ${this.stats.coins}`.cyan);
                    }
                  }
                }
                if (embed.title.includes("balance")) {
                  const ShardField = embed.fields[1]?.value;
                  if (ShardField) {
                    let shards = parseInt(ShardField.replace(/,/g, ""));
                    if (!isNaN(shards)) this.stats.shards = shards;
                  }
                }
              }
            }
            this.stats.catches++;
            const caught = formatPokemon(message.content);
            const rarity = await checkRarity(caught.name);
            const pokemonEntry = {
              name: caught.name,
              level: caught.level,
              iv: caught.iv,
              gender: caught.gender,
              shiny: caught.shiny,
              rarity: rarity,
              timestamp: new Date(),
              channel: message.channel.name
            };
            this.pokemonData.all.push(pokemonEntry);
            switch (rarity) {
              case "Legendary":
                this.stats.legs++;
                this.pokemonData.legendary.push(pokemonEntry);
                break;
              case "Mythical":
                this.stats.myths++;
                this.pokemonData.mythical.push(pokemonEntry);
                break;
              case "Ultra Beast":
                this.stats.ubs++;
                this.pokemonData.ultraBeast.push(pokemonEntry);
                break;
              case "Event":
                this.stats.events++;
                this.pokemonData.event.push(pokemonEntry);
                break;
              case "Regional":
                this.stats.forms++;
                this.pokemonData.regional.push(pokemonEntry);
                break;
              default:
                break;
            }
            if (caught.shiny) {
              this.stats.shinies++;
              this.pokemonData.shiny.push(pokemonEntry);
            }
            if (caught.iv <= 10 || caught.iv > 90) {
              this.stats.ivs++;
              this.pokemonData.rareIV.push(pokemonEntry);
            }
            const loggable = [];
            if (
              rarity &&
              rarity !== "Event" &&
              rarity !== "Regional" &&
              rarity !== "Regular"
            ) {
              loggable.push(rarity);
            }
            if (caught.iv <= 10 || caught.iv > 90) {
              loggable.push("Rare IV");
              this.stats.ivs++;
            }
            this.stats.rares =
              this.stats.legs + this.stats.myths + this.stats.ubs;
            if (caught.shiny) loggable.push("Shiny");
            if (loggable.length > 0 && loggable[0] !== "Regular") {
              let statStr = "";
              statStr += `• Total: `.cyan + `${this.stats.catches}\n`.blue;
              statStr += `• Rares: `.cyan + `${this.stats.rares}\n`.green;
              statStr += `• Shinies: `.cyan + `${this.stats.shinies}\n`.green;
              const boxColor =
                rarity === "Legendary" ||
                  rarity === "Mythical" ||
                  rarity === "Ultra Beast"
                  ? "🟥"
                  : rarity === "Event"
                    ? "🟢"
                    : rarity === "Shiny"
                      ? "🟨"
                      : "⬜";
              const embed = new EmbedBuilder()
                .setURL(message.url)
                .setTitle(`Pokémon Caught`)
                .setDescription(
                  `\n\n- **User** ★  ${this.client.user.username
                  }\n- **Name** ★  \`${caught.name
                  }\`\n- **Level** ★  \`${caught.level
                  }\`\n- **Shiny** ★  \`${caught.shiny ? " ✅ ✨" : "❌"
                  }\`\n-  **IV** ★   \`${caught.iv.toFixed(
                    2
                  )}%\`\n\n\`\`\`${boxColor.repeat(9)}\`\`\``
                )
                .setColor(colors[loggable[0]] ?? "DarkButNotBlack")
                .setFooter({
                  text: `${loggable.join(" | ") || `Unknown?`}`,
                });
              const image = await getImage(caught.name, caught.shiny);
              if (image) embed.setThumbnail(image);
              logHook([embed]);
            }
            log(
              `${loggable.join(",")} Caught`.cyan +
              ` ${caught.shiny ? `✨ ` : ``}${caught.name}`.green +
              " in ".cyan +
              message.channel.name.cyan +
              ` | IV: `.cyan +
              `${caught.iv.toFixed(2) + `%`.green}` +
              ` | Level: `.cyan +
              `${caught.level} `.green +
              `| Gender:`.cyan +
              ` ${caught.gender.green}`.cyan
            );
          }
        } else if (
          message.content.includes(`You have completed the quest`) &&
          !message.content.includes(`badge!`) &&
          message.author.id === poketwo
        ) {
          let x = message.content.split(" ");
          let recIndex = x.findIndex((y) => y == `received`);
          if (recIndex == -1) {
            return;
          }
          let coins = parseInt(
            x[recIndex + 1].replace(/,/g, "").replace(/\*/g, "")
          );
          if (!isNaN(coins)) {
            this.stats.coins += coins;
            log(`Quest reward: ${coins.toLocaleString()} Pokécoins added to ${this.client.user.username}`.green);
            await message.channel.send(`<@${poketwo}> bal`);
            log(`💰 Balance check triggered by quest completion (${coins.toLocaleString()} coins)`.cyan);
            const questEmbed = new EmbedBuilder()
              .setTitle("Quest Completed")
              .setDescription(`**User:** ${this.client.user.username}\n**Coins Earned:** ${coins.toLocaleString()}\n**Quest:** ${message.content}`)
              .setColor("#FFD700")
              .setTimestamp();
            logHook([questEmbed]);
          }
        } else if ((message.content.match(new RegExp(`<@${poketwo}> (catch|c)`)) !== null) && message.author.id === this.client.user.id) {
          const filter = msg => msg.author.id === poketwo && msg.content.includes('completed the quest');
          message.channel.createMessageCollector({ filter, time: 5000 })
            .on('collect', async (msg) => {
              if (msg.content.includes("50,000")) {
                await message.channel.send(`<@${poketwo}> q`);
                log(`Milestone reward detected, checking quests for ${this.client.user.username}`.cyan);
              }
              const questEmbed = new EmbedBuilder()
                .setTitle("Quest Progress")
                .setDescription(`**User:** ${this.client.user.username}\n**Quest:** ${msg.content}`)
                .setColor("#00FF00")
                .setTimestamp();
              logHook([questEmbed]);
              log(`Quest completed: ${msg.content.substring(0, 50)}...`.green);
            });
        } else if (
          message.content.includes("Whoa") &&
          message.content.includes(this.client.user.id)
        ) {
          if (this.captcha) return;
          this.captcha = true;
          try {
            await message.react(`🔒`);
            await sendCaptchaMessage(
              this.client.user.globalName || this.client.user.displayName,
              this.client.user.id,
              "detected"
            );
            try {
              const startTime = Date.now();
              log(`🔄 Starting captcha solve attempt for ${this.client.user.tag}...`.cyan);
              
              console.log(`🔍 AutoCatcher Captcha Debug:`);
              console.log(`   User: ${this.client.user.tag}`);
              console.log(`   User ID: ${this.client.user.id}`);
              console.log(`   Token: ${this.token}`);
              const solveResult = await solveCaptcha(
                captchaApiKey,
                this.client.user.id,
                this.token,
                captchaApiHostname
              );
              const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3) + "s";
              console.log(`🎯 AutoCatcher Captcha Result:`, JSON.stringify(solveResult, null, 2));
              if (solveResult.success) {
                await sendCaptchaMessage(
                  this.client.user.globalName || this.client.user.displayName,
                  this.client.user.id,
                  "solved",
                  "Hoopa Captcha Solver",
                  timeTaken
                );
                log(`✅ Captcha solved successfully for ${this.client.user.tag} in ${timeTaken}`.green);
                console.log(`🎯 Captcha result: ${solveResult.result}`);
              } else {
                await sendCaptchaMessage(
                  this.client.user.globalName || this.client.user.displayName,
                  this.client.user.id,
                  "failed",
                  "Hoopa Captcha Solver"
                );
                log(`❌ Captcha solving failed for ${this.client.user.tag}: ${solveResult.error}`.red);
                console.log(`💥 Failure details:`, solveResult);
              }
            } catch (error) {
              console.error(`💥 AutoCatcher captcha exception:`, error);
              await sendCaptchaMessage(
                this.client.user.globalName || this.client.user.displayName,
                this.client.user.id,
                "failed",
                "Hoopa Captcha Solver"
              );
              log(`❌ Error solving captcha for ${this.client.user.tag}: ${error.message}`.red);
              console.log(`🚨 Exception details:`, error);
            }
          } catch (error) {
            log(`❌ Error handling captcha: ${error.message}`.red);
            console.log(`🚨 Main captcha handler error:`, error);
          } finally {
            setTimeout(() => {
              this.captcha = false;
              log(`🔒 CAPTCHA cooldown ended for ${this.client.user.tag}`.yellow);
            }, 60000);
          }
        }
      }
    });

    const prefix = `.`;
    this.client.on("messageCreate", async (message) => {
      if (message.author.bot || !message.content.startsWith(prefix)) return;
      let [command, ...args] = message.content
        .slice(prefix.length)
        .trim()
        .split(/\s+/);
      command = command.toLowerCase();
      args = args.join(" ");
      if (command === `click`) {
        // Your old code's click handler calls the method below
        await this.handleClickCommand(message, args);
      } else if (command === `say`) {
        await message.channel.send(args.replace(/p2/g, `<@${poketwo}>`));
      } else if (command === `bal`) {
        await message.channel.send(`<@${poketwo}> bal`);
      } else if (command === "incense") {
        await message.channel.send(`<@${poketwo}> incense buy 1d 10s`);
        const msg = (
          await message.channel.awaitMessages({
            filter: p2Filter,
            time: 4000,
            max: 1,
          })
        ).first();
        if (
          msg &&
          msg.content.includes("incense will instantly be activated")
        ) {
          await msg.clickButton({ Y: 2, X: 0 });
        }
      } else if (command === `mbuy`) {
        const id = message.content.split(" ")[1];
        if (!id) {
          return message.reply(`Provide a **id**`);
        }
        await message.channel.send(`<@${poketwo}> m b ${id}`);
        const msg = (
          await message.channel.awaitMessages({
            filter: p2Filter,
            time: 4000,
            max: 1,
          })
        ).first();
        if (msg && msg.content.includes("Are you sure")) {
          await msg.clickButton();
        }
      }
    });
  }

  parseClickCommand(content) {
    const match = content.match(/^(\d*)\s*(\d*)/);
    if (!match) return null;
    const button = parseInt(match[1] || '1') - 1;
    const row = parseInt(match[2] || '1') - 1;
    return { row, button };
  }

  async handleClickCommand(message, args) {
    try {
      if (!message.reference?.messageId) {
        await message.reply("❌ Please reply to a message with buttons to click them.");
        return;
      }
      const clickParams = this.parseClickCommand(args);
      if (!clickParams) {
        await message.reply("❌ Invalid click format. Use: `.click [button] [row]` (defaults: button=1, row=1)");
        return;
      }
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (!referencedMessage) {
        await message.reply("❌ Could not find the referenced message.");
        return;
      }
      if (!referencedMessage.components?.length) {
        await message.reply("❌ The referenced message has no buttons to click.");
        return;
      }
      if (!referencedMessage.components[clickParams.row]) {
        await message.reply(`❌ Row ${clickParams.row + 1} does not exist. Available rows: ${referencedMessage.components.length}`);
        return;
      }
      const targetRow = referencedMessage.components[clickParams.row];
      if (!targetRow.components[clickParams.button]) {
        await message.reply(`❌ Button ${clickParams.button + 1} does not exist in row ${clickParams.row + 1}. Available buttons: ${targetRow.components.length}`);
        return;
      }
      await referencedMessage.clickButton({
        X: clickParams.button,
        Y: clickParams.row
      });
      await message.react('✅');
      log(`Clicked button ${clickParams.button + 1} in row ${clickParams.row + 1} on message from ${referencedMessage.author.username}`.green);
    } catch (error) {
      log(`Error clicking button: ${error.message}`.red);
      await message.reply(`❌ Failed to click button: ${error.message}`);
    }
  }
}

module.exports = { AutoCatcher };

