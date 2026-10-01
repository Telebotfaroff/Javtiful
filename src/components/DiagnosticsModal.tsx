import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Send,
  Github,
  Radio,
  Play,
  Square,
  X,
  Zap,
} from 'lucide-react';

interface SystemStatusData {
  ok: boolean;
  database?: {
    connected: boolean;
    video_count: number;
    error: string | null;
  };
  telegram?: {
    bot_configured: boolean;
    bot_info: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
      can_join_groups: boolean;
      can_read_all_group_messages: boolean;
    } | null;
    webhook_info: {
      url: string;
      has_custom_certificate: boolean;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
    } | null;
    polling_status?: {
      active: boolean;
      lastPollTime: string | null;
      lastSuccessTime: string | null;
      processedCount: number;
      lastError: string | null;
      consecutiveErrors: number;
    };
    channel_id: string | null;
    admin_id: string | null;
    webhook_secret_set: boolean;
    admin_secret_set: boolean;
    error: string | null;
  };
  github?: {
    scraper_repo: string;
    backup_repo: string;
    cache_stats: { size: number; prefixes?: string[] };
  };
  environment?: Record<string, boolean>;
}

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingActionLoading, setPollingActionLoading] = useState(false);
  const [webhookSetting, setWebhookSetting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/system/status');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      console.error('Failed to fetch system status', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleTogglePolling = async (start: boolean) => {
    setPollingActionLoading(true);
    setActionMessage(null);
    try {
      const endpoint = start ? '/api/telegram/bot/polling/start' : '/api/telegram/bot/polling/stop';
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json();
      setActionMessage(json.ok ? `✅ ${json.message}` : `❌ ${json.error || json.message}`);
      await fetchStatus();
    } catch (e: any) {
      setActionMessage(`❌ Error: ${e.message}`);
    } finally {
      setPollingActionLoading(false);
    }
  };

  const handleSetupWebhook = async () => {
    setWebhookSetting(true);
    setActionMessage(null);
    try {
      const targetUrl = `${window.location.origin}/api/telegram/webhook`;
      const res = await fetch('/api/telegram/bot/setup-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const json = await res.json();
      if (json.ok && json.telegram_response?.ok) {
        setActionMessage(`✅ Webhook registered to ${targetUrl}`);
        fetchStatus();
      } else {
        setActionMessage(`❌ Webhook error: ${json.telegram_response?.description || json.error}`);
      }
    } catch (e: any) {
      setActionMessage(`❌ Error: ${e.message}`);
    } finally {
      setWebhookSetting(false);
    }
  };

  if (!isOpen) return null;

  const isPolling = data?.telegram?.polling_status?.active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#111827] border border-gray-800 p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                System Diagnostics & Telegram Linkage
              </h2>
              <p className="text-xs text-gray-400">
                Live status of Neon Database, Telegram Bot Listener, and Catalog
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Neon Database Card */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Neon PostgreSQL Database</h3>
                  <p className="text-xs text-gray-400">Live indexed video and gallery store</p>
                </div>
              </div>
              {data?.database?.connected ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected ({data.database.video_count} indexed videos)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                  <XCircle className="h-3.5 w-3.5" />
                  Disconnected
                </span>
              )}
            </div>
            {data?.database?.error && (
              <p className="mt-2 text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-900/50">
                {data.database.error}
              </p>
            )}
          </div>

          {/* Telegram Listener & Delivery Card */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Send className="h-5 w-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Telegram Bot: {data?.telegram?.bot_info ? `@${data.telegram.bot_info.username}` : 'Not Connected'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {data?.telegram?.bot_info?.first_name || 'Bot token configuration'}
                  </p>
                </div>
              </div>
              {isPolling ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Long-Polling Active (Recommended)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Listener Idle
                </span>
              )}
            </div>

            {/* Long-Polling Info Box */}
            <div className="bg-gray-950/70 rounded-lg p-3 text-xs space-y-2 border border-gray-800/80">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 font-medium">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  Background Long Polling:
                </span>
                <span className="text-gray-200 font-mono">
                  {isPolling ? 'Listening on Telegram API' : 'Stopped'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Processed Updates:</span>
                <span className="text-white font-mono">{data?.telegram?.polling_status?.processedCount ?? 0}</span>
              </div>
              {data?.telegram?.polling_status?.lastSuccessTime && (
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Last Received Event:</span>
                  <span className="text-emerald-400 font-mono">
                    {new Date(data.telegram.polling_status.lastSuccessTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {data?.telegram?.polling_status?.lastError && (
                <div className="text-rose-400 bg-rose-950/30 p-2 rounded text-[11px] border border-rose-900/40">
                  Error: {data.telegram.polling_status.lastError}
                </div>
              )}
            </div>

            {/* Actions for Polling & Webhook */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {isPolling ? (
                <button
                  onClick={() => handleTogglePolling(false)}
                  disabled={pollingActionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors"
                >
                  <Square className="h-3.5 w-3.5 text-rose-400" />
                  Stop Long Polling
                </button>
              ) : (
                <button
                  onClick={() => handleTogglePolling(true)}
                  disabled={pollingActionLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-sm shadow-emerald-900/40"
                >
                  <Play className="h-3.5 w-3.5" />
                  Start Long Polling (No Webhook Required)
                </button>
              )}

              <button
                onClick={handleSetupWebhook}
                disabled={webhookSetting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors"
              >
                <Radio className={`h-3.5 w-3.5 text-sky-400 ${webhookSetting ? 'animate-pulse' : ''}`} />
                {webhookSetting ? 'Setting Webhook...' : 'Register Webhook Instead'}
              </button>
            </div>

            {actionMessage && (
              <p className="text-xs text-sky-300 font-mono mt-1 bg-sky-950/40 p-2 rounded border border-sky-900/50">
                {actionMessage}
              </p>
            )}
          </div>

          {/* GitHub Metadata Linkage */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Github className="h-5 w-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">GitHub Repositories</h3>
                  <p className="text-xs text-gray-400">Metadata scraper catalog & backup store</p>
                </div>
              </div>
              <span className="text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                {data?.github?.cache_stats.size ?? 0} Shards Cached
              </span>
            </div>
            <div className="text-xs text-gray-400 font-mono space-y-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
              <div>Scraper: <span className="text-gray-200">{data?.github?.scraper_repo}</span></div>
              <div>Backup: <span className="text-gray-200">{data?.github?.backup_repo}</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
