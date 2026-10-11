import { useEffect, useState } from "react";
import { type LogMessage, type LogRequest, STATUS_PORT, type StatusMessage } from "@/lib/messages";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  loadSettings,
  type Settings,
  saveSettings,
  watchSettings,
} from "@/lib/settings";
import type { Status } from "@/lib/status";

/** CSV をファイルとして保存する */
const saveCsv = (csv: string) => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `hayame-log-${stamp}.csv`;
  a.click();
  // すぐ解放すると保存が始まる前に消えることがあるので、少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * アクティブなタブの content script に繋ぎ、状態を受け取る。YouTube 以外では null のまま。
 * requestLog で直近の計測を CSV で受け取り、保存する
 */
const useStatus = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [port, setPort] = useState<Browser.runtime.Port | null>(null);
  useEffect(() => {
    let port: Browser.runtime.Port | null = null;
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id === undefined) return;
      port = browser.tabs.connect(tab.id, { name: STATUS_PORT });
      setPort(port);
      port.onMessage.addListener((m: StatusMessage | LogMessage) => {
        if (m.type === "status") setStatus(m.status);
        else saveCsv(m.csv);
      });
      // 受け手がいなければすぐ切れる。lastError を読んで警告を出さないようにする
      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        setStatus(null);
        setPort(null);
      });
    });
    return () => port?.disconnect();
  }, []);
  const requestLog = () => {
    const request: LogRequest = { type: "log" };
    port?.postMessage(request);
  };
  return [status, requestLog] as const;
};

const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    loadSettings().then(setSettings);
    return watchSettings(setSettings);
  }, []);
  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  };
  return [settings, update] as const;
};

const db = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} dB`);
const rate = (v: number | null) => (v === null ? "—" : `${Number(v.toFixed(2))}x`);

const ANALYSIS_LABEL: Record<Status["analysis"], string> = {
  off: "OFF",
  idle: "動画なし",
  ok: "正常",
  unavailable: "解析不可",
};

const Slider = ({
  label,
  value,
  limits,
  format,
  onChange,
}: {
  label: string;
  value: number;
  limits: { min: number; max: number; step: number };
  format: (v: number) => string;
  onChange: (v: number) => void;
}) => (
  <label className="slider">
    <span className="slider-label">{label}</span>
    <input
      type="range"
      min={limits.min}
      max={limits.max}
      step={limits.step}
      value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    />
    <output>{format(value)}</output>
  </label>
);

export const Popup = () => {
  const [settings, update] = useSettings();
  const [status, requestLog] = useStatus();

  return (
    <main>
      <header>
        <h1>hayame</h1>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.currentTarget.checked })}
          />
          {settings.enabled ? "ON" : "OFF"}
        </label>
      </header>

      <section>
        <Slider
          label="無音速度"
          value={settings.silentRate}
          limits={LIMITS.silentRate}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(silentRate) => update({ silentRate })}
        />
        <Slider
          label="しきい値"
          value={settings.offsetDb}
          limits={LIMITS.offsetDb}
          format={(v) => `底 +${v} dB`}
          onChange={(offsetDb) => update({ offsetDb })}
        />
        <Slider
          label="最短時間"
          value={settings.minSilenceMs}
          limits={LIMITS.minSilenceMs}
          format={(v) => `${v} ms`}
          onChange={(minSilenceMs) => update({ minSilenceMs })}
        />
      </section>

      <section className="debug">
        {status === null ? (
          <p className="muted">このタブでは動作しません（対象は www.youtube.com）</p>
        ) : (
          <dl>
            <dt>解析</dt>
            <dd className={`analysis-${status.analysis}`}>
              {ANALYSIS_LABEL[status.analysis]}
              {status.note && <span className="muted">（{status.note}）</span>}
            </dd>
            <dt>判定</dt>
            <dd className={status.judgement === "silent" ? "silent" : undefined}>
              {status.judgement === "silent"
                ? "無音"
                : status.judgement === "speech"
                  ? "発話"
                  : "—"}
            </dd>
            <dt>RMS</dt>
            <dd>{db(status.rmsDb)}</dd>
            <dt>声の大きさ</dt>
            <dd>{db(status.speechDb)}</dd>
            <dt>ノイズの底</dt>
            <dd>{db(status.floorDb)}</dd>
            <dt>しきい値</dt>
            <dd>{db(status.thresholdDb)}</dd>
            <dt>playbackRate</dt>
            <dd>{rate(status.playbackRate)}</dd>
            <dt>基準速度</dt>
            <dd>{rate(status.baseRate)}</dd>
          </dl>
        )}
        {status !== null && (
          <button type="button" className="log" onClick={requestLog}>
            ログを保存（直近 2 分の計測を CSV で）
          </button>
        )}
      </section>
    </main>
  );
};
