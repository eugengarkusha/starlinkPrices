const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { countries } = require("./countries");
const {
  mergeHistory,
  getPastNResults,
  saveLastResult,
  getDiff,
} = require("./history");
const { buildHtmlTable } = require("./buildHtmlTable");
const {
  failedToFetch,
  getCurrencyRates,
  withRetries,
  yesterday,
} = require("./utils");
const { fetch } = require("./fetch");
const fs = require("fs");

const outDir = process.env.OUT_DIR || ".";

// how to get tgChatId:
// send message /my_id @bot_username in the group
// https://api.telegram.org/bot${key}/getUpdates - see chat id response
const tgChatId = process.env.TG_CHAT_ID;
const apiKey = process.env.TG_BOT_API_KEY;
const currencyApiKey =
  process.env.CURRENCY_API_KEY ||
  (() => {
    throw new Error("missing CURRENCY_API_KEY");
  })();

console.log("countries=" + countries);
console.log("outDir=" + outDir);

//save to executable path
const { executablePath } = require("puppeteer");
const { sendTelegramUpdate } = require("./telegramUpdates");

// Use stealth
puppeteer.use(pluginStealth());

// Launch puppеteer-stealth
puppeteer
  .launch({
    headless: true,
    //flags required to run in docker (WARN: --no-sandbox can pose sec risk)
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    executablePath: executablePath(),
  })
  .then(async (browser) => {
    const rates = await getCurrencyRates(currencyApiKey);
    console.log("rates=" + JSON.stringify(rates, undefined, 4));

    let results = {};
    // reusing one page for all countries (looks like it reduces cpu load)
    let page = undefined;
    try {
      for (const country of countries) {
        const now = new Date();
        console.log(`processing country ${country}`);
        let result = failedToFetch(now);
        try {
          result = await withRetries(
            async () => {
              if (!page || page.isClosed()) page = await browser.newPage();
              return await fetch(outDir, country, page, rates, now);
            },
            3,
            15000,
          );
        } catch (e) {
          console.log(`Failed to fetch result for ${country}, ${e}`);
        }
        if (result === undefined) throw new Error("unexpected undefined value");
        console.log(`result = ${JSON.stringify(result, undefined, 4)}`);
        results[country] = result;
      }
    } finally {
      try {
        await page?.close();
      } catch (e) {
        console.log(`Failed to close page, ${e}`);
      }
    }

    const now = new Date();

    console.log("results=" + JSON.stringify(results, undefined, 4));
    saveLastResult(outDir, results, now);

    const mergedPrevResults = mergeHistory(
      getPastNResults(outDir, 30, yesterday(now)),
    );
    const mergedResults = Object.entries(
      mergeHistory([results, mergedPrevResults]),
    );

    // sort by price ASC, not_available wins over failed_to_fetch, fallback to lex sort on country
    mergedResults.sort(([country1, v1], [country2, v2]) => {
      const score = (v) =>
        v.kind === "available"
          ? v.price
          : v.kind === "not_available"
          ? Number.MAX_VALUE / 2
          : Number.MAX_VALUE;

      const res = score(v1) - score(v2);
      return res === 0 ? country1.localeCompare(country2) : res;
    });

    console.log(
      `mergedResults = ${JSON.stringify(mergedResults, undefined, 4)}`,
    );

    fs.writeFileSync(
      `${outDir}/result.html`,
      buildHtmlTable(mergedResults, now),
    );

    if (apiKey && tgChatId)
      await sendTelegramUpdate(
        apiKey,
        tgChatId,
        getDiff(mergedPrevResults, results),
      );
    else
      console.log(
        "skipping tg updates, TG_BOT_API_KEY or TG_BOT_API_KEY env var is not defined",
      );
    // Close the browser
    await browser.close();
  });
