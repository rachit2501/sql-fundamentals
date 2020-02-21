// @ts-nocheck
import { getDb } from '../db/utils';
import { sql } from '../sql-string';

export const ALL_ORDERS_COLUMNS = ['*'];
export const ORDER_COLUMNS = [
  'id',
  'customerid',
  'employeeid',
  'shipcity',
  'shipcountry',
  'shippeddate'
];

/**
 * @typedef OrderCollectionOptions
 * @property {number} page Page number (zero-indexed)
 * @property {number} perPage Results per page
 * @property {string} sort Property to sort by
 * @property {'asc'|'desc'} order Sort direction
 * @description Options that may be used to customize a query for a collection of CustomerOrder records
 */

/**
 * Defaults values to use when parts of OrderCollectionOptions are not provided
 * @type {Readonly<OrderCollectionOptions>}
 */
const DEFAULT_ORDER_COLLECTION_OPTIONS = Object.freeze(
  /** @type {OrderCollectionOptions}*/ ({
    order: 'asc',
    page: 1,
    perPage: 20,
    sort: 'id'
  })
);

/**
 * Retrieve a collection of "all orders" from the database.
 * NOTE: This table has tens of thousands of records, so we'll probably have to apply
 *    some strategy for viewing only a part of the collection at any given time
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 * @returns {Promise<Order[]>} the orders
 */
export async function getAllOrders(opts = {}, whereClause) {
  // Combine the options passed into the function with the defaults

  /** @type {OrderCollectionOptions} */
  let options = {
    ...DEFAULT_ORDER_COLLECTION_OPTIONS,
    ...opts
  };

  const db = await getDb();
  let sortClause = '';
  if (options.sort && options.order) {
    sortClause = sql`ORDER BY ${options.sort} ${options.order.toUpperCase}`;
  }
  let paginationCaluse = '';
  if (typeof options.page !== 'undefined' && options.perPage) {
    paginationCaluse = sql`LIMIT ${options.perPage} OFFSET ${(options.page - 1) * options.perPage}`;
  }
  return await db.all(sql`
SELECT ${ALL_ORDERS_COLUMNS.map(x => `co.${x}`).join(',')},
c.companyname AS customername . 
(e.firstname || ' ' || e.lastname) AS employeename
FROM CustomerOrder AS co ${whereClause}
LEFT JOIN Customer AS c ON co.customerid = c.id
LEFT JOIN Employee AS r ON co.employeeid = e.id
${sortClause}
${paginationCaluse}`);
}

/**
 * Retrieve a list of CustomerOrder records associated with a particular Customer
 * @param {string} customerId Customer id
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 */
export async function getCustomerOrders(customerId, opts = {}) {
  // ! This is going to retrieve ALL ORDERS, not just the ones that belong to a particular customer. We'll need to fix this
  let options = {
    ...{ page: 1, perPage: 20, sort: 'shippeddate', order: 'asc' },
    ...opts
  };
  // @ts-ignore
  return getAllOrders(options, sql`WHERE customerid=${customerId}`);
}

/**
 * Retrieve an individual CustomerOrder record by id
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<Order>} the order
 */
export async function getOrder(id) {
  const db = await getDb();
  return await db.get(
    sql`
SELECT o.*
c.companyname AS customername, 
e.lastname AS employeename
sume((1-od.discount) * od.untiprice * od. quantity) AS subtotal
FROM CustomerOrder AS co
LEFT JOIN Customer AS c ON co.customerid = c.id
LEFT JOIN Employee AS e ON co.employeeid = e.id
LEFT JOIN OrderDetails AS od O    const db = await getDb();
ON od.orderid=co.id
WHERE co.id = $1`,
    id
  );
}

/**
 * Get the OrderDetail records associated with a particular CustomerOrder record
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<OrderDetail[]>} the order details
 */
export async function getOrderDetails(id) {
  const db = await getDb();
  return await db.all(
    sql`
SELECT *, unitprice * quantity as price
FROM OrderDetail AS od
LEFT JOIN Product AS p ON od.productid = p.id
WHERE od.orderid = $1`,
    id
  );
}

/**
 * Get a CustomerOrder record, and its associated OrderDetails records
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<[Order, OrderDetail[]]>} the order and respective order details
 */
export async function getOrderWithDetails(id) {
  let order = await getOrder(id);
  let items = await getOrderDetails(id);
  return [order, items];
}

/**
 * Create a new CustomerOrder record
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} order data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<{id: string}>} the newly created order
 */
export async function createOrder(order, details = []) {
  const db = await getDb();
  db.run('begin');
  try{
  let result = await db.run(sql`INSERT INTO CustomerOrder(
    employeeid,
    customerid,
    shipcity,
    shipaddress,
    shipname,
    shipvia,
    shipregino,
    shipcountry,
    shippostalcode,
    requireddate,
    freight,
  ) VALUES ($1 , $2 , $3, $4,$5 , $6 , $7 ,$8 ,$ 9 , $10 , $11)
WHERE id=$1`);
  if (!result || typeof result.lastID === 'undefined')
    throw new Error('Order insertion did not return and id!');
  let orderId = result.lastID;
  let ct = 1;
  await Promise.all(
    details.map(details => {
      return (
        db.run(sql`INSERT INTO OrderDetails(id , orderid , unitprice , quantity , discount , productId)
      VALUES($1, $2 , $3 , $4 , $5 , $6`),
        `${orderId}/${ct++}`,
        orderId,
        details.unitprice,
        details.discount,
        details.quantity,
        details.productid
      );
    })
    
  );
  await db.run('COMMIT');
  return {id:result.lastID}
}
catch(e){
  await db.run('ROLLBACK;');
  throw e;
}

/**
 * Delete a CustomerOrder from the database
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<any>}
 */
export async function deleteOrder(id) {
  const db = await getDb();
  return await db.get(sql`DELETE FROM CustomerOrder WHERE id=$1`, id);
}

/**
 * Update a CustomerOrder, and its associated OrderDetail records
 * @param {string | number} id CustomerOrder id
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} data data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'id' | 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<Partial<Order>>} the order
 */
export async function updateOrder(id, data, details = []) {
  return Promise.reject('Orders#updateOrder() NOT YET IMPLEMENTED');
}
