import styles from "./voice-wave.module.css";

type VoiceWaveProps = {
  active: boolean;
};

const bars = [18, 30, 44, 26, 54, 36, 22];

export function VoiceWave({ active }: VoiceWaveProps) {
  return (
    <span className={active ? `${styles.wave} ${styles.active}` : styles.wave} aria-hidden="true">
      {bars.map((height, index) => (
        <span key={`${height}-${index}`} style={{ height }} />
      ))}
    </span>
  );
}
