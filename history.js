const _ = require("lodash");
const fs = require("fs");
const { yesterday, createDirIfNotExists } = require("./utils");
module.exports = {
  // finds non-equal objects by structural equality, ignoring timestamp, converted currency and converted price
  getDiff(prev, next) {
    const removeVolatileFields = (obj) => ({
      ...obj,
      ...{
        timestamp: undefined,
        convertedCurrency: undefined,
        convertedPrice: undefined,
      },
    });
    const countries = _.uniq([...Object.keys(prev), ...Object.keys(next)]);
    return countries
      .map((country) => {
        const prevVal = prev[country];
        const nextVal = next[country];
        if (
          !_.isEqual(
            removeVolatileFields(prevVal),
            removeVolatileFields(nextVal),
          )
        ) {
          return { country, prev: prevVal, next: nextVal };
        }
      })
      .filter(Boolean);
  },

  // walk the history back in time and recover from failed_to_fetch values if possible
  // history is array of price-fetch-result objects ordered by fetch time desc
  mergeHistory(history) {
    let res = history[0];
    if (!res) return {};
    else {
      let failedToFetchCountries = Object.entries(res)
        .map(([c, v]) => v.kind === "failed_to_fetch" && c)
        .filter(Boolean);
      for (const h of _.tail(history)) {
        for (const c of failedToFetchCountries) {
          const priceObj = h[c];
          if (priceObj && priceObj?.kind !== "failed_to_fetch") {
            res[c] = priceObj;
            failedToFetchCountries = failedToFetchCountries.filter(
              (cc) => cc !== c,
            );
          }
        }
      }
    }

    return res;
  },
  buildFileDir(basePath, date) {
    return `${basePath}/results/${date.getUTCFullYear()}/${date.getUTCMonth()}`;
  },
  buildFileName(date) {
    return date.getUTCDate() + ".json";
  },
  // returns results ordered form by date desc, fromDate is included
  saveLastResult: (outDir, resJson, now) => {
    const fileDir = self.buildFileDir(outDir, now);
    const fileName = self.buildFileName(now);
    createDirIfNotExists(fileDir);
    fs.writeFileSync(
      `${fileDir}/${fileName}`,
      JSON.stringify(resJson, undefined, 4),
    );
  },
  getPastNResults(basePath, n, fromDate) {
    results = [];
    for (let i = n, date = fromDate; i > 0; i--, date = yesterday(date)) {
      const path = [
        self.buildFileDir(basePath, date),
        self.buildFileName(date),
      ].join("/");
      fs.cure;
      if (fs.existsSync(path)) {
        results.push(JSON.parse(fs.readFileSync(path).toString()));
      }
    }
    return results;
  },
};
self = module.exports;
