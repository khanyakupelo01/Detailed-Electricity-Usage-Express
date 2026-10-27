const Service = require('./Service');
const db = require('../db/pool');
const logger = require('../logger');

const errorResponse = (status, code, message, details = {}) => Service.rejectResponse({
  code,
  message,
  ...details,
}, status);

const databaseError = (error) => {
  const unavailableCodes = [
    'DB_CONFIG_MISSING',
    'ECONNREFUSED',
    'ETIMEDOUT',
    '57P01',
    '08000',
    '08003',
    '08006',
  ];
  const status = unavailableCodes.includes(error.code) ? 503 : 500;
  logger.error('Transaction database operation failed', { code: error.code });
  return errorResponse(
    status,
    status === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
    status === 503 ? 'Transaction storage is temporarily unavailable' : 'Unable to process transaction',
  );
};

const daysInMonth = (year, month) => {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isoTimestamp = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second, offset] = match;
  const maximumDay = daysInMonth(Number(year), Number(month));
  const offsetMatch = offset.match(/^[+-](\d{2}):(\d{2})$/);

  return Number(year) > 0
    && Number(month) > 0
    && Number(month) <= 12
    && Number(day) > 0
    && Number(day) <= maximumDay
    && Number(hour) <= 23
    && Number(minute) <= 59
    && Number(second) <= 59
    && (!offsetMatch || (Number(offsetMatch[1]) <= 23 && Number(offsetMatch[2]) <= 59))
    && Number.isFinite(Date.parse(value));
};

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  return year > 0
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(year, month);
};

const validatePurchase = (transaction) => {
  const errors = [];
  if (typeof transaction.meterNumber !== 'string' || transaction.meterNumber.trim().length === 0) {
    errors.push('meterNumber must be a non-empty string');
  }
  if (typeof transaction.amount !== 'number'
      || !Number.isFinite(transaction.amount)
      || transaction.amount <= 0) {
    errors.push('amount must be a finite positive number');
  }
  if (!isoTimestamp(transaction.timestamp)) {
    errors.push('timestamp must be an ISO 8601 date-time with a timezone');
  }
  if (transaction.type !== 'purchase') {
    errors.push('type must be purchase');
  }
  return errors;
};

const transactionResponse = (row) => ({
  id: String(row.id),
  meterNumber: row.meter_number,
  amount: Number(row.amount),
  timestamp: new Date(row.transaction_timestamp).toISOString(),
  date: new Date(row.transaction_timestamp).toISOString().slice(0, 10),
  type: row.type,
});

const historyResponse = (row) => ({
  id: String(row.id),
  date: row.transaction_timestamp.toISOString().slice(0, 10),
  timestamp: row.transaction_timestamp.toISOString(),
  type: row.type,
  amount: Number(row.amount),
});

const decodeCursor = (cursor) => {
  if (!cursor) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed && /^[0-9]+$/.test(String(parsed.id))) {
      return String(parsed.id);
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
};

const encodeCursor = (row) => Buffer.from(JSON.stringify({
  id: String(row.id),
})).toString('base64');

const getQueryParam = (params, name, generatedName) => params[name] || params[generatedName];

/**
* Delete a transaction by ID
*
* id String
* no response value expected for this operation
* */
const apiTransactionsDeleteIdDELETE = async ({ id }) => Service.successResponse({ id });

/**
* Retrieve transactions
*
* date_from date
* date_to date
* type String (optional)
* limit Integer (optional)
* cursor String (optional)
* */
const apiTransactionsGET = async (params) => {
  const dateFrom = getQueryParam(params, 'date_from', 'dateUnderscorefrom');
  const dateTo = getQueryParam(params, 'date_to', 'dateUnderscoreto');
  const { type } = params;
  const requestedLimit = params.limit === undefined ? 20 : Number(params.limit);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : undefined;
  const cursor = decodeCursor(params.cursor);

  const validDateFrom = isValidDate(dateFrom);
  const validDateTo = isValidDate(dateTo);
  if (!limit || (params.cursor && !cursor)
      || !validDateFrom || !validDateTo || dateFrom > dateTo) {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      'Invalid date range, limit, or cursor',
    );
  }

  const values = [dateFrom, dateTo];
  const filters = [
    'transaction_timestamp >= $1::date',
    "transaction_timestamp < ($2::date + INTERVAL '1 day')",
  ];

  if (type) {
    values.push(type);
    filters.push(`type = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor);
    filters.push(`id < $${values.length}::bigint`);
  }

  values.push(limit + 1);
  try {
    const result = await db.query(
      `SELECT id, amount, type, transaction_timestamp
       FROM purchase_transactions
       WHERE ${filters.join(' AND ')}
       ORDER BY id DESC
       LIMIT $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return Service.successResponse({
      transactions: rows.map(historyResponse),
      next_cursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    });
  } catch (error) {
    return databaseError(error);
  }
};

/**
* Retrieve a single transaction by ID
*
* id String
* */
const apiTransactionsIdGET = async ({ id }) => {
  if (!/^[0-9]+$/.test(id)) {
    return errorResponse(404, 'NOT_FOUND', 'Transaction not found');
  }
  try {
    const { rows } = await db.query(
      `SELECT id, amount, type, transaction_timestamp
       FROM purchase_transactions
       WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return errorResponse(404, 'NOT_FOUND', 'Transaction not found');
    }
    return Service.successResponse(historyResponse(rows[0]));
  } catch (error) {
    return databaseError(error);
  }
};

/**
* Create a new transaction
*
* apiTransactionsPostRequest ApiTransactionsPostRequest
* */
const apiTransactionsPOST = async ({ apiTransactionsPostRequest }) => {
  const transaction = apiTransactionsPostRequest || {};
  const validationErrors = validatePurchase(transaction);
  if (validationErrors.length > 0) {
    return errorResponse(422, 'INVALID_TRANSACTION', validationErrors.join('; '));
  }

  const meterNumber = transaction.meterNumber.trim();
  try {
    const result = await db.query(
      `INSERT INTO purchase_transactions
        (meter_number, amount, transaction_timestamp, type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meter_number, amount, transaction_timestamp) DO NOTHING
       RETURNING id, meter_number, amount, transaction_timestamp, type`,
      [meterNumber, String(transaction.amount), transaction.timestamp, transaction.type],
    );
    if (result.rows.length > 0) {
      return Service.successResponse(transactionResponse(result.rows[0]), 201);
    }

    const duplicate = await db.query(
      `SELECT id
       FROM purchase_transactions
       WHERE meter_number = $1
         AND amount = $2
         AND transaction_timestamp = $3`,
      [meterNumber, String(transaction.amount), transaction.timestamp],
    );
    if (duplicate.rows.length === 0) {
      return errorResponse(500, 'INTERNAL_SERVER_ERROR', 'Unable to resolve transaction conflict');
    }
    return errorResponse(
      409,
      'duplicate_transaction',
      'Purchase transaction already exists',
      {
        transactionId: String(duplicate.rows[0].id),
      },
    );
  } catch (error) {
    return databaseError(error);
  }
};

/**
* Update a transaction by ID
*
* id String
* apiTransactionsPostRequest ApiTransactionsPostRequest
* */
const apiTransactionsUpdateIdPUT = async ({
  id,
  apiTransactionsPostRequest,
}) => Service.successResponse({
  id,
  apiTransactionsPostRequest,
});

module.exports = {
  apiTransactionsDeleteIdDELETE,
  apiTransactionsGET,
  apiTransactionsIdGET,
  apiTransactionsPOST,
  apiTransactionsUpdateIdPUT,
};
