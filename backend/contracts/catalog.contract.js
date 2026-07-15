"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogChangeEventSchema = exports.ProductListResponseSchema = exports.ProductSummarySchema = void 0;
const zod_1 = require("zod");
exports.ProductSummarySchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string().optional(),
    name: zod_1.z.string().optional(),
    slug: zod_1.z.string().optional(),
    price: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    image: zod_1.z.string().optional(),
    thumbnail: zod_1.z.string().optional(),
    inStock: zod_1.z.boolean().optional(),
    status: zod_1.z.string().optional(),
});
exports.ProductListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.ProductSummarySchema).optional(),
    products: zod_1.z.array(exports.ProductSummarySchema).optional(),
    data: zod_1.z.array(exports.ProductSummarySchema).optional(),
    total: zod_1.z.number().optional(),
    page: zod_1.z.number().optional(),
    pageSize: zod_1.z.number().optional(),
});
exports.CatalogChangeEventSchema = zod_1.z.object({
    productId: zod_1.z.string(),
    change: zod_1.z.enum(['created', 'updated', 'deleted', 'moved']).default('updated'),
});
//# sourceMappingURL=catalog.contract.js.map