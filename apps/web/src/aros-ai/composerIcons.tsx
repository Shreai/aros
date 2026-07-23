// Shared chat-composer icons — the lucide glyph language from the Shre Composer
// contract (shre-dev-kit discipline/CHAT_COMPOSER.md). One set, used by every AROS
// chat surface (ChatWidget, StartChat, ArosChat), so send/voice read identically
// wherever they appear. Inline paths (no lucide-react dep) but the lucide design.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 16, props: IconProps) {
  const { size: _s, ...rest } = props;
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest,
  };
}

/** lucide `arrow-up` — the canonical send glyph (swaps to Square only on streaming surfaces). */
export function IconSend({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} strokeWidth={2.4}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  );
}

/** lucide `mic` — tap to dictate. */
export function IconMic({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

/** lucide `volume-2` — voice-conversation on (hands-free + replies read aloud). */
export function IconSpeakOn({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

/** lucide `volume-x` — voice-conversation off. */
export function IconSpeakOff({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  );
}
