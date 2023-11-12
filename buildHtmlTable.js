const { truncateToDay } = require("./utils");

module.exports = {
  buildHtmlTable: (countryValues, updatedAt) => `
<!DOCTYPE html>
<html>
<head>
<link rel="icon" href="data:,">
<meta charset="utf-8">
<style>
.inline-div {
    display: inline;
}
table {
    border-collapse: collapse;
    width: 50%;
    margin: 0 auto;
}

table, th, td {
    border: 1px solid black;
}

th, td {
    padding: 8px;
    text-align: left;
}
</style>
</head>
<body>
<div>updated at: ${updatedAt.toUTCString()}</div>
<table>
    <tr>
        <th>Country</th>
        <th>Terminal price</th>
    </tr>
    ${countryValues
      .map(([country, v]) => buildRow(country, v, updatedAt))
      .join("")}
</table>

<div>
  <div class="inline-div">Live updates </div>
  <a href="https://t.me/starlink_price_updates">@starlink_price_updates</a>
</div>
<div>
  <div class="inline-div">Support </div>
  <a href="https://t.me/bnuex">@bnuex</a>
</div>
<div>
  <div class="inline-div">Source code is </div>
  <a href="https://github.com/eugengarkusha/starlinkPrices">here</a>
  <div class="inline-div">, PRs are welcome</div>
</div>
<div>
  <div class="inline-div">Data is sourced from </div>
  <a href="https://www.starlink.com/">starlink.com</a>
</div>
<div>
  <div class="inline-div">Currency rates are sourced from </div>
  <a href="https://freecurrencyapi.com/">freecurrencyapi.com</a>
</div>
</body>
`,
};

const buildRow = (country, v, updatedAt) => {
  const isUpdatedEarlier =
    truncateToDay(new Date(v.timestamp)).getTime() !==
    truncateToDay(updatedAt).getTime();
  const labels = [
    v.isRefurbed && "Refurbished",
    isUpdatedEarlier && `updated at: ${new Date(v.timestamp).toUTCString()}`,
  ].filter(Boolean);

  const value =
    v.kind === "available"
      ? `${v.convertedCurrency}${v.convertedPrice}`
      : v.kind.replaceAll("_", " ");

  return `
<tr>
   <td>${country}</td>
   <td>${value}${labels.length !== 0 ? `(${labels.join(",")})` : ""}</td>
</tr>
`;
};
