const _ = require("lodash");
const fs = require("fs");
const { yesterday } = require("./utils");
const path = require("path");
module.exports = {
  getDiff (prev, next)  {
    console.log("prev="+ JSON.stringify(prev))
    const coutries = [...Object.keys(prev), ...Object.keys(next)];
    return coutries
      .map((country) => {
        const prevVal = prev[country];
        const nextVal = next[country];

        return !_.isEqual(nextVal, prevVal) && { country, prevVal, nextVal };
      })
      .filter(Boolean);
  },
  getRelevantDiffEntries(diff)  {
   console.log("diff="+JSON.stringify(diff))
    const entries = diff.map(({ country, prev, next }) => [
      country,
      // picking next if prev is not defined(country added), next is not defined(country deleted) or prev is failed to fetch
        // TODO: when next is undef, it is not being saved to obj and cant serve as  as tombstone/ need special value
      next?.kind === "failed_to_fetch" ? prev : next,
    ]);
    console.log("entries="+JSON.stringify(entries))
    return Object.fromEntries(entries);
  },
  // walk the history back in time and recover from failed_to_fetch values if possible
  // history is array of fetched prices ordered by fetch time desc
  mergeHistory(history) {
    let res;
    if (history.size === 0) return [];
    else {
      res = history[0];
      for (const h of _.tail(history)) {
        res = { ...res, ...self.getRelevantDiffEntries(self.getDiff(h, res)) };
      }
      console.log("res="+JSON.stringify(res))
      return res;
    }
  },
  buildFileDir(basePath, date)  {
      return `${basePath}/results/${date.getUTCFullYear()}/${date.getUTCMonth()}`
  },
  buildFileName(date) { return date.getUTCDate() + ".json"},
  // returns results ordered form by date desc
  fetchPastNResults (basePath, n, fromDate)  {
    results = [];
    for (let i = n, date = fromDate; i > 0; i--, date = yesterday(date)) {
      const path = [self.buildFileDir(basePath, date), self.buildFileName(date)].join(
        "/",
      );
      if (fs.existsSync(path)) {
        results.push(JSON.parse(fs.readFileSync(path).toString()));
      }
    }
    return results;
  },

};
self = module.exports;
