declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  export interface LucideProps extends Partial<SVGProps<SVGSVGElement>> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
    strokeWidth?: string | number;
  }

  export type LucideIcon = FC<LucideProps>;

  export const Upload: LucideIcon;
  export const Folder: LucideIcon;
  export const Square: LucideIcon;
  export const CheckSquare: LucideIcon;
  export const Settings: LucideIcon;
  export const Check: LucideIcon;
  export const X: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const CheckCircle: LucideIcon;
}

