import mapValues from '../helpers/mapValues';
import ExplicitAny from '../types/ExplicitAny';

export default function mixtureCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const proto = Object.getPrototypeOf(value);

  if (proto === Object.prototype) {
    return mixtureObjectCopy(value as ExplicitAny) as T;
  }

  if (proto === Array.prototype) {
    return mixtureArrayCopy(value as ExplicitAny) as unknown as T;
  }

  if (proto !== null && 'copy' in proto) {
    return proto.copy.call(value);
  }

  return value;
}

function mixtureObjectCopy(value: Record<string, unknown>) {
  return mapValues(value, mixtureCopy);
}

function mixtureArrayCopy(value: unknown[]) {
  return value.map(mixtureCopy);
}
