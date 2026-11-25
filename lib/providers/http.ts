import * as https from 'https';

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody).toString(),
        ...headers
      }
    }, (res) => {
      let responseBody = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        const status = res.statusCode || 0;

        if (status < 200 || status >= 300) {
          reject(new ProviderError(`${status} ${res.statusMessage || 'API error'}: ${responseBody.slice(0, 500)}`, status));
          return;
        }

        try {
          resolve(JSON.parse(responseBody) as T);
        } catch (error) {
          reject(new ProviderError(`Invalid JSON response: ${(error as Error).message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new ProviderError('API request timed out'));
    });
    req.write(requestBody);
    req.end();
  });
}
