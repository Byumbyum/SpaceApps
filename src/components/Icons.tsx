import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon>;
export const CloseIcon = (props: IconProps) => <Icon {...props}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
export const MinusIcon = (props: IconProps) => <Icon {...props}><path d="M5 12h14" /></Icon>;
export const CompassIcon = (props: IconProps) => <Icon {...props}><path d="m12 3 3.5 9h-7z" fill="currentColor" stroke="none" /><path d="m12 21-3.5-9h7z" opacity=".35" fill="currentColor" stroke="none" /></Icon>;
export const DrawIcon = (props: IconProps) => <Icon {...props}><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" /></Icon>;
export const PinIcon = (props: IconProps) => <Icon {...props}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></Icon>;
export const ArrowRightIcon = (props: IconProps) => <Icon {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ChevronIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const ShieldIcon = (props: IconProps) => <Icon {...props}><path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z" /></Icon>;
export const HeartIcon = (props: IconProps) => <Icon {...props}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></Icon>;
export const CoinIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="8" /><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 2 2.8.9 2.8 2.1-1.2 1.9-2.8 1.9c-1.3 0-2.4-.5-2.9-1.3M12 6.5V8m0 8v1.5" /></Icon>;
export const SnowIcon = (props: IconProps) => <Icon {...props}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" /></Icon>;
export const LayersIcon = (props: IconProps) => <Icon {...props}><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></Icon>;
export const PanelIcon = (props: IconProps) => <Icon {...props}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M14.5 4.5v15" /></Icon>;
