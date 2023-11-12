const https = require("https");
const fs = require("fs");

module.exports = {
  notAvailable: (timestamp) => ({ kind: "not_available", timestamp }),
  failedToFetch: (timestamp) => ({ kind: "failed_to_fetch", timestamp }),
  available: (
    currency,
    price,
    convertedCurrency,
    convertedPrice,
    isRefurbed,
    timestamp,
  ) => ({
    kind: "available",
    currency,
    price,
    convertedCurrency,
    convertedPrice,
    isRefurbed,
    timestamp,
  }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  withRetries: async (f, attempts, pauseMs, e) => {
    if (attempts === 0) {
      throw e || new Error(`retries exceeded`);
    } else {
      try {
        return await f();
      } catch (e) {
        const attemptsLeft = attempts - 1;
        console.log(
          `retrying after ${pauseMs} millis, err:${e}. Attempts left = ${attemptsLeft}`,
        );
        await module.exports.sleep(pauseMs);
        return await module.exports.withRetries(f, attemptsLeft, pauseMs, e);
      }
    }
  },

  getCurrencyRates: async (apiKey) => {
    // const base_currency = "EUR";
    // const currencies =
    //   "NOK,PLN,RON,HUF,ISK,DKK,CZK,BGN,SEK,CHF,GBP,USD,CAD,MXN";
    // const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${apiKey}&base_currency=${base_currency}&currencies=${currencies}`;
    // const rates = await new Promise((resolve, reject) => {
    //   let data = [];
    //   https
    //     .get(url, (res) => {
    //       res.on("data", (chunk) => {
    //         data.push(chunk);
    //       });
    //
    //       res.on("end", () => {
    //         const dataStr = Buffer.concat(data).toString();
    //         if (res.statusCode >= 300 || res.statusCode < 200)
    //           reject(
    //             new Error(
    //               `cant fetch currencies code: ${res.statusCode}, err:${dataStr}`,
    //             ),
    //           );
    //         else resolve(JSON.parse(dataStr));
    //       });
    //     })
    //     .on("error", (err) => {
    //       console.log(
    //         "Error during api request to fetch currencies: ",
    //         err.message,
    //       );
    //       reject(err);
    //     });
    // });

    const rates = {
      data: {
        BGN: 1.9562314647,
        // "CAD": 1.4666825129,
        CHF: 0.9654640035,
        CZK: 24.4243217269,
        DKK: 7.4590389731,
        GBP: 0.8675026768,
        HUF: 378.424007658,
        ISK: 149.2528847274,
        MXN: 18.7194182891,
        NOK: 11.8472883208,
        PLN: 4.4524474521,
        RON: 4.9747504583,
        SEK: 11.6790741945,
        // "USD": 1.0735487111,
        "£": 0.8675026768,
        CA$: 1.4666825129,
        MKD: 61.62,
        GEL: 2.89,
      },
    };
    if (!rates.data) throw new Error("cant fetch rates");
    else {
      rates.data["£"] = rates.data["GBP"];
      rates.data["$"] = rates.data["USD"];
      rates.data["CA$"] = rates.data["CAD"];
      // TODO: freecurrencyapi.com does not support these
      rates.data["MKD"] = 61.62; //Macedonia
      rates.data["GEL"] = 2.89; // Georgia
      return rates.data;
    }
  },
  truncateToDay: (date) =>
    new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  yesterday: function (date) {
    return new Date(date.getTime() - module.exports.oneDayMillis);
  },
  oneDayMillis: 24 * 60 * 60 * 1000,
  createDirIfNotExists: (path) => {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
  },
};
