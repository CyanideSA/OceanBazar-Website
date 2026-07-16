declare module 'sslcommerz-lts' {
  export interface SslCommerzInitData {
    total_amount: number;
    currency: string;
    tran_id: string;
    success_url: string;
    fail_url: string;
    cancel_url: string;
    ipn_url?: string;
    shipping_method?: string;
    num_of_item?: number;
    product_name?: string;
    product_category?: string;
    product_profile?: string;
    cus_name?: string;
    cus_email?: string;
    cus_add1?: string;
    cus_add2?: string;
    cus_city?: string;
    cus_state?: string;
    cus_postcode?: string;
    cus_country?: string;
    cus_phone?: string;
    value_a?: string;
    value_b?: string;
    value_c?: string;
    value_d?: string;
    [key: string]: string | number | undefined;
  }

  export interface SslCommerzInitResponse {
    status?: string;
    failedreason?: string;
    GatewayPageURL?: string;
    sessionkey?: string;
    [key: string]: unknown;
  }

  export interface SslCommerzValidationResponse {
    status?: string;
    tran_id?: string;
    amount?: string | number;
    currency?: string;
    val_id?: string;
    bank_tran_id?: string;
    card_type?: string;
    card_no?: string;
    card_issuer?: string;
    card_brand?: string;
    card_issuer_country?: string;
    card_issuer_country_code?: string;
    store_amount?: string | number;
    verify_sign?: string;
    verify_key?: string;
    risk_level?: string;
    risk_title?: string;
    [key: string]: unknown;
  }

  export default class SSLCommerzPayment {
    constructor(store_id: string, store_passwd: string, live: boolean);
    init(data: SslCommerzInitData): Promise<SslCommerzInitResponse>;
    validate(data: { val_id: string }): Promise<SslCommerzValidationResponse>;
    initiateRefund(data: Record<string, unknown>): Promise<unknown>;
    refundQuery(data: Record<string, unknown>): Promise<unknown>;
    transactionQueryByTransactionId(data: { tran_id: string }): Promise<unknown>;
    transactionQueryBySessionId(data: { sessionkey: string }): Promise<unknown>;
  }
}
