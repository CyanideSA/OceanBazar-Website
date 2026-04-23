ALTER TABLE products ALTER COLUMN status DROP DEFAULT;
ALTER TABLE products ALTER COLUMN status TYPE "ProductStatus" USING status::text::"ProductStatus";
ALTER TABLE products ALTER COLUMN status SET DEFAULT 'draft'::"ProductStatus";

ALTER TABLE product_pricing ALTER COLUMN customer_type DROP DEFAULT;
ALTER TABLE product_pricing ALTER COLUMN customer_type TYPE "CustomerType" USING customer_type::text::"CustomerType";
ALTER TABLE product_pricing ALTER COLUMN customer_type SET DEFAULT 'retail'::"CustomerType";
