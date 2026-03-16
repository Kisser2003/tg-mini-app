declare module "canvas-confetti" {
  export interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    angle?: number;
    startVelocity?: number;
    decay?: number;
    ticks?: number;
    scalar?: number;
  }

  export default function confetti(options?: ConfettiOptions): void;
}

declare module "canvas-confetti" {
  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: ("square" | "circle" | "star")[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }
  function confetti(options?: Options): Promise<null>;
  export = confetti;
}
