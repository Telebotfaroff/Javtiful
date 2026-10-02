import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const rl = readline.createInterface({ input, output });

const apiId = Number(process.env.TELEGRAM_API_ID || await rl.question('Telegram API ID: '));
const apiHash = process.env.TELEGRAM_API_HASH || await rl.question('Telegram API Hash: ');

if (!apiId || !apiHash) {
  rl.close();
  throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required.');
}

const session = new StringSession('');
const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => await rl.question('Telegram phone number: '),
  password: async () => await rl.question('2FA password (leave blank if none): '),
  phoneCode: async () => await rl.question('Telegram login code: '),
  onError: (err) => console.error('Telegram login error:', err),
});

console.log('\nTELEGRAM_STRING_SESSION=' + client.session.save());
console.log('\nSave this session securely as an environment variable. Do not commit it to GitHub.');

await client.disconnect();
rl.close();
