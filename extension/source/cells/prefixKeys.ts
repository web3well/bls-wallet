type RemovePrefix<
  Prefix extends string,
  T extends string,
> = T extends `${Prefix}${infer AfterPrefix}` ? AfterPrefix : never;

export type PrefixKeys<
  Prefix extends string,
  Obj extends Record<string, unknown>,
> = {
  [K in `${Prefix}${keyof Obj & string}`]: Obj[RemovePrefix<Prefix, K>];
};

export default function prefixKeys<
  Prefix extends string,
  Obj extends Record<string, unknown>,
>(prefix: Prefix, obj: Obj): PrefixKeys<Prefix, Obj> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [`${prefix}${k}`, v]),
  ) as PrefixKeys<Prefix, Obj>;
}
