/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'shadow-intensity'?: string;
        'bounds'?: string;
        'interaction-prompt'?: string;
        'auto-rotate-delay'?: string;
        'rotation-per-second'?: string;
        loading?: string;
        reveal?: string;
        exposure?: string;
        autoplay?: boolean;
        'animation-name'?: string;
        className?: string;
        style?: React.CSSProperties;
      };
    }
  }
}
