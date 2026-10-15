const express = require("express");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");

const app = express();
const port = process.env.PORT || 3001;

const swaggerDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, "swagger", "swaggger.yaml"), "utf8")
);

app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const validServices = new Set(["airtime", "data", "electricity", "vas", "sms"]);
const transactionsUrl = "https://simcloud.co.za/api/transactions.php";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

app.get("/api/transactions", async (req, res) => {
  const { date_from: dateFrom, date_to: dateTo, type, limit, cursor } = req.query;
  const invalidQuery = () => res.status(400).json({
    status: "error",
    message: "Invalid transaction history query parameters.",
  });

  if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return invalidQuery();
  }

  const fromTime = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const toTime = Date.parse(`${dateTo}T00:00:00.000Z`);
  const daysApart = (toTime - fromTime) / 86_400_000;
  if (daysApart < 0 || daysApart > 89) {
    return invalidQuery();
  }

  if (type !== undefined && typeof type !== "string") {
    return invalidQuery();
  }
  const serviceTypes = type === undefined ? [] : type.split(",").map((value) => value.trim());
  if (serviceTypes.some((value) => !validServices.has(value))) {
    return invalidQuery();
  }

  if (
    limit !== undefined &&
    (typeof limit !== "string" || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
  ) {
    return invalidQuery();
  }

  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0)) {
    return invalidQuery();
  }

  const token = process.env.SIM_CLOUD_API_TOKEN;
  if (!token) {
    return res.status(503).json({
      status: "error",
      message: "Transaction history is not configured.",
    });
  }

  const upstreamUrl = new URL(transactionsUrl);
  upstreamUrl.searchParams.set("date_from", dateFrom);
  upstreamUrl.searchParams.set("date_to", dateTo);
  if (serviceTypes.length > 0) {
    upstreamUrl.searchParams.set("type", serviceTypes.join(","));
  }
  if (limit !== undefined) {
    upstreamUrl.searchParams.set("limit", limit);
  }
  if (cursor !== undefined) {
    upstreamUrl.searchParams.set("cursor", cursor);
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstreamResponse.json();
    return res.status(upstreamResponse.status).json(body);
  } catch (error) {
    console.error("SIMcloud transaction history request failed:", error);
    return res.status(502).json({
      status: "error",
      message: "Unable to retrieve transaction history from SIMcloud.",
    });
  }
});

if (require.main === module) {
  const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
  server.keepAliveTimeout = 120 * 1000;
  server.headersTimeout = 120 * 1000;
}

module.exports = app;
