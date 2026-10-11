import { useEffect, useState } from "react";
import { STATUS_PORT, type StatusMessage } from "@/lib/messages";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  loadSettings,
  type Settings,
  saveSettings,
  watchSettings,
} from "@/lib/settings";
import type { Status } from "@/lib/status";

/** アクティブなタブの content script に繋ぎ、状態を受け取る。YouTube 以外では null のまま */
const useStatus = () => {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let port: Browser.runtime.Port | null = null;
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id === undefined) return;
      port = browser.tabs.connect(tab.id, { name: STATUS_PORT });
      port.onMessage.addListener((m: StatusMessage) => setStatus(m.status));
      // 受け手がいなければすぐ切れる。lastError を読んで警告を出さないようにする
      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        setStatus(null);
      });
    });
    return () => port?.disconnect();
  }, []);
  return status;
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
  const status = useStatus();

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
      </section>
    </main>
  );
};
