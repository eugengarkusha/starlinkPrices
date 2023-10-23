module.exports = {
  buildHtmlTable: (data, timestamp) => `
<!DOCTYPE html>
<html>
<head>
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
<div>updated at: ${timestamp}</div>
<table>
    <tr>
        <th>Country</th>
        <th>Terminal price</th>
    </tr>
    ${data.map((v) => buldRow(v)).join("\n")}
</table>
<div>
  <div class="inline-div">Data is sourced from&nbsp</div>
  <a href="https://www.starlink.com/">starlink.com</a>
</div>
<div>
  <div class="inline-div">Currency rates are sourced from&nbsp</div>
  <a href="https://freecurrencyapi.com/">freecurrencyapi.com</a>
</div>
<div>
  <div class="inline-div">Parser is&nbsp</div>
  <a href="https://github.com/eugengarkusha/starlinkPrices">here</a>
</div>
<div>PRs are welcome</div>
</body>
`,
};

const buldRow = (v) => {
  const value =
    v.kind === "available"
      ? `${v.currency}${v.price}`
      : v.kind.replaceAll("_", " ");

  return `
<tr>
   <td>${v.country}</td>
   <td>${value}</td>
</tr>
`;
};
