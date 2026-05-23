/**
 * Product catalogue — single source of truth for what's for sale.
 *
 * Critical: prices live here on the server, never in client code.
 * The /api/checkout endpoint validates the requested SKU against this
 * catalogue and reads the price from here. Clients only send a SKU id
 * and a chosen size — never an amount.
 */

export type Sku = 'tee-transparent-opaque';
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface Product {
  sku: Sku;
  name: string;
  description: string;
  /** Amount in the smallest currency unit (pence for GBP). */
  unit_amount: number;
  currency: 'gbp';
  /** Available sizes; metadata only — single price across sizes. */
  sizes: readonly Size[];
  /** Public image path used by Stripe Checkout's session preview. */
  image?: string;
  shipping_rates: ShippingRate[];
}

export interface ShippingRate {
  /** Display label on the Checkout page. */
  display_name: string;
  /** Cost in smallest currency unit. */
  amount: number;
  currency: 'gbp';
  /** Allowed shipping countries (ISO-2). */
  allowed_countries: string[];
  /** Delivery window for UI. */
  delivery: { min: number; max: number; unit: 'business_day' };
}

export const PRODUCTS: Record<Sku, Product> = {
  'tee-transparent-opaque': {
    sku: 'tee-transparent-opaque',
    name: 'transparent / opaque — t-shirt',
    description:
      'Heavyweight cream cotton tee with the databased.business signature wordmark, ' +
      'printed in oxidised orange and petrol blue on the chest. Unisex fit.',
    unit_amount: 2800, // £28.00
    currency: 'gbp',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const,
    image: '/shop/tee-transparent-opaque.svg',
    shipping_rates: [
      {
        display_name: 'UK Royal Mail tracked 48',
        amount: 450,
        currency: 'gbp',
        allowed_countries: ['GB'],
        delivery: { min: 2, max: 5, unit: 'business_day' },
      },
      {
        display_name: 'EU tracked',
        amount: 1200,
        currency: 'gbp',
        allowed_countries: [
          'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
          'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
          'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
        ],
        delivery: { min: 5, max: 10, unit: 'business_day' },
      },
      {
        display_name: 'Worldwide tracked',
        amount: 1800,
        currency: 'gbp',
        allowed_countries: [
          'US', 'CA', 'AU', 'NZ', 'JP', 'SG', 'CH', 'NO', 'IS',
        ],
        delivery: { min: 7, max: 21, unit: 'business_day' },
      },
    ],
  },
};

export function getProduct(sku: string): Product | null {
  return (PRODUCTS as Record<string, Product>)[sku] ?? null;
}

export function isValidSize(product: Product, size: string): size is Size {
  return (product.sizes as readonly string[]).includes(size);
}

export function formatPrice(amount: number, currency = 'gbp'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
