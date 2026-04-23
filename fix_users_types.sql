ALTER TABLE users ALTER COLUMN account_status TYPE varchar(20) USING account_status::text;
ALTER TABLE users ALTER COLUMN user_type TYPE varchar(20) USING user_type::text;
ALTER TABLE users ALTER COLUMN preferred_lang TYPE varchar(20) USING preferred_lang::text;

ALTER TABLE products ALTER COLUMN status TYPE varchar(20) USING status::text;

ALTER TABLE product_pricing ALTER COLUMN customer_type TYPE varchar(20) USING customer_type::text;

ALTER TABLE orders ALTER COLUMN status TYPE varchar(30) USING status::text;
ALTER TABLE orders ALTER COLUMN customer_type TYPE varchar(20) USING customer_type::text;
ALTER TABLE orders ALTER COLUMN payment_method TYPE varchar(30) USING payment_method::text;
ALTER TABLE orders ALTER COLUMN payment_status TYPE varchar(30) USING payment_status::text;

ALTER TABLE payment_transactions ALTER COLUMN status TYPE varchar(30) USING status::text;
ALTER TABLE payment_transactions ALTER COLUMN method TYPE varchar(30) USING method::text;

ALTER TABLE wholesale_applications ALTER COLUMN status TYPE varchar(20) USING status::text;
