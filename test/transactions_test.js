const assert = require("assert");
const http = require("http");
const app = require("../app");

describe("GET /api/transactions", () => {
  let server;
  let baseUrl;
  let originalFetch;
  let originalToken;

  before((done) => {
    server = http.createServer(app).listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after((done) => server.close(done));

  function request(path) {
    return new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${path}`, (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({
              status: response.statusCode,
              json: async () => JSON.parse(body),
            });
          });
        })
        .on("error", reject);
    });
  }

  beforeEach(() => {
    originalFetch = global.fetch;
    originalToken = process.env.SIM_CLOUD_API_TOKEN;
    process.env.SIM_CLOUD_API_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.SIM_CLOUD_API_TOKEN;
    } else {
      process.env.SIM_CLOUD_API_TOKEN = originalToken;
    }
  });

  it("forwards validated filters and the API token to SIMcloud", async () => {
    let requestUrl;
    let requestOptions;
    const expectedBody = { status: "success", transactions: [] };
    global.fetch = async (url, options) => {
      requestUrl = new URL(url);
      requestOptions = options;
      return { status: 200, json: async () => expectedBody };
    };

    const response = await request(
      "/api/transactions?date_from=2026-07-01&date_to=2026-07-31&type=airtime,data&limit=25&cursor=abc123",
    );

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), expectedBody);
    assert.strictEqual(requestUrl.origin, "https://simcloud.co.za");
    assert.strictEqual(requestUrl.pathname, "/api/transactions.php");
    assert.strictEqual(requestUrl.searchParams.get("date_from"), "2026-07-01");
    assert.strictEqual(requestUrl.searchParams.get("date_to"), "2026-07-31");
    assert.strictEqual(requestUrl.searchParams.get("type"), "airtime,data");
    assert.strictEqual(requestUrl.searchParams.get("limit"), "25");
    assert.strictEqual(requestUrl.searchParams.get("cursor"), "abc123");
    assert.strictEqual(requestOptions.headers.Authorization, "Bearer test-token");
  });

  it("rejects invalid dates and ranges before calling SIMcloud", async () => {
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error("SIMcloud should not be called");
    };

    const invalidDate = await request(
      "/api/transactions?date_from=2026-02-30&date_to=2026-03-01",
    );
    const tooLong = await request(
      "/api/transactions?date_from=2026-01-01&date_to=2026-03-31",
    );

    assert.strictEqual(invalidDate.status, 400);
    assert.strictEqual(tooLong.status, 400);
    assert.strictEqual(called, false);
  });

  it("rejects unsupported service types and limits", async () => {
    const unsupportedType = await request(
      "/api/transactions?date_from=2026-07-01&date_to=2026-07-02&type=unknown",
    );
    const invalidLimit = await request(
      "/api/transactions?date_from=2026-07-01&date_to=2026-07-02&limit=101",
    );

    assert.strictEqual(unsupportedType.status, 400);
    assert.strictEqual(invalidLimit.status, 400);
  });

  it("returns a service-unavailable error when the API token is missing", async () => {
    delete process.env.SIM_CLOUD_API_TOKEN;
    global.fetch = async () => {
      throw new Error("SIMcloud should not be called");
    };

    const response = await request(
      "/api/transactions?date_from=2026-07-01&date_to=2026-07-02",
    );

    assert.strictEqual(response.status, 503);
    assert.deepStrictEqual(await response.json(), {
      status: "error",
      message: "Transaction history is not configured.",
    });
  });

  it("passes through SIMcloud errors", async () => {
    const errorBody = { status: "error", message: "Invalid API token." };
    global.fetch = async () => ({
      status: 401,
      json: async () => errorBody,
    });

    const response = await request(
      "/api/transactions?date_from=2026-07-01&date_to=2026-07-02",
    );

    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), errorBody);
  });
});
