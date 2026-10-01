import { detectJavCode } from './codeDetector.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import { TelegramDb, type TelegramVideoIndexRecord, type TelegramGalleryItem } from './telegramDb.ts';

export interface IndexResult {
  success: boolean;
  type?: 'video' | 'photo';
  code?: string;
  metadataFound?: boolean;
  duplicate?: boolean;
  messageId?: number;
  channelId?: string;
  galleryCount?: number;
  reason?: string;
  record?: TelegramVideoIndexRecord;
}

export class TelegramIndexer {
  /**
   * Process an incoming Telegram update (supports channel_post and message)
   */
  static async processUpdate(update: any): Promise<IndexResult> {
    if (!update || typeof update !== 'object') {
      return { success: false, reason: 'Invalid update payload' };
    }

    const post = update.channel_post || update.message;
    if (!post) {
      return { success: false, reason: 'Update does not contain channel_post or message' };
    }

    return this.processPost(post);
  }

  /**
   * Process a single channel_post or message object (Video or Photo)
   */
  static async processPost(post: any): Promise<IndexResult> {
    const channelId = String(post.chat?.id || '');
    const messageId = Number(post.message_id || 0);
    const mediaGroupId = post.media_group_id ? String(post.media_group_id) : undefined;
    const caption = post.caption || post.text || '';

    // 1. Detect code from caption or text if present
    const detected = detectJavCode(caption);
    let code = detected?.canonical;

    // 2. Media Group (Album) association (Method A - Section 8 & Requirement 7)
    if (mediaGroupId) {
      if (code) {
        // Persistently record mapping so subsequent photos in this media_group inherit this code
        await TelegramDb.setMediaGroupCode(mediaGroupId, code);
      } else {
        // Retrieve code previously registered for this media_group
        code = TelegramDb.getCodeByMediaGroup(mediaGroupId);
      }
    }

    // 3. Identify Media Type (Video vs Photo)
    let videoObj = post.video;
    if (!videoObj && post.document && post.document.mime_type?.startsWith('video/')) {
      videoObj = post.document;
    }

    const isPhoto = Array.isArray(post.photo) && post.photo.length > 0;

    if (!videoObj && !isPhoto) {
      return {
        success: false,
        messageId,
        channelId,
        reason: 'Post contains neither a video nor a photo',
      };
    }

    // Check code availability
    if (!code) {
      return {
        success: false,
        messageId,
        channelId,
        reason: `Could not identify JAV code from caption ("${caption.slice(0, 50)}") or media_group_id`,
      };
    }

    // 4. Query GitHub Metadata existence check (Section 5)
    let metadataFound = false;
    try {
      const ghLookup = await GithubMetadataService.lookup(code);
      if (ghLookup.metadataFound && ghLookup.video) {
        metadataFound = true;
      }
    } catch (e: any) {
      console.warn(`GitHub metadata lookup error for ${code}:`, e.message);
    }

    // CASE A: Post is a PHOTO / SCREENSHOT (Method A & B - Section 8)
    if (isPhoto) {
      const highestRes = post.photo[post.photo.length - 1];
      const photoItem: TelegramGalleryItem = {
        message_id: messageId,
        file_id: highestRes.file_id,
        file_unique_id: highestRes.file_unique_id,
        width: highestRes.width,
        height: highestRes.height,
      };

      const updatedRecord = await TelegramDb.addGalleryPhoto(
        code,
        photoItem,
        channelId,
        metadataFound
      );

      return {
        success: true,
        type: 'photo',
        code,
        metadataFound: updatedRecord.metadataFound,
        messageId,
        channelId,
        galleryCount: updatedRecord.telegram.gallery?.length || 1,
        record: updatedRecord,
      };
    }

    // CASE B: Post is a VIDEO
    // Validate non-empty file_id
    if (!videoObj.file_id || typeof videoObj.file_id !== 'string') {
      return {
        success: false,
        messageId,
        channelId,
        reason: 'Broken or empty video file_id',
      };
    }

    // Duplicate prevention for same channel + message (Section 18 & Requirement 8)
    const isDuplicate = await TelegramDb.hasMessage(channelId, messageId);
    if (isDuplicate) {
      const existing = await TelegramDb.getVideo(code);
      return {
        success: true,
        type: 'video',
        code,
        duplicate: true,
        messageId,
        channelId,
        reason: `Video message ${messageId} in channel ${channelId} already indexed`,
        record: existing || undefined,
      };
    }

    // Handle higher-quality repost / re-encode (Section 18)
    const existingForCode = await TelegramDb.getVideo(code);
    if (existingForCode && existingForCode.telegram.video_file_id) {
      const existingWidth = existingForCode.telegram.width || 0;
      const incomingWidth = videoObj.width || 0;
      const existingSize = existingForCode.telegram.file_size || 0;
      const incomingSize = videoObj.file_size || 0;

      const isUpgrade =
        incomingWidth > existingWidth ||
        (incomingWidth === existingWidth && incomingSize > existingSize);

      if (isUpgrade) {
        existingForCode.telegram.video_file_id = videoObj.file_id;
        existingForCode.telegram.file_unique_id =
          videoObj.file_unique_id || existingForCode.telegram.file_unique_id;
        existingForCode.telegram.width = videoObj.width || existingForCode.telegram.width;
        existingForCode.telegram.height = videoObj.height || existingForCode.telegram.height;
        existingForCode.telegram.file_size = videoObj.file_size || existingForCode.telegram.file_size;
        existingForCode.telegram.duration = videoObj.duration || existingForCode.telegram.duration;
        existingForCode.updated_at = new Date().toISOString();

        await TelegramDb.saveVideo(existingForCode);
        return {
          success: true,
          type: 'video',
          code,
          metadataFound: existingForCode.metadataFound,
          duplicate: false,
          messageId,
          channelId,
          reason: 'Upgraded video file_id with higher quality release',
          record: existingForCode,
        };
      }
    }

    // Assemble video record (Only Telegram media & index info, Requirement 3 & 4)
    const record: TelegramVideoIndexRecord = {
      code,
      telegram: {
        channel_id: channelId,
        message_id: messageId,
        video_file_id: videoObj.file_id,
        file_unique_id: videoObj.file_unique_id,
        duration: videoObj.duration,
        width: videoObj.width,
        height: videoObj.height,
        file_size: videoObj.file_size,
        mime_type: videoObj.mime_type || 'video/mp4',
        media_group_id: mediaGroupId,
      },
      metadataFound,
      indexed_at: new Date().toISOString(),
    };

    // Save to separate Telegram database
    await TelegramDb.saveVideo(record);

    return {
      success: true,
      type: 'video',
      code,
      metadataFound,
      duplicate: false,
      messageId,
      channelId,
      record,
    };
  }
}
