declare module 'd3' {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: NodeDatum | string | number;
    target: NodeDatum | string | number;
    index?: number;
  }

  export interface ZoomTransform {
    readonly k: number;
    readonly x: number;
    readonly y: number;
    apply(point: [number, number]): [number, number];
    applyX(x: number): number;
    applyY(y: number): number;
    invert(point: [number, number]): [number, number];
    invertX(x: number): number;
    invertY(y: number): number;
    rescaleX<S>(xScale: S): S;
    rescaleY<S>(yScale: S): S;
    scale(k: number): ZoomTransform;
    toString(): string;
    translate(x: number, y: number): ZoomTransform;
  }

  export const zoomIdentity: ZoomTransform;

  export function select<GElement extends Element, Datum>(selector: GElement | string | null): Selection<GElement, Datum, null, undefined>;
  
  export interface Selection<GElement extends Element, Datum, PElement extends Element | null, PDatum> {
    select<DescElement extends Element>(selector: string): Selection<DescElement, Datum, PElement, PDatum>;
    selectAll<DescElement extends Element, NewDatum>(selector: string): Selection<DescElement, NewDatum, GElement, Datum>;
    append<K extends keyof ElementTagNameMap>(type: K): Selection<ElementTagNameMap[K], Datum, PElement, PDatum>;
    append<ChildElement extends Element>(type: string): Selection<ChildElement, Datum, PElement, PDatum>;
    attr(name: string, value: any): this;
    attr(name: string): string;
    style(name: string, value: any): this;
    text(value: any): this;
    data<NewDatum>(data: NewDatum[]): Selection<GElement, NewDatum, PElement, PDatum>;
    enter(): Selection<GElement, Datum, PElement, PDatum>;
    exit(): Selection<GElement, Datum, PElement, PDatum>;
    remove(): this;
    call(func: any, ...args: any[]): this;
    on(type: string, listener: any): this;
    transition(): any;
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(nodes?: NodeDatum[]): Simulation<NodeDatum, undefined>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface Simulation<NodeDatum extends SimulationNodeDatum, LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined> {
    force(name: string, force?: any): this;
    nodes(nodes: NodeDatum[]): this;
    alpha(alpha: number): this;
    alphaTarget(target: number): this;
    restart(): this;
    stop(): this;
    tick(): this;
    on(type: string, listener: (this: Simulation<NodeDatum, LinkDatum>) => void): this;
  }

  export function forceLink<NodeDatum extends SimulationNodeDatum, LinkDatum extends SimulationLinkDatum<NodeDatum>>(links?: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>;

  export interface ForceLink<NodeDatum extends SimulationNodeDatum, LinkDatum extends SimulationLinkDatum<NodeDatum>> {
    id(id: (d: NodeDatum, i: number, data: NodeDatum[]) => string): this;
    distance(distance: number | ((d: LinkDatum, i: number, data: LinkDatum[]) => number)): this;
    strength(strength: number | ((d: LinkDatum, i: number, data: LinkDatum[]) => number)): this;
    links(links: LinkDatum[]): this;
  }

  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>;

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> {
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
    distanceMin(distance: number): this;
    distanceMax(distance: number): this;
  }

  export function forceCenter<NodeDatum extends SimulationNodeDatum>(x?: number, y?: number): ForceCenter<NodeDatum>;

  export interface ForceCenter<NodeDatum extends SimulationNodeDatum> {
    x(x: number): this;
    y(y: number): this;
  }

  export function forceCollide<NodeDatum extends SimulationNodeDatum>(radius?: number): ForceCollide<NodeDatum>;

  export interface ForceCollide<NodeDatum extends SimulationNodeDatum> {
    radius(radius: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
    strength(strength: number): this;
    iterations(iterations: number): this;
  }

  export function forceX<NodeDatum extends SimulationNodeDatum>(x?: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): ForceX<NodeDatum>;

  export interface ForceX<NodeDatum extends SimulationNodeDatum> {
    strength(strength: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
    x(x: number | ((d: NodeDatum, i: number, data: NodeDatum[]) => number)): this;
  }

  export function zoom<ZoomRefElement extends Element, Datum>(): ZoomBehavior<ZoomRefElement, Datum>;

  export interface ZoomBehavior<ZoomRefElement extends Element, Datum> {
    (selection: Selection<ZoomRefElement, Datum, any, any>): void;
    transform: (selection: any, transform: ZoomTransform) => void;
    on(type: string, listener: (this: ZoomRefElement, event: any, d: Datum) => void): this;
    scaleExtent(extent: [number, number]): this;
    translateExtent(extent: [[number, number], [number, number]]): this;
  }

  export function drag<GElement extends Element, Datum>(): DragBehavior<GElement, Datum, Datum | any>;

  export interface DragBehavior<GElement extends Element, Datum, Subject> {
    (selection: Selection<GElement, Datum, any, any>): void;
    on(type: string, listener: (this: GElement, event: any, d: Datum) => void): this;
    subject(subject: (this: GElement, event: any, d: Datum) => Subject): this;
    container(container: any): this;
  }
}
