import { ServiceSchema } from '@shadow-mcp/core';

export const stripeSchema: ServiceSchema = {
  service: 'stripe',
  tables: [
    {
      name: 'stripe_customers',
      columns: [
        { name: 'email', type: 'TEXT' },
        { name: 'name', type: 'TEXT', nullable: true },
        { name: 'phone', type: 'TEXT', nullable: true },
        { name: 'description', type: 'TEXT', nullable: true },
        { name: 'balance', type: 'INTEGER', defaultValue: 0 },
        { name: 'currency', type: 'TEXT', defaultValue: 'usd' },
        { name: 'metadata', type: 'TEXT', defaultValue: '{}' },
      ],
    },
    {
      name: 'stripe_payment_methods',
      columns: [
        { name: 'customer_id', type: 'TEXT' },
        { name: 'type', type: 'TEXT', defaultValue: 'card' },
        { name: 'card_brand', type: 'TEXT', defaultValue: 'visa' },
        { name: 'card_last4', type: 'TEXT', defaultValue: '4242' },
        { name: 'card_exp_month', type: 'INTEGER', defaultValue: 12 },
        { name: 'card_exp_year', type: 'INTEGER', defaultValue: 2027 },
        { name: 'is_default', type: 'INTEGER', defaultValue: 0 },
      ],
    },
    {
      name: 'stripe_charges',
      columns: [
        { name: 'customer_id', type: 'TEXT' },
        { name: 'payment_method_id', type: 'TEXT', nullable: true },
        { name: 'amount', type: 'INTEGER' },
        { name: 'currency', type: 'TEXT', defaultValue: 'usd' },
        { name: 'status', type: 'TEXT', defaultValue: 'succeeded' },
        { name: 'description', type: 'TEXT', nullable: true },
        { name: 'receipt_email', type: 'TEXT', nullable: true },
        { name: 'refunded', type: 'INTEGER', defaultValue: 0 },
        { name: 'amount_refunded', type: 'INTEGER', defaultValue: 0 },
        { name: 'metadata', type: 'TEXT', defaultValue: '{}' },
      ],
    },
    {
      name: 'stripe_refunds',
      columns: [
        { name: 'charge_id', type: 'TEXT' },
        { name: 'amount', type: 'INTEGER' },
        { name: 'currency', type: 'TEXT', defaultValue: 'usd' },
        { name: 'status', type: 'TEXT', defaultValue: 'succeeded' },
        { name: 'reason', type: 'TEXT', nullable: true },
      ],
    },
    {
      name: 'stripe_disputes',
      columns: [
        { name: 'charge_id', type: 'TEXT' },
        { name: 'amount', type: 'INTEGER' },
        { name: 'currency', type: 'TEXT', defaultValue: 'usd' },
        { name: 'status', type: 'TEXT', defaultValue: 'needs_response' },
        { name: 'reason', type: 'TEXT', defaultValue: 'general' },
      ],
    },
  ],
};
