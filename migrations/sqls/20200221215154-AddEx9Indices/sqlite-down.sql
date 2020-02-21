-- Put your SQLite "down" migration here
DROP INDEX orderdetailproductid ;
DROP INDEX orderdetailorderid;
CREATE INDEX ordercustomerid;
CREATE INDEX orderemployeeid;

CREATE INDEX productsupplierid;
CREATE INDEX employeereportsto;