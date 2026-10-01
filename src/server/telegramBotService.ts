import { detectJavCode } from './codeDetector.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import { TelegramDb } from './telegramDb.ts';

export interface BotActionResponse {
  ok: boolean;
  action: 'sendVideo' | 'copyMessage' | 'sendMessage';
  chat_id: number | string;
  code?: string;
  video_file_id?: string;
  from_chat_id?: string;
  message_id?: number;
  text?: string;
  caption?: string;
  error?: string;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class TelegramBotService {
  private static getBotToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Main entry point for handling private messages sent to the bot
   */
  static async handlePrivateMessage(message: any): Promise<BotActionResponse> {
    const chatId = message.chat?.id;
    const text = (message.text || '').trim();

    if (!chatId) {
      return { ok: false, action: 'sendMessage', chat_id: 0, error: 'Missing chat_id' };
    }

    // Command: /help
    if (text === '/help') {
      return this.handleHelp(chatId);
    }

    // Command: /status
    if (text === '/status') {
      return this.handleStatus(chatId);
    }

    // Command: /start or /start <code>
    if (text.startsWith('/start')) {
      const param = text.slice(6).trim();
      if (!param) {
        return this.handleStartNoCode(chatId);
      }
      return this.handleStartWithCode(chatId, param);
    }

    // Free text: try detecting JAV code
    const detected = detectJavCode(text);
    if (detected) {
      return this.handleStartWithCode(chatId, detected.canonical);
    }

    // Unknown message
    return this.sendMessage(
      chatId,
      `👋 <b>Welcome to the JAVTIFUL Media Bot!</b>\n\n` +
      `To request a video, send a valid JAV code (e.g. <code>016DHT-0881</code>) or click <b>GET VIDEO</b> on our web catalog.\n\n` +
      `Commands:\n` +
      `• /start - Welcome menu\n` +
      `• /help - Bot usage instructions\n` +
      `• /status - System index status`
    );
  }

  /**
   * Handle /start with JAV code: /start ABC-123
   */
  static async handleStartWithCode(chatId: number | string, rawCode: string): Promise<BotActionResponse> {
    const detected = detectJavCode(rawCode);
    const code = detected ? detected.canonical : rawCode.trim().toUpperCase();

    // 1. Look up in Telegram JSON Database (Section 14 & 6)
    const tgRecord = await TelegramDb.getVideo(code);

    // 2. Fetch authoritative metadata from GitHub scraper (Requirement 4)
    let metadata: any = null;
    let metadataFound = tgRecord?.metadataFound || false;

    try {
      const ghResult = await GithubMetadataService.lookup(code);
      if (ghResult.metadataFound && ghResult.video) {
        metadataFound = true;
        metadata = ghResult.video;
      }
    } catch (e: any) {
      console.warn(`GitHub metadata lookup error for ${code}:`, e.message);
    }

    // CASE 1: Video exists in Telegram JSON database
    if (tgRecord && tgRecord.telegram && (tgRecord.telegram.video_file_id || tgRecord.telegram.message_id)) {
      const safeTitle = escapeHtml(metadata?.title || `Release ${code}`);
      const safeActress = metadata?.actresses && metadata.actresses.length > 0
        ? escapeHtml(metadata.actresses.join(', '))
        : 'N/A';
      const safeStudio = escapeHtml(metadata?.studio || 'N/A');
      const safeDuration = escapeHtml(metadata?.duration || 'N/A');
      const safeDate = escapeHtml(metadata?.date || 'N/A');
      const safeCode = escapeHtml(code);

      const caption =
        `🎬 <b>${safeTitle}</b>\n\n` +
        `🆔 <b>Code:</b> <code>${safeCode}</code>\n` +
        `👩 <b>Actress:</b> ${safeActress}\n` +
        `🏢 <b>Studio:</b> ${safeStudio}\n` +
        `⏱ <b>Duration:</b> ${safeDuration}\n` +
        `📅 <b>Release Date:</b> ${safeDate}\n\n` +
        `✨ <i>Delivered instantly by JAVTIFUL Bot</i>`;

      // Method A: sendVideo with file_id
      if (tgRecord.telegram.video_file_id) {
        return this.sendVideo(chatId, code, tgRecord.telegram.video_file_id, caption);
      }

      // Method B: copyMessage from source channel
      return this.copyMessage(
        chatId,
        code,
        tgRecord.telegram.channel_id,
        tgRecord.telegram.message_id,
        caption
      );
    }

    // CASE 2: Code exists in GitHub, but video not yet uploaded to Telegram channel
    if (metadataFound && metadata) {
      const safeTitle = escapeHtml(metadata.title || code);
      const safeActress = escapeHtml(metadata.actresses?.join(', ') || 'N/A');
      const safeCode = escapeHtml(code);
      const message =
        `⚠️ <b>Video Not Available Yet</b>\n\n` +
        `We found the catalog metadata for <b>${safeCode}</b>:\n` +
        `🎬 <i>${safeTitle}</i>\n` +
        `👩 <b>Actress:</b> ${safeActress}\n\n` +
        `However, the full video has not been uploaded to the Telegram channel yet.\n` +
        `Please check back later or monitor our updates!`;

      return this.sendMessage(chatId, message, code);
    }

    // CASE 3: Missing Code (neither in Telegram DB nor GitHub)
    const safeCode = escapeHtml(code);
    const notFoundMessage =
      `❌ <b>Video Not Found</b>\n\n` +
      `We could not find any records for code: <code>${safeCode}</code>.\n\n` +
      `Please verify the JAV code formatting (e.g. <code>016DHT-0881</code>) or browse our web catalog.`;

    return this.sendMessage(chatId, notFoundMessage, code);
  }

  /**
   * Handle /start with no parameter
   */
  static async handleStartNoCode(chatId: number | string): Promise<BotActionResponse> {
    const text =
      `👋 <b>Welcome to JAVTIFUL Media Delivery Bot!</b>\n\n` +
      `This bot delivers high-definition JAV videos directly inside Telegram.\n\n` +
      `<b>How to use:</b>\n` +
      `1. Browse the web catalog and click <b>GET VIDEO</b> on any title.\n` +
      `2. Or send a command here: <code>/start 016DHT-0881</code>\n` +
      `3. The bot will automatically deliver the video file to this chat.\n\n` +
      `Type /help for more instructions.`;

    return this.sendMessage(chatId, text);
  }

  /**
   * Handle /help
   */
  static async handleHelp(chatId: number | string): Promise<BotActionResponse> {
    const text =
      `ℹ️ <b>JAVTIFUL Bot Help & Guide</b>\n\n` +
      `• <b>Deep Linking:</b> Click <b>GET VIDEO</b> on the website to open the bot with the pre-filled code.\n` +
      `• <b>Manual Request:</b> Send <code>/start CODE</code> (e.g. <code>/start 016DHT-0881</code>).\n` +
      `• <b>Fast Search:</b> Just type a code in this chat to search.\n` +
      `• <b>Support:</b> All video files are delivered via Telegram cloud streaming without downloading.`;

    return this.sendMessage(chatId, text);
  }

  /**
   * Handle /status
   */
  static async handleStatus(chatId: number | string): Promise<BotActionResponse> {
    const count = await TelegramDb.getCount();
    const cacheStats = GithubMetadataService.getCacheStats();

    const text =
      `📊 <b>System Status</b>\n\n` +
      `• <b>Indexed Telegram Videos:</b> ${count}\n` +
      `• <b>GitHub Cached Shards:</b> ${cacheStats.size}\n` +
      `• <b>Service Status:</b> Operational 🟢\n` +
      `• <b>Storage:</b> Local JSON Database`;

    return this.sendMessage(chatId, text);
  }

  /**
   * Dispatch sendVideo call to Telegram Bot API
   */
  private static async sendVideo(
    chatId: number | string,
    code: string,
    videoFileId: string,
    caption: string
  ): Promise<BotActionResponse> {
    const token = this.getBotToken();

    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            video: videoFileId,
            caption,
            parse_mode: 'HTML',
          }),
        });
      } catch (e: any) {
        console.error('Failed to dispatch sendVideo to Telegram API:', e.message);
      }
    }

    return {
      ok: true,
      action: 'sendVideo',
      chat_id: chatId,
      code,
      video_file_id: videoFileId,
      caption,
    };
  }

  /**
   * Dispatch copyMessage call to Telegram Bot API
   */
  private static async copyMessage(
    chatId: number | string,
    code: string,
    fromChatId: string,
    messageId: number,
    caption: string
  ): Promise<BotActionResponse> {
    const token = this.getBotToken();

    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            caption,
            parse_mode: 'HTML',
          }),
        });
      } catch (e: any) {
        console.error('Failed to dispatch copyMessage to Telegram API:', e.message);
      }
    }

    return {
      ok: true,
      action: 'copyMessage',
      chat_id: chatId,
      code,
      from_chat_id: fromChatId,
      message_id: messageId,
      caption,
    };
  }

  /**
   * Dispatch sendMessage call to Telegram Bot API
   */
  private static async sendMessage(
    chatId: number | string,
    text: string,
    code?: string
  ): Promise<BotActionResponse> {
    const token = this.getBotToken();

    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        });
      } catch (e: any) {
        console.error('Failed to dispatch sendMessage to Telegram API:', e.message);
      }
    }

    return {
      ok: true,
      action: 'sendMessage',
      chat_id: chatId,
      code,
      text,
    };
  }
}
