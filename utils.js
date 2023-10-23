const https = require("https");

module.exports = {
  notAvailable: (country) => ({ kind: "not_available", country }),
  failedToFetch: (country) => ({ kind: "failed_to_fetch", country }),
  available: (country, currency, price, isRefurbed) => ({
    kind: "available",
    country,
    currency,
    price,
    isRefurbed,
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
    const base_currency = "EUR";
    const currencies =
      "NOK,PLN,RON,HUF,ISK,DKK,CZK,BGN,SEK,CHF,GBP,USD,CAD,MXN";
    const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${apiKey}&base_currency=${base_currency}&currencies=${currencies}`;
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
  },
};
