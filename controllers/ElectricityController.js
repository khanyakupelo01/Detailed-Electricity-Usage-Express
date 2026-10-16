/**
 * The ElectricityController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/ElectricityService');
const apiTransactionsDeleteIdDELETE = async (request, response) => {
  await Controller.handleRequest(request, response, service.apiTransactionsDeleteIdDELETE);
};

const apiTransactionsGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.apiTransactionsGET);
};

const apiTransactionsIdGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.apiTransactionsIdGET);
};

const apiTransactionsPOST = async (request, response) => {
  await Controller.handleRequest(request, response, service.apiTransactionsPOST);
};

const apiTransactionsUpdateIdPUT = async (request, response) => {
  await Controller.handleRequest(request, response, service.apiTransactionsUpdateIdPUT);
};


module.exports = {
  apiTransactionsDeleteIdDELETE,
  apiTransactionsGET,
  apiTransactionsIdGET,
  apiTransactionsPOST,
  apiTransactionsUpdateIdPUT,
};
