declare module "canvas-confetti" {
  export interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: ("square" | "circle")[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  export interface GlobalOptions extends Options {
    resize?: boolean;
    useWorker?: boolean;
  }

  export interface CreateTypes {
    (options?: Options): Promise<null> | null;
    reset(): void;
  }

  function confetti(options?: Options): Promise<null> | null;
  function confetti(options?: GlobalOptions): Promise<null> | null;
  
  namespace confetti {
    function create(canvas: HTMLCanvasElement, options?: GlobalOptions): CreateTypes;
  }

  export default confetti;
}
