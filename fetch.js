const { notAvailable, available } = require("./utils");
const _ = require("lodash");
module.exports = {
  fetch: async (outDir, country, page, rates, now) => {
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
      return notAvailable(now);
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
      if (txt && txt.match("not available")) return notAvailable(now);
      else
        throw new Error("failed to route to /orders page for unknown reason");
    }
    await page.screenshot({
      path: `${outDir}/${country}_image_after_order_clicked.png`,
    });

    // when elected-price is loaded , all page is ready
    await page.waitForSelector(".selected-price");

    // searching for refurb price and assuming it is lower then normal price
    let refurbed_price_element = await page
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
        ).then((arr) => arr.filter(Boolean)[0] ?? arr.filter(Boolean)[0]),
      );

    const getSelectedPriceElement = async () => {
      const element = await page.$(".selected-price");
      const price_element = await page.evaluate(
        (el) => el.textContent,
        element,
      );
      const [_, price] = /and\s+(.+)\s+for hardware/.exec(price_element);
      return price;
    };

    const price_element =
      refurbed_price_element || (await getSelectedPriceElement());
    const isRefurbed = !_.isUndefined(refurbed_price_element);

    await page.screenshot({ path: `${outDir}/${country}_image_final.png` });

    const [_all, currency, amount] = /([A-Z]{3}|£|\$|€)(\d+,?\d*)?/.exec(
      price_element,
    );
    const rate = rates[currency];
    const price = amount.replaceAll(",", "") * 1;
    const convertedPrice = rate ? Math.round(price / rate) : Math.round(price);
    // assuming that all price option have same currency
    const convertedCurrency = rate ? "€" : currency;

    return available(
      currency,
      price,
      convertedCurrency,
      convertedPrice,
      isRefurbed,
      now,
    );
  },
};
