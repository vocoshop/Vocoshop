import { generateInvoiceNumber } from '../../src/utils/generateInvoiceNumber';

describe('generateInvoiceNumber', () => {
  it('should generate invoice number with VOC prefix', () => {
    const invoiceNumber = generateInvoiceNumber();

    expect(invoiceNumber).toMatch(/^VOC-\d{4}-\d{6}$/);
  });

  it('should start with VOC- prefix', () => {
    const invoiceNumber = generateInvoiceNumber();

    expect(invoiceNumber.startsWith('VOC-')).toBe(true);
  });

  it('should contain current year', () => {
    const invoiceNumber = generateInvoiceNumber();
    const currentYear = new Date().getFullYear();

    expect(invoiceNumber).toContain(String(currentYear));
  });

  it('should generate 6 digit random number', () => {
    const invoiceNumber = generateInvoiceNumber();
    const parts = invoiceNumber.split('-');
    const randomPart = parseInt(parts[2], 10);

    expect(randomPart).toBeGreaterThanOrEqual(100000);
    expect(randomPart).toBeLessThanOrEqual(999999);
  });

  it('should return different values on multiple calls', () => {
    const results = new Set<string>();

    for (let i = 0; i < 100; i++) {
      results.add(generateInvoiceNumber());
    }

    expect(results.size).toBeGreaterThan(1);
  });
});