const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface ParseResult {
  emails: string[];
  errors: string[];
  duplicates: number;
  recipientParams?: Record<string, Record<string, string>>;
  detectedVariables?: string[];
}

// Common CSV column header words that should never be treated as invalid email addresses
const COMMON_HEADERS = new Set([
  'service',
  'name',
  'username',
  'user',
  'password',
  'pass',
  'hostname',
  'host',
  'port',
  'security',
  'protocol',
  'type',
  'email',
  'emails',
  'e-mail',
  'recipient',
  'recipients',
  'to',
  'address',
  'first name',
  'firstname',
  'last name',
  'lastname',
  'full name',
  'fullname',
  'company',
  'organization',
  'title',
  'role',
  'phone',
  'mobile',
  'id',
  'status',
  'date',
  'time',
  'date_time',
  'datetime',
  'timestamp',
]);

/**
 * Split a CSV line respecting quotes
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Check if a token looks like non-email tabular data
 */
function isNonEmailData(token: string): boolean {
  if (!token) return true;
  const lower = token.toLowerCase();
  if (COMMON_HEADERS.has(lower)) return true;
  // Numbers, floats, ports, timestamps
  if (/^-?\d+(\.\d+)?$/.test(token)) return true;
  // Dates and timestamps like "2020-05-15" or "2020-05-15 00:00:00"
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(token)) return true;
  // Booleans / standard protocol keywords
  if (/^(true|false|tls|ssl|starttls|smtp|imap|pop3)$/i.test(token)) return true;
  // Alphanumeric column identifiers like "DATE_TIME", "PLANT_ID", "SOURCE_KEY"
  if (/^[A-Z0-9_]+$/.test(token) && token.includes('_')) return true;
  return false;
}

/**
 * Client-side parser for CSV and TXT files containing recipient email addresses and custom parameters.
 */
export async function parseEmailFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          resolve({ emails: [], errors: ['File is empty'], duplicates: 0 });
          return;
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          resolve({ emails: [], errors: ['File is empty'], duplicates: 0 });
          return;
        }

        const validEmails = new Set<string>();
        const errors: string[] = [];
        const recipientParams: Record<string, Record<string, string>> = {};
        const detectedVarsSet = new Set<string>();
        let duplicateCount = 0;

        // Check if line 0 is a CSV header row
        const firstLineCells = splitCsvLine(lines[0]);
        let hasHeaderRow = false;
        let emailColumnIndex = -1;
        let headers: string[] = [];

        if (firstLineCells.length > 1) {
          const hasEmailInFirstLine = firstLineCells.some((c) => c.includes('@'));
          if (!hasEmailInFirstLine) {
            hasHeaderRow = true;
            headers = firstLineCells;
            emailColumnIndex = firstLineCells.findIndex((c) =>
              ['email', 'emails', 'recipient', 'recipients', 'username', 'to', 'address'].includes(
                c.toLowerCase()
              )
            );
          }
        }

        const startIndex = hasHeaderRow ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          const cells = splitCsvLine(line);

          // If line has multiple cells and header row is known
          if (hasHeaderRow && cells.length > 0) {
            // Find which cell in this row is an email
            let emailIdx = emailColumnIndex !== -1 ? emailColumnIndex : -1;
            if (emailIdx === -1 || !cells[emailIdx]?.includes('@')) {
              emailIdx = cells.findIndex((c) => EMAIL_REGEX.test(c.replace(/<([^>]+)>/, '$1').trim()));
            }

            if (emailIdx !== -1 && cells[emailIdx]) {
              const candidate = cells[emailIdx];
              const angleMatch = candidate.match(/<([^>]+)>/);
              const email = angleMatch ? angleMatch[1].trim() : candidate;

              if (EMAIL_REGEX.test(email)) {
                const normalized = email.toLowerCase();
                if (validEmails.has(normalized)) {
                  duplicateCount++;
                } else {
                  validEmails.add(normalized);
                }

                // Extract all other row columns as parameters
                const params: Record<string, string> = {};
                headers.forEach((h, idx) => {
                  if (idx !== emailIdx && cells[idx]) {
                    params[h] = cells[idx];
                    detectedVarsSet.add(h);
                  }
                });
                recipientParams[normalized] = params;
                continue;
              }
            }
          }

          // Otherwise, inspect cells on this line
          let foundEmailInLine = false;
          const nonEmailCandidates: string[] = [];

          for (const cell of cells) {
            if (!cell) continue;

            const angleMatch = cell.match(/<([^>]+)>/);
            const candidate = angleMatch ? angleMatch[1].trim() : cell;

            if (EMAIL_REGEX.test(candidate)) {
              foundEmailInLine = true;
              const normalized = candidate.toLowerCase();
              if (validEmails.has(normalized)) {
                duplicateCount++;
              } else {
                validEmails.add(normalized);
              }
            } else if (!isNonEmailData(candidate)) {
              nonEmailCandidates.push(candidate);
            }
          }

          for (const token of nonEmailCandidates) {
            if (foundEmailInLine || token.includes('@')) {
              errors.push(`Invalid email: "${token}"`);
            }
          }
        }

        // If no emails were found in the entire file, provide a clear, helpful message
        if (validEmails.size === 0) {
          resolve({
            emails: [],
            errors: ['No email addresses found in the uploaded file. Please upload a CSV or TXT file containing email leads.'],
            duplicates: 0,
          });
          return;
        }

        resolve({
          emails: Array.from(validEmails),
          errors: errors.slice(0, 5),
          duplicates: duplicateCount,
          recipientParams,
          detectedVariables: Array.from(detectedVarsSet),
        });
      } catch (err: any) {
        reject(new Error(err.message || 'Failed to parse file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
