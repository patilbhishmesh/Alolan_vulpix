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

class AutoCatcher {

  constructor(token) {

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

    });

  }

  catcher() {

    this.client.on("messageCreate", async (message) => {

      if (

        message.author.id === poketwo ||

        message.author.id === this.client.user.id

      ) {

        if (message.content.includes("The pokémon is")) {

          if (this.captcha) return;

          if (!this.catch) return;

          let pokemons = await solveHint(message);

          if (!pokemons || !pokemons.length || pokemons[0] === undefined) return;

          let tries = 0, index = 0;

          let msgs = ["c", "catch"];

          const collector = message.channel.createMessageCollector({

            filter: p2Filter,

            time: 18_000,

          });

          collector.on("collect", async (msg) => {

            if (msg.content.includes("That is the wrong")) {

              if (tries == 3) {

                collector.stop();

              } else {

                await wait(4000);

                index++;

                if (index >= pokemons.length) {

                  collector.stop();

                  return;

                }

                await msg.channel.send(

                  `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[index]}`

                );

              }

            } else if (msg.content.includes("The pokémon is")) {

              let pokemons = await solveHint(msg);

              if (!pokemons || !pokemons.length || pokemons[0] === undefined) return;

              let msgs = ["c", "catch"];

              await msg.channel.send(

                `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`

              );

              tries++;

            } else if (msg.content.includes(`Congratulations`)) {

              collector.stop();

            }

          });

          await message.channel.send(

            `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`

          );

          tries++;

        }

        if (message.embeds.length > 0) {

          const embed = message.embeds[0];

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

            if (!msg) return;

            if (msg.author.id == p2ass) {

              if (msg.content.includes(":") && msg.content.includes("%")) {

                let confidence = parseInt(msg.content.substring(msg.content.indexOf(":") + 1).replace("%", ""));

                if (isNaN(confidence) || confidence < 60) return;

                let msgs = [`c`, `catch`];

                await msg.channel.send(

                  `<@${poketwo}> ${msgs[Math.round(Math.random())]

                  } ${msg.content.substring(0, msg.content.indexOf(":"))}`

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

              case "Legendary": this.stats.legs++; this.pokemonData.legendary.push(pokemonEntry); break;

              case "Mythical": this.stats.myths++; this.pokemonData.mythical.push(pokemonEntry); break;

              case "Ultra Beast": this.stats.ubs++; this.pokemonData.ultraBeast.push(pokemonEntry); break;

              case "Event": this.stats.events++; this.pokemonData.event.push(pokemonEntry); break;

              case "Regional": this.stats.forms++; this.pokemonData.regional.push(pokemonEntry); break;

            }

            if (caught.shiny) {

              this.stats.shinies++;

              this.pokemonData.shiny.push(pokemonEntry);

            }

            if (caught.iv <= 10 || caught.iv > 90) {

              this.stats.ivs++;

              this.pokemonData.rareIV.push(pokemonEntry);

            }

            this.stats.rares =

              this.stats.legs + this.stats.myths + this.stats.ubs;

          }

        }

      }

    });

    const prefix = `?`;

    this.client.on("messageCreate", async (message) => {

      if (message.author.bot || !message.content.startsWith(prefix)) return;

      let [command, ...args] = message.content

        .slice(prefix.length)

        .trim()

        .split(/\s+/);

      command = command.toLowerCase();

      args = args.join(" ");

      if (command === `click`) {

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

module.exporconst { Client } = require("discord.js-selfbot-v13");

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

class AutoCatcher {

  constructor(token) {

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

    });

  }

  catcher() {

    this.client.on("messageCreate", async (message) => {

      if (

        message.author.id === poketwo ||

        message.author.id === this.client.user.id

      ) {

        if (message.content.includes("The pokémon is")) {

          if (this.captcha) return;

          if (!this.catch) return;

          let pokemons = await solveHint(message);

          if (!pokemons || !pokemons.length || pokemons[0] === undefined) return;

          let tries = 0, index = 0;

          let msgs = ["c", "catch"];

          const collector = message.channel.createMessageCollector({

            filter: p2Filter,

            time: 18_000,

          });

          collector.on("collect", async (msg) => {

            if (msg.content.includes("That is the wrong")) {

              if (tries == 3) {

                collector.stop();

              } else {

                await wait(4000);

                index++;

                if (index >= pokemons.length) {

                  collector.stop();

                  return;

                }

                await msg.channel.send(

                  `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[index]}`

                );

              }

            } else if (msg.content.includes("The pokémon is")) {

              let pokemons = await solveHint(msg);

              if (!pokemons || !pokemons.length || pokemons[0] === undefined) return;

              let msgs = ["c", "catch"];

              await msg.channel.send(

                `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`

              );

              tries++;

            } else if (msg.content.includes(`Congratulations`)) {

              collector.stop();

            }

          });

          await message.channel.send(

            `<@${poketwo}> ${msgs[Math.round(Math.random())]} ${pokemons[0]}`

          );

          tries++;

        }

        if (message.embeds.length > 0) {

          const embed = message.embeds[0];

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

            if (!msg) return;

            if (msg.author.id == p2ass) {

              if (msg.content.includes(":") && msg.content.includes("%")) {

                let confidence = parseInt(msg.content.substring(msg.content.indexOf(":") + 1).replace("%", ""));

                if (isNaN(confidence) || confidence < 60) return;

                let msgs = [`c`, `catch`];

                await msg.channel.send(

                  `<@${poketwo}> ${msgs[Math.round(Math.random())]

                  } ${msg.content.substring(0, msg.content.indexOf(":"))}`

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

              case "Legendary": this.stats.legs++; this.pokemonData.legendary.push(pokemonEntry); break;

              case "Mythical": this.stats.myths++; this.pokemonData.mythical.push(pokemonEntry); break;

              case "Ultra Beast": this.stats.ubs++; this.pokemonData.ultraBeast.push(pokemonEntry); break;

              case "Event": this.stats.events++; this.pokemonData.event.push(pokemonEntry); break;

              case "Regional": this.stats.forms++; this.pokemonData.regional.push(pokemonEntry); break;

            }

            if (caught.shiny) {

              this.stats.shinies++;

              this.pokemonData.shiny.push(pokemonEntry);

            }

            if (caught.iv <= 10 || caught.iv > 90) {

              this.stats.ivs++;

              this.pokemonData.rareIV.push(pokemonEntry);

            }

            this.stats.rares =

              this.stats.legs + this.stats.myths + this.stats.ubs;

          }

        }

      }

    });

    const prefix = `?`;

    this.client.on("messageCreate", async (message) => {

      if (message.author.bot || !message.content.startsWith(prefix)) return;

      let [command, ...args] = message.content

        .slice(prefix.length)

        .trim()

        .split(/\s+/);

      command = command.toLowerCase();

      args = args.join(" ");

      if (command === `click`) {

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

module.exports = { AutoCatcher };ts = { AutoCatcher };
