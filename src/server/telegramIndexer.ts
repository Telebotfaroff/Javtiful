import { detectJavCode } from './codeDetector.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import {
  TelegramDb,
  type TelegramVideoIndexRecord,
  type TelegramGalleryItem,
  type TelegramVideoFile,
} from './telegramDb.ts';

export interface IndexResult {
  success: boolean;
  type?: 'video' | 'photo' | 'media_group';
  code?: string;
  metadataFound?: boolean;
  duplicate?: boolean;
  messageId?: number;
  channelId?: string;
  galleryCount?: number;
  videoPartsCount?: number;
  reason?: string;
  record?: TelegramVideoIndexRecord;
}

export class TelegramIndexer {
  static async processUpdate(update: any): Promise<IndexResult> {
    if (!update || typeof update !== 'object') return { success: false, reason: 'Invalid update payload' };
    const post = update.channel_post || update.message;
    if (!post) return { success: false, reason: 'Update does not contain channel_post or message' };
    return this.processPost(post);
  }

  static async processPost(post: any): Promise<IndexResult> {
    const channelId = String(post.chat?.id || '');
    const configuredChannel = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (configuredChannel && channelId !== configuredChannel) {
      return { success: false, channelId, reason: `Ignoring post from unexpected channel ${channelId}` };
    }
    const messageId = Number(post.message_id || 0);
    const mediaGroupId = post.media_group_id ? String(post.media_group_id) : undefined;
    const caption = post.caption || post.text || '';

    const detected = detectJavCode(caption);
    let code = detected?.canonical;

    // Handle Media Group / Album synchronization
    if (mediaGroupId) {
      if (code) {
        await TelegramDb.setMediaGroupCode(mediaGroupId, code);
        const pending = await TelegramDb.getPendingMediaGroup(mediaGroupId);
        if (pending) {
          if (pending.photos && pending.photos.length > 0) {
            for (const photo of pending.photos) {
              await TelegramDb.addGalleryPhoto(code, photo, pending.channel_id);
            }
          }
          if (pending.videos && pending.videos.length > 0) {
            for (const vid of pending.videos) {
              await TelegramDb.addVideoFile(code, vid, pending.channel_id);
            }
          }
          await TelegramDb.clearPendingMediaGroup(mediaGroupId);
        }
      } else {
        code = await TelegramDb.getCodeByMediaGroup(mediaGroupId);
      }
    }

    // Identify Video or Document Video
    let videoObj = post.video;
    if (!videoObj && post.document) {
      const mime = post.document.mime_type || '';
      const fname = (post.document.file_name || '').toLowerCase();
      if (
        mime.startsWith('video/') ||
        fname.endsWith('.mp4') ||
        fname.endsWith('.mkv') ||
        fname.endsWith('.avi') ||
        fname.endsWith('.mov') ||
        fname.endsWith('.ts')
      ) {
        videoObj = post.document;
      }
    }

    // Identify Photo
    const isPhoto = Array.isArray(post.photo) && post.photo.length > 0;

    if (!videoObj && !isPhoto) {
      return { success: false, messageId, channelId, reason: 'Post contains neither a video nor a photo' };
    }

    // If code is not yet resolved for this post:
    if (!code) {
      if (mediaGroupId) {
        if (isPhoto) {
          const highestRes = post.photo[post.photo.length - 1];
          await TelegramDb.addPendingMediaGroupPhoto(mediaGroupId, {
            channel_id: channelId,
            message_id: messageId,
            file_id: highestRes.file_id,
            file_unique_id: highestRes.file_unique_id,
            width: highestRes.width,
            height: highestRes.height,
          });
          return {
            success: true,
            type: 'photo',
            messageId,
            channelId,
            reason: 'Photo queued in pending media-group album',
          };
        }

        if (videoObj && videoObj.file_id) {
          await TelegramDb.addPendingMediaGroupVideo(mediaGroupId, {
            channel_id: channelId,
            message_id: messageId,
            file_id: videoObj.file_id,
            file_unique_id: videoObj.file_unique_id,
            duration: videoObj.duration,
            width: videoObj.width,
            height: videoObj.height,
            file_size: videoObj.file_size,
            mime_type: videoObj.mime_type || 'video/mp4',
          });
          return {
            success: true,
            type: 'video',
            messageId,
            channelId,
            reason: 'Video part queued in pending media-group album',
          };
        }
      }

      return {
        success: false,
        messageId,
        channelId,
        reason: `Could not identify JAV code from caption ("${caption.slice(0, 50)}") or media_group_id`,
      };
    }

    // Code is resolved! Check metadata enrichment
    let metadataFound = false;
    try {
      const ghLookup = await GithubMetadataService.lookup(code);
      metadataFound = Boolean(ghLookup.metadataFound && ghLookup.video);
    } catch (e: any) {
      console.warn(`GitHub metadata lookup error for ${code}:`, e.message);
    }

    // Handle Photo ingest into Gallery
    if (isPhoto) {
      const highestRes = post.photo[post.photo.length - 1];
      const photoItem: TelegramGalleryItem = {
        message_id: messageId,
        file_id: highestRes.file_id,
        file_unique_id: highestRes.file_unique_id,
        width: highestRes.width,
        height: highestRes.height,
      };

      const updatedRecord = await TelegramDb.addGalleryPhoto(code, photoItem, channelId);
      return {
        success: true,
        type: 'photo',
        code,
        metadataFound,
        messageId,
        channelId,
        galleryCount: updatedRecord.telegram.gallery?.length || 1,
        videoPartsCount: updatedRecord.telegram.videos?.length || 0,
        record: updatedRecord,
      };
    }

    // Handle Video ingest into Multi-Part Video Files
    if (videoObj && videoObj.file_id) {
      // Detect optional label from caption (e.g., "Part 1", "CD2", "4K Version")
      let label: string | undefined;
      const partMatch = caption.match(/(?:part|cd|disc|clip|ep|episode)\s*([0-9]+|[a-z])/i);
      if (partMatch) {
        label = `Part ${partMatch[1].toUpperCase()}`;
      }

      const videoItem: TelegramVideoFile = {
        message_id: messageId,
        file_id: videoObj.file_id,
        file_unique_id: videoObj.file_unique_id,
        duration: videoObj.duration,
        width: videoObj.width,
        height: videoObj.height,
        file_size: videoObj.file_size,
        mime_type: videoObj.mime_type || 'video/mp4',
        label,
      };

      const updatedRecord = await TelegramDb.addVideoFile(code, videoItem, channelId);

      return {
        success: true,
        type: 'video',
        code,
        metadataFound,
        messageId,
        channelId,
        galleryCount: updatedRecord.telegram.gallery?.length || 0,
        videoPartsCount: updatedRecord.telegram.videos?.length || 1,
        record: updatedRecord,
      };
    }

    return {
      success: false,
      messageId,
      channelId,
      reason: 'No valid photo or video payload found',
    };
  }
}
