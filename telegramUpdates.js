const https = require("https");
const _ = require("lodash");

module.exports = {
  sendTelegramUpdate: async (botToken, chatId, diffEntries) => {
    console.log("sendTelegramUpdate for diffs" + JSON.stringify(diffEntries));
    // diff is expected to ignore changes of volatile fields (convertedPrice/currency, timestamp)
    const priceUpdates = diffEntries
      .map((e) => diffToText(e.country, e.prev, e.next))
      .filter(Boolean);

    if (priceUpdates.length > 0) {
      const msg = priceUpdates.join("\n");
      console.log(`sending tg message ${msg}`);
      await sendTgMsg(botToken, chatId, msg);
      console.log("tg message sent");
    } else {
      console.log("no price updates available at this time");
    }
  },
};

// prev  and next can be undefined, country must
const diffToText = (country, prev, next) => {
  const showPrice = (v) => {
    if (_.isUndefined(v) || v.kind === "failed_to_fetch") return undefined;
    else if (v.kind === "not_available")
      return `"service not available in this country"`;
    else {
      const originalPrice =
        v.convertedCurrency !== v.currency ? `(${v.currency}${v.price})` : "";
      return `${v.convertedCurrency}${v.convertedPrice}${originalPrice}`;
    }
  };

  const oldP = showPrice(prev);
  const newP = showPrice(next);
  // return text only if different new price exists
  return newP && `${country}: ${[oldP, newP].filter(Boolean).join(" --> ")}`;
};

const sendTgMsg = async (botToken, chatId, rawText) => {
  const text = encodeURIComponent(rawText);

  await new Promise((resolve, reject) => {
    const req = https
      .get(
        `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${text}`,
        (res) => {
          res.on("data", (data) =>
            console.log("tg response=" + data.toString()),
          );

          res.on("end", () => resolve(true));
        },
      )
      .on("error", (err) => {
        console.log(
          "Error during api request to api.telegram.org ",
          err.message,
        );
        reject(err);
      });
  });
};
