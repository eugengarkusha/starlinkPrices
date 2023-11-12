const { mergeHistory, getDiff, getPastNResults } = require("../history");
const utils = require("../utils");
const now = new Date();

const available = (
  country,
  price,
  convertedCurrency,
  convertedPrice,
  date,
) => ({
  [country]: utils.available(
    "$",
    price ?? 1.5,
    convertedCurrency ?? "€",
    convertedPrice ?? 1,
    false,
    date ?? now,
  ),
});
const failedToFetch = (country, date) => ({
  [country]: utils.failedToFetch(date ?? now),
});
const notAvailable = (country, date) => ({
  [country]: utils.notAvailable(date ?? now),
});
const jan2_2023 = new Date(2023, 0, 2, 11, 11, 11);

test("mergeHistory: recovers to first fetched object", () => {
  const germany = "Germany";
  const result = mergeHistory([
    failedToFetch(germany),
    failedToFetch(germany),
    available(germany),
    available(germany, 12, "EUR", 42),
  ]);

  expect(result).toEqual(available(germany));
});

test("mergeHistory: does not overwrite failed_to_fetch with failed_to_fetch", () => {
  const germany = "Germany";
  const result = mergeHistory([
    failedToFetch(germany, Date(1, 1, 1)),
    failedToFetch(germany, Date(10, 10, 10)),
  ]);

  expect(result).toEqual(failedToFetch(germany, Date(1, 1, 1)));
});
test("mergeHistory: does not restore deleted countries", () => {
  const germany = "Germany";
  const deletedCountry = "Krokozia";
  const result = mergeHistory([
    { ...failedToFetch(germany) },
    { ...failedToFetch(germany), ...available(deletedCountry) },
    { ...available(germany), ...available(deletedCountry) },
  ]);

  expect(result).toEqual(available(germany));
});

test("mergeHistory: does not overwrite newest available countries", () => {
  const germany = "Germany";
  const ukraine = "Ukraine";
  const result = mergeHistory([
    { ...failedToFetch(germany), ...available(ukraine) },
    { ...failedToFetch(germany), ...available(ukraine, 12, "UAH", 200) },
    { ...available(germany, 12, "EUR", 42), ...available(ukraine, "UAH", 200) },
  ]);

  expect(result).toEqual({
    ...available(germany, 12, "EUR", 42),
    ...available(ukraine),
  });
});

test("mergeHistory: does not delete newest available countries", () => {
  const germany = "Germany";
  const ukraine = "Ukraine";
  const result = mergeHistory([
    { ...failedToFetch(germany), ...available(ukraine) },
    { ...failedToFetch(germany) },
    { ...available(germany) },
  ]);

  expect(result).toEqual({ ...available(germany), ...available(ukraine) });
});

test("mergeHistory: respects notAvailable", () => {
  const germany = "Germany";
  const result = mergeHistory([
    { ...notAvailable(germany) },
    { ...available(germany) },
  ]);
  expect(result).toEqual(notAvailable(germany));
});

test("getDiff: finds non-equal objects by structural equality, ignoring timestamp, convertedCurrency and convertedPrice", () => {
  const germany = "Germany";
  const ukraine = "Ukraine";
  const usa = "USA";
  const poland = "Poland";
  const lithuania = "Lithuania";
  const latvia = "Latvia";
  const estonia = "Estonia";

  const prev = {
    ...available(germany),
    ...failedToFetch(ukraine),
    ...failedToFetch(usa),
    ...notAvailable(estonia),
    ...failedToFetch(lithuania, new Date(1, 1, 1)),
    ...available(latvia, undefined, "XXX", 11, new Date(1, 1, 1)),
  };
  const next = {
    ...available(germany, 11),
    ...available(ukraine),
    ...available(poland),
    ...failedToFetch(estonia),
    ...failedToFetch(lithuania, new Date(2, 2, 2)),
    ...available(latvia, undefined, "YYY", 22, new Date(2, 2, 2)),
  };

  expect(getDiff(prev, next)).toEqual([
    { country: germany, next: next[germany], prev: prev[germany] },
    { country: ukraine, next: next[ukraine], prev: prev[ukraine] },
    { country: usa, next: next[usa], prev: prev[usa] },
    { country: estonia, next: next[estonia], prev: prev[estonia] },
    { country: poland, next: next[poland], prev: prev[poland] },
  ]);
});

test("getPastNResults: handle year and month change, empty dates are ignored", () => {
  const fetched = getPastNResults(__dirname, 99, jan2_2023);
  expect(fetched).toEqual([
    { 2023: "Jan2" },
    { 2023: "Jan1" },
    { 2022: "Dec31" },
  ]);
});
test("getPastNResults: fromDate is included", () => {
  const jan2_2023 = new Date(2023, 0, 2, 11, 11, 11);
  const fetched = getPastNResults(__dirname, 99, jan2_2023);
  expect(fetched).toEqual([
    { 2023: "Jan2" },
    { 2023: "Jan1" },
    { 2022: "Dec31" },
  ]);
});
