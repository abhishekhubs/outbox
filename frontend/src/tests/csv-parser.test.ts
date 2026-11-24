import { describe, it, expect } from 'vitest';
import { parseEmailFile } from '../utils/csv-parser';

describe('Frontend CSV & TXT Email Parser', () => {
  it('should parse valid emails from CSV formatted string', async () => {
    const csvContent = 'email,name\nuser1@reachinbox.test,User One\nuser2@reachinbox.test,User Two';
    const file = new File([csvContent], 'recipients.csv', { type: 'text/csv' });

    const result = await parseEmailFile(file);
    expect(result.emails).toEqual(['user1@reachinbox.test', 'user2@reachinbox.test']);
    expect(result.duplicates).toBe(0);
  });

  it('should remove duplicates and count them accurately', async () => {
    const textContent = 'alex@test.com\nalex@test.com\nbob@test.com\nAlex@test.com';
    const file = new File([textContent], 'emails.txt', { type: 'text/plain' });

    const result = await parseEmailFile(file);
    expect(result.emails).toHaveLength(2);
    expect(result.emails).toContain('alex@test.com');
    expect(result.emails).toContain('bob@test.com');
    expect(result.duplicates).toBe(2);
  });

  it('should detect invalid email formats and report errors', async () => {
    const textContent = 'valid@test.com, not-an-email, another@valid.org';
    const file = new File([textContent], 'mixed.txt', { type: 'text/plain' });

    const result = await parseEmailFile(file);
    expect(result.emails).toHaveLength(2);
    expect(result.emails).toContain('valid@test.com');
    expect(result.emails).toContain('another@valid.org');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('not-an-email');
  });

  it('should extract emails formatted as Name <email@domain.com>', async () => {
    const content = 'John Doe <john@reachinbox.test>\nJane Smith <jane@reachinbox.test>';
    const file = new File([content], 'contacts.txt', { type: 'text/plain' });

    const result = await parseEmailFile(file);
    expect(result.emails).toContain('john@reachinbox.test');
    expect(result.emails).toContain('jane@reachinbox.test');
  });

  it('should parse multi-column CSVs with Service, Name, Username headers without errors', async () => {
    const etherealCsv = `"Service","Name","Username","Password","Hostname","Port","Security"
"SMTP","Kaitlyn Ledner","kaitlyn.ledner66@ethereal.email","jztZDwCES8kP21Nt1F","smtp.ethereal.email",587,"STARTTLS"
"IMAP","Kaitlyn Ledner","kaitlyn.ledner66@ethereal.email","jztZDwCES8kP21Nt1F","imap.ethereal.email",993,"TLS"`;
    const file = new File([etherealCsv], 'ethereal.csv', { type: 'text/csv' });

    const result = await parseEmailFile(file);
    expect(result.emails).toEqual(['kaitlyn.ledner66@ethereal.email']);
    expect(result.errors).toEqual([]);
    expect(result.duplicates).toBe(1);
  });

  it('should return a clean message when uploading a file with no email addresses', async () => {
    const datasetCsv = `"DATE_TIME","PLANT_ID","SOURCE_KEY","AMBIENT_TEMPERATURE","MODULE_TEMPERATURE"
"2020-05-15 00:00:00",4135001,"1BY6WEcDUT0GXFD",25.18,25.15`;
    const file = new File([datasetCsv], 'dataset.csv', { type: 'text/csv' });

    const result = await parseEmailFile(file);
    expect(result.emails).toEqual([]);
    expect(result.errors[0]).toContain('No email addresses found');
    expect(result.errors.length).toBe(1);
  });
});
