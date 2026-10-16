/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Delete a transaction by ID
*
* id String 
* no response value expected for this operation
* */
const apiTransactionsDeleteIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        id,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Retrieve transactions
*
* dateUnderscorefrom date 
* dateUnderscoreto date 
* type String  (optional)
* limit Integer  (optional)
* cursor String  (optional)
* no response value expected for this operation
* */
const apiTransactionsGET = ({ dateUnderscorefrom, dateUnderscoreto, type, limit, cursor }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        dateUnderscorefrom,
        dateUnderscoreto,
        type,
        limit,
        cursor,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Retrieve a single transaction by ID
*
* id String 
* no response value expected for this operation
* */
const apiTransactionsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        id,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Create a new transaction
*
* apiTransactionsPostRequest ApiTransactionsPostRequest 
* no response value expected for this operation
* */
const apiTransactionsPOST = ({ apiTransactionsPostRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        apiTransactionsPostRequest,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Update a transaction by ID
*
* id String 
* apiTransactionsPostRequest ApiTransactionsPostRequest 
* no response value expected for this operation
* */
const apiTransactionsUpdateIdPUT = ({ id, apiTransactionsPostRequest }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        id,
        apiTransactionsPostRequest,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

module.exports = {
  apiTransactionsDeleteIdDELETE,
  apiTransactionsGET,
  apiTransactionsIdGET,
  apiTransactionsPOST,
  apiTransactionsUpdateIdPUT,
};
