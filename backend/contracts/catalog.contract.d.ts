import { z } from 'zod';
export declare const ProductSummarySchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    image: z.ZodOptional<z.ZodString>;
    thumbnail: z.ZodOptional<z.ZodString>;
    inStock: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    slug?: string | undefined;
    status?: string | undefined;
    price?: string | number | undefined;
    title?: string | undefined;
    image?: string | undefined;
    thumbnail?: string | undefined;
    inStock?: boolean | undefined;
}, {
    id: string;
    name?: string | undefined;
    slug?: string | undefined;
    status?: string | undefined;
    price?: string | number | undefined;
    title?: string | undefined;
    image?: string | undefined;
    thumbnail?: string | undefined;
    inStock?: boolean | undefined;
}>;
export declare const ProductListResponseSchema: z.ZodObject<{
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        image: z.ZodOptional<z.ZodString>;
        thumbnail: z.ZodOptional<z.ZodString>;
        inStock: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }>, "many">>;
    products: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        image: z.ZodOptional<z.ZodString>;
        thumbnail: z.ZodOptional<z.ZodString>;
        inStock: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }>, "many">>;
    data: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        image: z.ZodOptional<z.ZodString>;
        thumbnail: z.ZodOptional<z.ZodString>;
        inStock: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }, {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }>, "many">>;
    total: z.ZodOptional<z.ZodNumber>;
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    products?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    total?: number | undefined;
    items?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    data?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    products?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    total?: number | undefined;
    items?: {
        id: string;
        name?: string | undefined;
        slug?: string | undefined;
        status?: string | undefined;
        price?: string | number | undefined;
        title?: string | undefined;
        image?: string | undefined;
        thumbnail?: string | undefined;
        inStock?: boolean | undefined;
    }[] | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const CatalogChangeEventSchema: z.ZodObject<{
    productId: z.ZodString;
    change: z.ZodDefault<z.ZodEnum<["created", "updated", "deleted", "moved"]>>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    change: "created" | "updated" | "deleted" | "moved";
}, {
    productId: string;
    change?: "created" | "updated" | "deleted" | "moved" | undefined;
}>;
export type ProductSummary = z.infer<typeof ProductSummarySchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
export type CatalogChangeEvent = z.infer<typeof CatalogChangeEventSchema>;
//# sourceMappingURL=catalog.contract.d.ts.map