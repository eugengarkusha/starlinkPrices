const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { countries } = require("./countries");
const { buildHtmlTable } = require("./buildHtmlTable");
const https = require("https");
const fs = require("fs");

const outDir = process.env.OUT_DIR || ".";
const currencyApiKey =
  process.env.CURRENCY_API_KEY ||
  (() => {
    throw new Error("missing CURRENCY_API_KEY");
  })();

const notAvailable = (country) => ({ kind: "not_available", country });
const failedToFetch = (country) => ({ kind: "failed_to_fetch", country });
const available = (country, currency, price) => ({
  kind: "available",
  country,
  currency,
  price,
});

console.log("countries=" + countries);
console.log("outDir=" + outDir);

//save to executable path
const { executablePath } = require("puppeteer");

// Use stealth
puppeteer.use(pluginStealth());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetries(f, retries, pauseMs, e) {
  if (retries === 0)
    if (e) {
      throw e;
    } else {
      throw new Error(`retries exceeded`);
    }
  else {
    try {
      return await f();
    } catch (e) {
      console.log(`retrying after ${pauseMs} millis, err:${e}`);
      await sleep(pauseMs);
      return await withRetries(f, retries - 1, pauseMs, e);
    }
  }
}
async function test(country, page, rates) {
  // Set page view
  await page.setViewport({ width: 1280, height: 720 });

  // navigate to the website
  await page.goto("https://www.starlink.com/");

  // Wait for page to load
  await page.waitForSelector("#service-input-label");

  await page.type("#service-input-label", country);

  //How to inspect popup  On Mac:
  //1) past in console: setTimeout(() => { debugger }, 3000)
  //2)trigger popup
  //3) wait for debugger to ckick in and click shift+cmd+c to inspect elements.

  const countryXpath = `//span[contains(., '${country}')]`;
  await page.waitForXPath(countryXpath);
  await page.screenshot({
    path: `${outDir}/${country}_image_after_open_dropdown.png`,
  });
  const dropdownItems = await page.$x(countryXpath);

  if (dropdownItems[0]) {
    await dropdownItems[0].click();
    // wait while popup with address results disappears
    await page.waitForFunction(
      () => !document.querySelector("div[class='address-results']"),
    );
    await page.screenshot({
      path: `${outDir}/${country}_image_after_dropdown_clicked.png`,
    });
  } else
    throw new Error(
      `cant click dropdown ${dropdownItems.map((i) => JSON.stringify(i))}`,
    );

  const [button] = await page.$x("//button[contains(., 'ORDER')]");
  if (button) {
    await button.click();
  } else throw new Error("cant click ORDER button");

  await page.waitForNavigation().catch((e) => 0);
  console.log(page.url());
  // if failed to navigate to orders
  if (page.url().match("/deposit")) {
    return notAvailable(country);
  } else if (!page.url().match("/orders")) {
    const error = await page
      .waitForSelector("h3[aria-describedby='error-message']", {
        timeout: 3000,
      })
      .then((msg) => msg.evaluate((el) => el.textContent))
      .catch((e) => undefined);
    if (error) throw new Error(`Error when clicking 'order': ${error}`);
    const txt = await page
      .waitForSelector("p[class='ng-star-inserted']", { timeout: 3000 })
      .then((msg) => msg.evaluate((el) => el.textContent))
      .catch((e) => undefined);
    if (txt && txt.match("not available")) return notAvailable(country);
    else throw new Error("failed to route to /orders page for unknown reason");
  }
  await page.screenshot({
    path: `${outDir}/${country}_image_after_order_clicked.png`,
  });

  // when elected-price is loaded , all page is ready
  await page.waitForSelector(".selected-price");

  // searching for refurb price and assuming it is lower then normal price
  let price_elements = await page
    .$x(`//span[contains(@class, 'option-price')]`)
    .then((els) =>
      Promise.all(
        els.map(async (element) =>
          page.evaluate(
            (el) =>
              el.previousElementSibling.textContent.match("Refurb")
                ? el.textContent
                : undefined,
            element,
          ),
        ),
      ).then((arr) => arr.filter(Boolean)),
    );
  if (price_elements.length === 0) {
    const element = await page.$(".selected-price");
    const price_element = await page.evaluate((el) => el.textContent, element);
    const [_, price] = /and\s+(.+)\s+for hardware/.exec(price_element);
    price_elements = [price];
  }

  await page.screenshot({ path: `${outDir}/${country}_image_final.png` });

  let priceRes = undefined;
  let currencyRes = "€";
  for (const price of price_elements) {
    console.log("price=" + price);

    const [_all, currency, amount] = /([A-Z]{3}|£|\$|€)(\d+,?\d*)/.exec(price);
    const rate = rates[currency];
    const clenAmount = amount.replaceAll(",", "");
    const newPrice = rate
      ? Math.round(clenAmount / rate)
      : Math.round(clenAmount * 1);
    // assuming that all price option have same currency
    if (!rate) currencyRes = currency;

    if (priceRes === undefined || newPrice < priceRes) {
      priceRes = newPrice;
    }
  }

  return available(country, currencyRes, priceRes);
}
async function getRates() {
  const base_currency = "EUR";
  const currencies = "NOK,PLN,RON,HUF,ISK,DKK,CZK,BGN,SEK,CHF,GBP,USD,CAD,MXN";
  const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${currencyApiKey}&base_currency=${base_currency}&currencies=${currencies}`;
  const rates = await new Promise((resolve, reject) => {
    let data = [];
    https
      .get(url, (res) => {
        res.on("data", (chunk) => {
          data.push(chunk);
        });

        res.on("end", () => {
          const dataStr = Buffer.concat(data).toString();
          if (res.statusCode >= 300 || res.statusCode < 200)
            reject(
              new Error(
                `cant fetch currencies code: ${res.statusCode}, err:${dataStr}`,
              ),
            );
          else resolve(JSON.parse(dataStr));
        });
      })
      .on("error", (err) => {
        console.log(
          "Error during api request to fetch currencies: ",
          err.message,
        );
        reject(err);
      });
  });

  if (!rates.data) throw new Error("cant fetch rates");
  else {
    rates.data["£"] = rates.data["GBP"];
    rates.data["$"] = rates.data["USD"];
    rates.data["CA$"] = rates.data["CAD"];
    // TODO: use currency service that supports MKD
    rates.data["MKD"] = 61.61;
    return rates.data;
  }
}

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
    const rates = await getRates();
    console.log("rates=" + JSON.stringify(rates, undefined, 4));

    let results = [];
    for (const country of countries) {
      console.log(`processing country ${country}`);
      let result = failedToFetch(country);
      const page = await browser.newPage();
      try {
        result = await withRetries(() => test(country, page, rates), 2, 10000);
      } catch (e) {}
      await page.close();

      if (result === undefined) throw new Error("unexpected undefined value");
      console.log(`result = ${JSON.stringify(result, undefined, 4)}`);
      results.push(result);
    }

    results.sort((v1, v2) => {
      const res =
        v1.kind !== "available" && v2.kind !== "available"
          ? 0
          : v1.kind === "available" && v2.kind !== "available"
          ? 1
          : v1.kind !== "available" && v2.kind === "available"
          ? -1
          : v1.price - v2.price;

      res === 0 ? v1.country.localeCompare(v2.country) : res;
    });

    const resStr = JSON.stringify(results, undefined, 4);
    console.log("results=" + resStr);
    fs.writeFile(`${outDir}/result.json`, resStr, (err) => {
      if (err) {
        console.error(err);
      }
    });

    fs.writeFile(
      `${outDir}/result.html`,
      buildHtmlTable(results, new Date().toUTCString()),
      (err) => {
        if (err) {
          console.error(err);
        }
      },
    );

    // Close the browser
    await browser.close();
  });
