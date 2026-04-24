/**
 * MB Bank Service — Cookie/Session + apicanhan.com API fallback
 * Logic copy từ shop-mmo mbbank-web.ts, giữ nguyên exports cho ChoTaiNguyen
 */

interface MBBankConfig {
  username: string;
  password: string;
  accountNo: string;
  apicanhanKey?: string;
  sessionId?: string;
  token?: string;
  cookie?: string;
  deviceid?: string;
}

interface MBBankTransaction {
  transactionID: string;
  amount: string;
  description: string;
  transactionDate: string;
  type: 'IN' | 'OUT';
}

// Config từ environment variables
const getMBBankConfig = (): MBBankConfig => {
  const username = process.env.MBBANK_USERNAME;
  const password = process.env.MBBANK_PASSWORD;
  const accountNo = process.env.MBBANK_ACCOUNT;
  const apicanhanKey = process.env.APICANHAN_KEY;

  if (!username || !password || !accountNo) {
    console.error('[MB Bank] Missing required environment variables: MBBANK_USERNAME, MBBANK_PASSWORD, MBBANK_ACCOUNT');
    throw new Error('Missing required MB Bank configuration. Please set environment variables.');
  }

  if (!apicanhanKey) {
    console.warn('[MB Bank] APICANHAN_KEY not set - fallback API will not work');
  }

  return {
    username,
    password,
    accountNo,
    apicanhanKey: apicanhanKey || '',
    sessionId: process.env.MBBANK_SESSION_ID || '',
    token: process.env.MBBANK_TOKEN || '',
    cookie: process.env.MBBANK_COOKIE || '',
    deviceid: process.env.MBBANK_DEVICEID || ''
  };
};

/**
 * Lấy danh sách giao dịch từ MB Bank
 * Ưu tiên cookie/session → fallback apicanhan.com
 */
export async function fetchMBBankTransactionsFromWeb(): Promise<MBBankTransaction[]> {
  const config = getMBBankConfig();

  try {
    // Ưu tiên sử dụng cookie/session để truy cập trực tiếp vào MB Bank website
    if (config.cookie && config.sessionId) {
      console.log('[MB Bank] Sử dụng cookie/session để truy cập MB Bank website...');
      try {
        const transactions = await fetchTransactionsWithSession(config);
        if (transactions && transactions.length > 0) {
          return transactions;
        }
      } catch (sessionError) {
        console.warn('[MB Bank] Lỗi khi dùng session, fallback về API:', sessionError);
      }
    }

    // Fallback: Sử dụng API apicanhan
    console.log('[MB Bank] Sử dụng API apicanhan.com như fallback...');
    return await fetchTransactionsViaAPI(config);

  } catch (error) {
    console.error('[MB Bank] Lỗi khi lấy giao dịch:', error);
    // Fallback cuối cùng
    try {
      return await fetchTransactionsViaAPI(config);
    } catch (fallbackError) {
      console.error('[MB Bank] Lỗi cả fallback:', fallbackError);
      throw new Error('Không thể lấy giao dịch từ MB Bank');
    }
  }
}

/**
 * Lấy giao dịch sử dụng cookie/session từ MB Bank website
 */
async function fetchTransactionsWithSession(config: MBBankConfig): Promise<MBBankTransaction[]> {
  try {
    const endpoints = [
      `https://online.mbbank.com.vn/api/retail/transaction-account/so-tien-giao-dich`,
      `https://online.mbbank.com.vn/api/retail/transaction-account/get`,
      `https://online.mbbank.com.vn/api/retail/transaction/list`
    ];

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://online.mbbank.com.vn',
      'Referer': 'https://online.mbbank.com.vn/',
    };

    if (config.cookie) {
      headers['Cookie'] = config.cookie;
    }

    if (config.sessionId) {
      headers['X-Session-Id'] = config.sessionId;
      headers['sessionId'] = config.sessionId;
    }

    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
      headers['token'] = config.token;
    }

    if (config.deviceid) {
      headers['deviceIdCommon'] = config.deviceid;
      headers['device-id'] = config.deviceid;
    }

    // Thử từng endpoint
    for (const url of endpoints) {
      try {
        console.log(`[MB Bank] Thử endpoint: ${url}`);

        const requestBody = {
          accountNo: config.accountNo,
          fromDate: getDateDaysAgo(30),
          toDate: getCurrentDate(),
          historyNumber: '',
          historyType: 'DATE_RANGE',
          refNo: '',
          sessionId: config.sessionId,
          deviceIdCommon: config.deviceid
        };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          console.warn(`[MB Bank] Endpoint ${url} trả về status ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Parse response từ MB Bank API (nhiều format khác nhau)
        let transactions: any[] = [];

        if (data && data.data && Array.isArray(data.data)) {
          transactions = data.data;
        } else if (data && Array.isArray(data)) {
          transactions = data;
        } else if (data && data.transactions && Array.isArray(data.transactions)) {
          transactions = data.transactions;
        } else if (data && data.result && Array.isArray(data.result)) {
          transactions = data.result;
        }

        if (transactions.length > 0) {
          console.log(`[MB Bank] ✅ Lấy được ${transactions.length} giao dịch từ endpoint: ${url}`);
          return transactions.map((tx: any) => ({
            transactionID: tx.refNo || tx.transactionId || tx.id || '',
            amount: Math.abs(parseInt(tx.amount?.toString() || '0')).toString(),
            description: tx.description || tx.content || tx.remark || '',
            transactionDate: formatTransactionDate(tx.transactionDate || tx.date || tx.createdAt),
            type: (tx.amount >= 0 || tx.type === 'IN' || tx.direction === 'IN') ? 'IN' : 'OUT'
          }));
        }

      } catch (endpointError) {
        console.warn(`[MB Bank] Lỗi với endpoint ${url}:`, endpointError);
        continue;
      }
    }

    throw new Error('Không thể lấy giao dịch từ bất kỳ endpoint nào');

  } catch (error) {
    console.error('[MB Bank] Lỗi khi fetch với session:', error);
    throw error;
  }
}

/**
 * Fallback: Lấy giao dịch qua API apicanhan.com
 */
async function fetchTransactionsViaAPI(config: MBBankConfig): Promise<MBBankTransaction[]> {
  try {
    const params = new URLSearchParams({
      key: config.apicanhanKey || '',
      username: config.username,
      password: config.password,
      accountNo: config.accountNo
    });

    const url = `https://apicanhan.com/api/mbbankv3?${params.toString()}`;

    console.log(`[MB Bank] Đang gọi API apicanhan: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.transactions) {
        console.log(`[MB Bank] ✅ Lấy được ${data.transactions.length} giao dịch từ API`);
        // Normalize apicanhan response fields to our standard MBBankTransaction format
        // apicanhan returns: creditAmount/debitAmount, addDescription, transactionNumber, etc.
        return data.transactions.map((tx: any) => {
          const rawAmount = tx.creditAmount || tx.amount || tx.debitAmount || 0;
          const amount = Math.abs(typeof rawAmount === 'string' ? parseInt(rawAmount) : rawAmount);
          const description = tx.description || tx.addDescription || tx.content || tx.remark || '';
          const txnId = String(tx.transactionNumber || tx.refNo || tx.transactionID || tx.id || '');
          const txDate = tx.transactionDate || tx.date || tx.createdAt || '';
          const isIncoming = (tx.creditAmount && Number(tx.creditAmount) > 0) || tx.type === 'IN' || tx.direction === 'IN' || (!tx.debitAmount && rawAmount > 0);

          return {
            transactionID: txnId,
            amount: amount.toString(),
            description,
            transactionDate: String(txDate || ''),
            type: isIncoming ? 'IN' : 'OUT',
          } as MBBankTransaction;
        });
      } else {
        console.error(`[MB Bank] ❌ API trả về lỗi:`, data);
        throw new Error(data.message || 'Lỗi từ MB Bank API');
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') throw new Error('Timeout 30s khi gọi apicanhan.com');
      throw error;
    }
  } catch (error) {
    console.error(`[MB Bank] ❌ Lỗi khi gọi API:`, error);
    throw error;
  }
}

// ============ Helper Functions ============

function getCurrentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTransactionDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr;
  }
}

// ============ QR Code + Legacy Wrappers (giữ nguyên) ============

// QR code URL generator
export function generateQRUrl(accountNo: string, amount: number, content: string): string {
  const ownerName = process.env.MBBANK_OWNER_NAME || 'NGUYEN TAI DAT';
  const params = new URLSearchParams({ amount: amount.toString(), addInfo: content, accountName: ownerName });
  return `https://img.vietqr.io/image/MB-${accountNo}-compact.png?${params.toString()}`;
}

// Legacy wrapper for existing endpoints
export class MBBankService {
  async getTransactions(limit = 20) {
    try {
      const txs = await fetchMBBankTransactionsFromWeb();
      return txs.slice(0, limit).map(t => ({
        transaction_id: t.transactionID,
        amount: parseInt(t.amount),
        description: t.description,
        transaction_date: t.transactionDate,
        type: t.type,
      }));
    } catch (e: any) {
      console.error('[MBBankService] getTransactions error:', e.message);
      return null;
    }
  }

  async checkDeposit(content: string, amount: number) {
    const txs = await this.getTransactions(50);
    if (!txs) return null;
    const searchCode = content.toUpperCase().replace(/\s/g, '');
    console.log(`[MBBankService] Searching for code="${searchCode}", amount=${amount}, total txs=${txs.length}`);
    for (const tx of txs) {
      if (tx.amount <= 0) continue;
      const txDesc = (tx.description || '').toUpperCase().replace(/\s/g, '');
      const isContentMatch = txDesc.includes(searchCode);
      // So sánh số tiền (cho phép sai lệch 1000đ) — copy từ shop-mmo
      const amountDiff = Math.abs(tx.amount - amount);
      const isAmountMatch = amountDiff <= 1000;
      if (isContentMatch || (txDesc.length > 0 && txDesc.includes('CTN'))) {
        console.log(`[MBBankService] 🔍 Candidate: desc="${txDesc.substring(0, 80)}", txAmount=${tx.amount}, targetAmount=${amount}, contentMatch=${isContentMatch}, amountMatch=${isAmountMatch}`);
      }
      if (isContentMatch && isAmountMatch) {
        console.log(`[MBBankService] ✅ Tìm thấy giao dịch khớp: ${tx.transaction_id}, amount=${tx.amount}, desc=${tx.description?.substring(0, 80)}`);
        return tx;
      }
    }
    console.log(`[MBBankService] ❌ No match found for code="${searchCode}", amount=${amount}`);
    return null;
  }

  async testConnection() {
    const t = await this.getTransactions(1);
    return t !== null;
  }
}

let mbBankService: MBBankService | null = null;
export function getMBBankService(): MBBankService {
  if (!mbBankService) mbBankService = new MBBankService();
  return mbBankService;
}
