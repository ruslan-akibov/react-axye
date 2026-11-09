import * as React from 'react';

export declare function track<T, A extends unknown[], R>(
  originalMethod: (...args: A) => Promise<R>,
  context: ClassMethodDecoratorContext<T, (...args: A) => Promise<R>>,
): (...args: A) => Promise<R>;

export type AsyncMethodKeys<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => Promise<unknown> ? K : never;
}[keyof T];

export type TrackedProperties<T> = {
  [K in AsyncMethodKeys<T> as `${K & string}Loading`]?: boolean;
} & {
  [K in AsyncMethodKeys<T> as `${K & string}Error`]?: Error | null;
} & {
  readonly isLoading?: boolean;
};

export interface AxyeSetState<S, P> {
  (updater: Partial<S>, callback?: () => void): void;

  <R>(
    updater: (draft: S, props: Readonly<P>) => R & (R extends void ? void : { [K in keyof R]: K extends keyof S ? S[K] : never }),
    callback?: () => void,
  ): void;
}

export class Axye<P = unknown, S = unknown> extends (React.Component as new <P, S>(props: P) => React.Component<P & { children?: React.ReactNode }, S>)<P, S> {
  constructor(props: P);

  state: Readonly<S> & TrackedProperties<this>;
  setState: AxyeSetState<S, P>;

  static get Context(): React.Context<unknown>;
  _listeners: Set<() => void>;
  _subscribe(listener: () => void): () => void;
}

export type AxyeConstructor<P, S, I extends Axye<P, S>> = {
  new (props: P): I;
};

export interface AxyeInstance<S, I> {
  state: Readonly<S> & TrackedProperties<I>;
}

type Resolve<T> = { [K in keyof T]: T[K] } & {};

export interface UseAxyeHook {
  <P, S, I extends Axye<P, S>>(StoreClass: AxyeConstructor<P, S, I>): Resolve<I & AxyeInstance<S, I>>;
  <P, S, I extends Axye<P, S>, R>(StoreClass: AxyeConstructor<P, S, I>, selector: (store: Resolve<I & AxyeInstance<S, I>>) => R): R;
}

export const useAxye: UseAxyeHook;
export default useAxye;
