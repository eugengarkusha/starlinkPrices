const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { countries } = require("./countries");
const {
  mergeHistory,
  buildFileDir,
  buildFileName,
  getPastNResults,
} = require("./history");
const { buildHtmlTable } = require("./buildHtmlTable");
const {
  failedToFetch,
  getCurrencyRates,
  withRetries,
  createDirIfNotExists,
  yesterday,
} = require("./utils");
const { fetch } = require("./fetch");
const fs = require("fs");

const outDir = process.env.OUT_DIR || ".";
const currencyApiKey =
  process.env.CURRENCY_API_KEY ||
  (() => {
    throw new Error("missing CURRENCY_API_KEY");
  })();

console.log("countries=" + countries);
console.log("outDir=" + outDir);

//save to executable path
const { executablePath } = require("puppeteer");

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
    for (const country of countries) {
      console.log(`processing country ${country}`);
      let result = failedToFetch;
      const page = await browser.newPage();
      try {
        result = await withRetries(
          () => fetch(outDir, country, page, rates),
          4,
          15000,
        );
      } catch (e) {}
      await page.close();

      if (result === undefined) throw new Error("unexpected undefined value");
      console.log(`result = ${JSON.stringify(result, undefined, 4)}`);
      results[country] = result;
    }

    const now = new Date();

    const resStr = JSON.stringify(results, undefined, 4);
    console.log("results=" + resStr);
    const fileDir = buildFileDir(outDir, now);
    createDirIfNotExists(fileDir);
    fs.writeFileSync(`${fileDir}/${buildFileName(now)}`, resStr);

    const lastNRes = getPastNResults(outDir, 30, yesterday(now))

    const mergedResult = Object.entries(
      mergeHistory([results, ...lastNRes]),
    );

    // sort by price ASC, not_available wins over failed_to_fetch, fallback to lex sort on country
    mergedResult.sort(([country1, v1], [country2, v2]) => {
      const score = (v) =>
        v.kind === "available"
          ? v.price
          : v.kind === "not_available"
          ? Number.MAX_VALUE / 2
          : Number.MAX_VALUE;

      const res = score(v1) - score(v2);
      return res === 0 ? country1.localeCompare(country2) : res;
    });

    console.log("mergedResult=" + JSON.stringify(mergedResult));
    fs.writeFileSync(
      `${outDir}/result.html`,
      buildHtmlTable(mergedResult, new Date()),
    );

    // Close the browser
    await browser.close();
  });

//TODO: diff updates: dont update when price diff is < 20
